import type { Page } from '../types';

export const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Allowed text colours (toolbar palette + persisted span styles). */
export const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Forest', value: '#004228' },
  { name: 'Sage', value: '#5B8A6E' },
  { name: 'Charcoal', value: '#1D3325' },
  { name: 'Red', value: '#C0392B' },
  { name: 'Orange', value: '#D35400' },
  { name: 'Gold', value: '#B7950B' },
  { name: 'Blue', value: '#2471A3' },
  { name: 'Purple', value: '#7D3C98' },
] as const;

/** Pastel cell fill colours (table background). Empty value clears the fill. */
export const FILL_COLORS = [
  { name: 'None', value: '' },
  { name: 'Forest', value: '#D5E6DB' },
  { name: 'Sage', value: '#E4EFE8' },
  { name: 'Linen', value: '#F4F1ED' },
  { name: 'Red', value: '#F8D7D3' },
  { name: 'Orange', value: '#FCE0CC' },
  { name: 'Gold', value: '#F7F0C8' },
  { name: 'Blue', value: '#D6EAF8' },
  { name: 'Purple', value: '#E8DAEF' },
] as const;

const COLOR_HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function extractPageIdFromHref(href: string): string | null {
  const match = href.match(/^\/page\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export function resolvePageIdByTitle(title: string, pages: Pick<Page, 'id' | 'title'>[]): string | undefined {
  const normalized = title.trim().toLowerCase();
  return pages.find((page) => page.title.trim().toLowerCase() === normalized)?.id;
}

export function createPageIdResolver(pages: Pick<Page, 'id' | 'title'>[]) {
  return (title: string) => resolvePageIdByTitle(title, pages);
}

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const AUTO_LINK_REGEX = /https?:\/\/[^\s<>()\[\]]+/g;
/** Color spans we persist in block text for TipTap Color marks. */
const COLOR_SPAN_REGEX = /<span\s+style=(["'])color:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\1\s*>([\s\S]*?)<\/span>/gi;
const INLINE_CODE_REGEX = /`([^`]+)`/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function normalizeColor(color: string | undefined | null): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!COLOR_HEX_RE.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

function externalLinkHtml(href: string, labelHtml: string): string {
  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" class="external-link">${labelHtml}</a>`;
}

/** Convert bare URLs in plain text to clickable links (no markdown emphasis). */
function autolinkPlainText(text: string): string {
  if (!text) return '';

  let result = '';
  let lastIndex = 0;
  const re = new RegExp(AUTO_LINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const url = match[0];
    result += externalLinkHtml(url, escapeHtml(url));
    lastIndex = re.lastIndex;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

/**
 * Parse **bold**, *italic* / _italic_, ~~strike~~ in text that has no code/links/wiki.
 * Longer delimiters first; does not cross newlines.
 */
function emphasisToHtml(text: string): string {
  if (!text) return '';

  // Do not cross newlines — each soft-break segment is emphasized independently.
  const pattern = /(\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_))/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags);

  while ((match = re.exec(text)) !== null) {
    result += autolinkPlainText(text.slice(lastIndex, match.index));
    if (match[2] != null || match[3] != null) {
      const inner = match[2] ?? match[3] ?? '';
      result += `<strong>${emphasisToHtml(inner)}</strong>`;
    } else if (match[4] != null) {
      result += `<s>${emphasisToHtml(match[4])}</s>`;
    } else if (match[5] != null || match[6] != null) {
      const inner = match[5] ?? match[6] ?? '';
      result += `<em>${emphasisToHtml(inner)}</em>`;
    }
    lastIndex = re.lastIndex;
  }

  result += autolinkPlainText(text.slice(lastIndex));
  return result;
}

/** Parse markdown links, then emphasis + autolinks. Labels may contain emphasis. */
function markdownAndEmphasisToHtml(text: string): string {
  if (!text) return '';

  let result = '';
  let lastIndex = 0;
  const re = new RegExp(MARKDOWN_LINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    result += emphasisToHtml(text.slice(lastIndex, match.index));
    const labelHtml = emphasisToHtml(match[1]);
    const href = match[2].trim();
    result += externalLinkHtml(href, labelHtml);
    lastIndex = re.lastIndex;
  }

  result += emphasisToHtml(text.slice(lastIndex));
  return result;
}

/** Split on inline `code`, then markdown/emphasis. Code contents are escaped only. */
function codeAndMarkdownToHtml(text: string): string {
  if (!text) return '';

  let result = '';
  let lastIndex = 0;
  const re = new RegExp(INLINE_CODE_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    result += markdownAndEmphasisToHtml(text.slice(lastIndex, match.index));
    result += `<code>${escapeHtml(match[1])}</code>`;
    lastIndex = re.lastIndex;
  }

  result += markdownAndEmphasisToHtml(text.slice(lastIndex));
  return result;
}

/** Persistable colour spans around markdown/emphasis content. */
function colorSpansToHtml(text: string): string {
  if (!text) return '';

  let result = '';
  let lastIndex = 0;
  const re = new RegExp(COLOR_SPAN_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    result += codeAndMarkdownToHtml(text.slice(lastIndex, match.index));
    const color = normalizeColor(match[2]);
    const inner = colorSpansToHtml(match[3]);
    if (color) {
      result += `<span style="color: ${color}">${inner}</span>`;
    } else {
      result += inner;
    }
    lastIndex = re.lastIndex;
  }

  result += codeAndMarkdownToHtml(text.slice(lastIndex));
  return result;
}

/** Convert [[Title]], colour spans, `code`, [text](url), **bold**, etc. to HTML. */
export function inlineMarkupToHtml(
  text: string,
  resolvePageId?: (title: string) => string | undefined,
): string {
  if (!text) return '';

  // Protect wiki tokens so surrounding **bold** / colour wraps apply to the whole link.
  const wikiHtml: string[] = [];
  const withPlaceholders = text.replace(new RegExp(WIKI_LINK_REGEX.source, 'g'), (_raw, titleRaw, idRaw) => {
    const title = String(titleRaw || '').trim();
    const pageId = (String(idRaw || '').trim() || resolvePageId?.(title) || '').trim();
    const label = escapeHtml(title);
    const html = pageId
      ? `<a href="/page/${escapeAttr(pageId)}" data-page-link="true" class="page-link">${label}</a>`
      : `<span class="page-link-unresolved" title="Page not found">${label}</span>`;
    const idx = wikiHtml.length;
    wikiHtml.push(html);
    return `\uE000${idx}\uE001`;
  });

  const withMarks = colorSpansToHtml(withPlaceholders);
  return withMarks.replace(/\uE000(\d+)\uE001/g, (_m, idx) => wikiHtml[Number(idx)] ?? '');
}

/** Convert [[Title]] or [[Title|page-id]] in plain text to page link HTML. */
export function wikiLinksToHtml(
  text: string,
  resolvePageId?: (title: string) => string | undefined,
): string {
  return inlineMarkupToHtml(text, resolvePageId);
}

type InlineMark = { type: string; attrs?: { href?: string; color?: string } };

function wrapMarkdownMarks(text: string, marks: InlineMark[]): string {
  const types = new Set(marks.map((m) => m.type));
  let out = text;

  // Innermost → outermost. Avoid ***x*** (ambiguous); use **_x_** for bold+italic.
  if (types.has('code')) {
    out = `\`${out.replace(/`/g, '\\`')}\``;
  } else {
    if (types.has('strike')) out = `~~${out}~~`;
    if (types.has('bold') && types.has('italic')) {
      out = `**_${out}_**`;
    } else {
      if (types.has('italic')) out = `*${out}*`;
      if (types.has('bold')) out = `**${out}**`;
    }
  }

  const colorMark = marks.find((m) => m.type === 'textStyle' && m.attrs?.color);
  const color = normalizeColor(colorMark?.attrs?.color);
  if (color) {
    out = `<span style="color: ${color}">${out}</span>`;
  }

  return out;
}

