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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

/** Convert [[Title]] or [[Title|page-id]] in plain text to page link HTML. */
export function wikiLinksToHtml(
  text: string,
  resolvePageId?: (title: string) => string | undefined,
): string {
  if (!text) return '';

  let result = '';
  let lastIndex = 0;
  const re = new RegExp(WIKI_LINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
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

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

/** Serialize TipTap inline nodes to plain text, preserving page links as [[Title|id]]. */
export function serializeInlineNodes(nodes: Array<Record<string, unknown>> | undefined): string {
  if (!nodes?.length) return '';

  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      let text = (node.text as string) || '';
      const marks = (node.marks as Array<{ type: string; attrs?: { href?: string } }>) || [];
      const linkMark = marks.find((mark) => mark.type === 'link');
      const pageId = linkMark?.attrs?.href ? extractPageIdFromHref(linkMark.attrs.href) : null;
      if (pageId) {
        text = `[[${text}|${pageId}]]`;
      }
      out += text;
    } else if (node.content) {
      out += serializeInlineNodes(node.content as Array<Record<string, unknown>>);
    }
  }
  return out;
}
