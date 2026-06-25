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

/** Strip inline styles / highlight marks from HTML paste fallbacks. */
export function sanitizePastedHtml(html: string): string {
  if (!html.trim()) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('mark').forEach((mark) => {
    const text = mark.textContent ?? '';
    mark.replaceWith(doc.createTextNode(text));
  });
  doc.body.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style');
    el.removeAttribute('class');
    el.removeAttribute('bgcolor');
    el.removeAttribute('color');
  });
  return doc.body.innerHTML;
}