/** Serialize TipTap inline nodes to markdown-ish text (marks + wiki/links + colour spans). */
export function serializeInlineNodes(nodes: Array<Record<string, unknown>> | undefined): string {
  if (!nodes?.length) return '';

  let out = '';
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      // Soft line breaks (Shift+Enter / pasted <br>) must round-trip as \n, not vanish.
      out += '\n';
    } else if (node.type === 'text') {
      let text = (node.text as string) || '';
      const marks = ((node.marks as InlineMark[]) || []).slice();
      const linkMark = marks.find((mark) => mark.type === 'link');
      const nonLinkMarks = marks.filter((mark) => mark.type !== 'link');

      if (linkMark?.attrs?.href) {
        const href = linkMark.attrs.href;
        const pageId = extractPageIdFromHref(href);
        if (pageId) {
          // Keep wiki title plain; wrap marks around the whole wiki token.
          const wiki = `[[${text}|${pageId}]]`;
          out += wrapMarkdownMarks(wiki, nonLinkMarks);
        } else {
          const labeled = wrapMarkdownMarks(text, nonLinkMarks);
          out += `[${labeled}](${href})`;
        }
      } else {
        out += wrapMarkdownMarks(text, nonLinkMarks);
      }
    } else if (node.content) {
      out += serializeInlineNodes(node.content as Array<Record<string, unknown>>);
    }
  }
  return out;
}
