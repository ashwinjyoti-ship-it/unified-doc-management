import type { Page } from '../types';

export const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function externalLinkHtml(href: string, label: string): string {
  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" class="external-link">${label}</a>`;
}

/** Convert bare URLs in plain text to clickable links. */
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

/** Convert [label](url) markdown links and bare URLs in plain text. */
function markdownAndAutolinksToHtml(text: string): string {
  if (!text) return '';

  let result = '';
  let lastIndex = 0;
  const re = new RegExp(MARKDOWN_LINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    result += autolinkPlainText(text.slice(lastIndex, match.index));
    const label = escapeHtml(match[1]);
    const href = match[2].trim();
    result += externalLinkHtml(href, label);
    lastIndex = re.lastIndex;
  }

  result += autolinkPlainText(text.slice(lastIndex));
  return result;
}

/** Convert [[Title]], [text](url), and bare URLs in plain text to HTML. */
export function inlineMarkupToHtml(
  text: string,
  resolvePageId?: (title: string) => string | undefined,
): string {
  if (!text) return '';

  let result = '';
  let lastIndex = 0;
  const re = new RegExp(WIKI_LINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    result += markdownAndAutolinksToHtml(text.slice(lastIndex, match.index));
    const title = match[1].trim();
    const pageId = (match[2]?.trim() || resolvePageId?.(title) || '').trim();
    const label = escapeHtml(title);

    if (pageId) {
      result += `<a href="/page/${escapeAttr(pageId)}" data-page-link="true" class="page-link">${label}</a>`;
    } else {
      result += `<span class="page-link-unresolved" title="Page not found">${label}</span>`;
    }
    lastIndex = re.lastIndex;
  }

  result += markdownAndAutolinksToHtml(text.slice(lastIndex));
  return result;
}

/** Convert [[Title]] or [[Title|page-id]] in plain text to page link HTML. */
export function wikiLinksToHtml(
  text: string,
  resolvePageId?: (title: string) => string | undefined,
): string {
  return inlineMarkupToHtml(text, resolvePageId);
}

/** Serialize TipTap inline nodes to plain text, preserving page links as [[Title|id]]. */
export function serializeInlineNodes(nodes: Array<Record<string, unknown>> | undefined): string {
  if (!nodes?.length) return '';

  let out = '';
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      // Soft line breaks (Shift+Enter / pasted <br>) must round-trip as \n, not vanish.
      out += '\n';
    } else if (node.type === 'text') {
      let text = (node.text as string) || '';
      const marks = (node.marks as Array<{ type: string; attrs?: { href?: string } }>) || [];
      const linkMark = marks.find((mark) => mark.type === 'link');
      if (linkMark?.attrs?.href) {
        const href = linkMark.attrs.href;
        const pageId = extractPageIdFromHref(href);
        if (pageId) {
          text = `[[${text}|${pageId}]]`;
        } else {
          text = `[${text}](${href})`;
        }
      }
      out += text;
    } else if (node.content) {
      out += serializeInlineNodes(node.content as Array<Record<string, unknown>>);
    }
  }
  return out;
}
