/**
 * Sanitize HTML that TipTap/ProseMirror puts on the clipboard so paste into
 * Word, Google Docs, email, Notes, etc. does not explode into huge gaps.
 *
 * Destinations apply default <p> margins and treat empty <p><br></p> as full
 * blank paragraphs — while Tandem's editor CSS keeps those compact.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMSerializer, type Fragment, type Node as PMNode, type Schema } from '@tiptap/pm/model';

const COMPACT_BLOCK_MARGIN = 'margin:0 0 0.4em 0';

function isEmptyParagraph(el: Element): boolean {
  if (el.tagName !== 'P') return false;
  const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
  return text.length === 0;
}

/** Unwrap <p> inside <li> — nested paragraphs cause double spacing in Word/Docs. */
function unwrapParagraphsInListItems(root: ParentNode) {
  root.querySelectorAll('li > p').forEach((p) => {
    const parent = p.parentNode;
    if (!parent) return;
    while (p.firstChild) parent.insertBefore(p.firstChild, p);
    parent.removeChild(p);
  });
}

/** Drop empty paragraphs that become huge blank bands outside Tandem. */
function removeEmptyParagraphs(root: ParentNode) {
  root.querySelectorAll('p').forEach((p) => {
    if (isEmptyParagraph(p)) p.remove();
  });
}

/** Give blocks modest inline margins so destination default margins don't double-space. */
function applyCompactMargins(root: ParentNode) {
  root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, pre, ul, ol, table').forEach((el) => {
    const htmlEl = el as HTMLElement;
    const existing = htmlEl.getAttribute('style') || '';
    if (/margin\s*:/i.test(existing)) return;
    htmlEl.setAttribute('style', existing ? `${existing};${COMPACT_BLOCK_MARGIN}` : COMPACT_BLOCK_MARGIN);
  });
}

function stripEditorArtifacts(root: ParentNode) {
  root.querySelectorAll('br.ProseMirror-trailingBreak').forEach((br) => br.remove());
}

/**
 * Transform clipboard HTML for external paste targets.
 * Keeps block structure (and leaves data-pm-slice alone when present).
 */
export function sanitizeCopiedHtml(html: string): string {
  if (!html.trim()) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body;
  stripEditorArtifacts(root);
  unwrapParagraphsInListItems(root);
  removeEmptyParagraphs(root);
  applyCompactMargins(root);
  return root.innerHTML;
}

/** Custom clipboard serializer: schema HTML, then compact for external apps. */
export function createCompactClipboardSerializer(schema: Schema) {
  const base = DOMSerializer.fromSchema(schema);
  return {
    serializeFragment(
      fragment: Fragment,
      options?: { document?: Document },
      target?: HTMLElement | DocumentFragment,
    ) {
      const result = base.serializeFragment(fragment, options, target);
      const owner = options?.document || document;
      const wrap = owner.createElement('div');
      wrap.appendChild(result);
      wrap.innerHTML = sanitizeCopiedHtml(wrap.innerHTML);
      const out = owner.createDocumentFragment();
      while (wrap.firstChild) out.appendChild(wrap.firstChild);
      return out;
    },
    serializeNode(node: PMNode) {
      return base.serializeNode(node);
    },
  };
}

/** TipTap extension: compact HTML on copy/cut/drag via clipboardSerializer. */
export const CompactClipboard = Extension.create({
  name: 'compactClipboard',

  addProseMirrorPlugins() {
    const serializer = createCompactClipboardSerializer(this.editor.schema);
    return [
      new Plugin({
        key: new PluginKey('compactClipboard'),
        props: {
          clipboardSerializer: serializer,
        },
      }),
    ];
  },
});

/**
 * Copy the current editor selection as compact HTML + plain text.
 * Prefer this from the bubble toolbar so focus/right-click races don't clear the action.
 */
export async function copyEditorSelection(editor: {
  state: {
    selection: { empty: boolean; from: number; to: number };
    doc: PMNode;
    schema: Schema;
  };
}): Promise<boolean> {
  const { state } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return false;

  const slice = state.doc.cut(from, to);
  const serializer = createCompactClipboardSerializer(state.schema);
  const wrap = document.createElement('div');
  wrap.appendChild(serializer.serializeFragment(slice.content, { document }));
  const html = wrap.innerHTML;
  const plain = state.doc.textBetween(from, to, '\n');

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through to writeText */
  }

  try {
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    return false;
  }
}