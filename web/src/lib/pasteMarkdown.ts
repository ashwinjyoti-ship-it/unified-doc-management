import { markdownToTiptapHtml, plainTextToTiptapHtml } from './markdownBlocks';

/** Heuristic: pasted plain text looks like markdown, not a single code snippet. */
export function isMarkdownLike(text: string): boolean {
  const sample = text.replace(/\r\n/g, '\n').split('\n').slice(0, 40);
  let score = 0;
  for (const line of sample) {
    if (/^#{1,6}\s+\S/.test(line)) score += 2;
    if (/^[-*+]\s+\S/.test(line)) score += 1;
    if (/^\d+\.\s+\S/.test(line)) score += 1;
    if (line.startsWith('```')) score += 2;
    if (line.startsWith('|')) score += 1;
    if (/\*\*.+\*\*/.test(line)) score += 1;
    if (line.startsWith('> ')) score += 1;
    if (line === '---') score += 1;
    if (/^-\s\[[ x]\]\s/.test(line)) score += 1;
  }
  return score >= 2;
}

/** Clipboard HTML from GitHub raw/blob views, code viewers, or highlighted selections. */
export function isCodeHtmlPaste(html: string): boolean {
  if (!html.trim()) return false;
  const lower = html.toLowerCase();
  // Tables with inline cell borders/styles are document content, not code.
  if (/<table[\s>]/i.test(html)) return false;
  if (/<pre[\s>]/i.test(html) || /<code[\s>]/i.test(html)) return true;
  if (/githubusercontent|blob-code|highlight-source|raw\.github|data-code-cell/i.test(lower)) return true;
  const styledSpans = (html.match(/<span[^>]*style=/gi) || []).length;
  if (styledSpans >= 3) return true;
  if (/background(-color)?:/i.test(html) && styledSpans >= 1) return true;
  return false;
}

export function shouldPreferPlainTextPaste(plain: string, html: string): boolean {
  const trimmed = plain.trim();
  if (!trimmed) return false;
  if (!html.trim()) return isMarkdownLike(trimmed);
  if (isCodeHtmlPaste(html)) return true;
  if (isMarkdownLike(trimmed) && html.length > trimmed.length * 1.5) return true;
  return false;
}

export function convertPasteToTiptapHtml(plain: string, html: string): string {
  const trimmed = plain.replace(/\r\n/g, '\n');
  if (isMarkdownLike(trimmed)) return markdownToTiptapHtml(trimmed);
  if (isCodeHtmlPaste(html)) return plainTextToTiptapHtml(trimmed);
  return plainTextToTiptapHtml(trimmed);
}

/** Keep only a colour declaration for TipTap Color / TextStyle marks. */
function extractColorStyle(style: string | null): string | null {
  if (!style) return null;
  const match = style.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|rgb\([^)]+\))\s*(?:;|$)/i);
  if (!match) return null;
  return `color: ${match[1].trim()}`;
}

/** Keep table-grid styles so pasted tables stay bordered in the editor. */
function extractTableGridStyle(tag: string, style: string | null): string | null {
  if (!style) return null;
  const t = tag.toLowerCase();
  if (t !== 'table' && t !== 'td' && t !== 'th') return null;
  const keep: string[] = [];
  for (const part of style.split(';')) {
    const decl = part.trim();
    if (!decl) continue;
    if (/^(border|border-collapse|border-color|border-width|border-style|padding|width|min-width|background|background-color|font-weight|vertical-align|text-align)\s*:/i.test(decl)) {
      keep.push(decl);
    }
  }
  return keep.length ? keep.join('; ') : null;
}

/** Strip highlight / foreign styles from HTML paste; preserve text colour + table grid. */
export function sanitizePastedHtml(html: string): string {
  if (!html.trim()) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('mark').forEach((mark) => {
    const text = mark.textContent ?? '';
    mark.replaceWith(doc.createTextNode(text));
  });
  doc.body.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const colorStyle = extractColorStyle(el.getAttribute('style'));
    const tableStyle = extractTableGridStyle(tag, el.getAttribute('style'));
    el.removeAttribute('class');
    el.removeAttribute('bgcolor');
    const legacyColor = el.getAttribute('color');
    el.removeAttribute('color');
    const parts = [tableStyle, colorStyle].filter(Boolean) as string[];
    if (parts.length) {
      el.setAttribute('style', parts.join('; '));
    } else if (legacyColor && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(legacyColor.trim())) {
      el.setAttribute('style', `color: ${legacyColor.trim()}`);
    } else {
      el.removeAttribute('style');
    }
  });
  return doc.body.innerHTML;
}
