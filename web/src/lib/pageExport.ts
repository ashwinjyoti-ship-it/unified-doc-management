import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import type { DatabaseProperty, DatabaseRow, Page } from '../types';
import { getPropValue, getRowTitle } from './databaseFilters';
import { getChildren, pageIcon } from './pageTree';

marked.setOptions({ gfm: true, breaks: false });

const PDF_STYLES = `
  .pdf-export { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1D3325; line-height: 1.6; font-size: 14px; }
  .pdf-title { font-size: 28px; font-weight: 700; margin: 0 0 24px; color: #1D3325; border-bottom: 2px solid #004228; padding-bottom: 12px; }
  .pdf-body h1 { font-size: 24px; font-weight: 700; margin: 20px 0 10px; color: #1D3325; }
  .pdf-body h2 { font-size: 20px; font-weight: 600; margin: 16px 0 8px; color: #1D3325; }
  .pdf-body h3 { font-size: 17px; font-weight: 600; margin: 14px 0 6px; color: #1D3325; }
  .pdf-body p { margin: 8px 0; }
  .pdf-body ul, .pdf-body ol { padding-left: 24px; margin: 8px 0; }
  .pdf-body li { margin: 4px 0; }
  .pdf-body blockquote { border-left: 3px solid #97B79E; padding: 8px 16px; margin: 12px 0; background: #F4F1ED; border-radius: 0 8px 8px 0; }
  .pdf-body pre { background: #17281D; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
  .pdf-body code { background: #F4F1ED; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, monospace; }
  .pdf-body pre code { background: none; padding: 0; color: inherit; }
  .pdf-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block; }
  .pdf-body table { border-collapse: collapse; width: 100%; margin: 12px 0; table-layout: fixed; }
  .pdf-body th, .pdf-body td { border: 1px solid #DCDED6; padding: 8px 10px; text-align: left; vertical-align: top; word-break: break-word; }
  .pdf-body th { background: #F4F1ED; font-weight: 600; }
  .pdf-body a { color: #004228; text-decoration: underline; }
  .pdf-body hr { border: none; border-top: 1px solid #DCDED6; margin: 16px 0; }
  .pdf-body ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  .pdf-body ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
  .pdf-body strong { font-weight: 600; }
  .pdf-body em { font-style: italic; }
`;

const PDF_PAGE_WIDTH_PX = 794; // ~A4 at 96dpi

export function folderToMarkdown(title: string, pages: Page[], folderId: string): string {
  const children = getChildren(pages, folderId);
  const lines = [`# ${title}`, '', '## Contents', ''];
  if (children.length === 0) {
    lines.push('_This folder is empty._');
  } else {
    for (const child of children) {
      lines.push(`- ${pageIcon(child)} **${child.title}** (${child.type})`);
    }
  }
  return lines.join('\n');
}

function formatPropertyValue(row: DatabaseRow, prop: DatabaseProperty): string {
  const raw = getPropValue(row, prop.id);
  if (raw == null || raw === '') return '';
  if (prop.type === 'checkbox') return raw ? 'Yes' : 'No';
  if (Array.isArray(raw)) return raw.join(', ');
  return String(raw);
}

export function databaseToMarkdown(
  title: string,
  properties: DatabaseProperty[],
  rows: DatabaseRow[],
  nameProp?: DatabaseProperty,
): string {
  const lines = [`# ${title}`, '', `_${rows.length} row(s)_`, ''];
  if (rows.length === 0) {
    lines.push('_No rows yet._');
    return lines.join('\n');
  }

  const cols = properties.filter((p) => p.type !== 'rollup');
  const header = ['Title', ...cols.filter((p) => !nameProp || p.id !== nameProp.id).map((p) => p.name)];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);

  for (const row of rows) {
    const cells = [
      getRowTitle(row, nameProp),
      ...cols
        .filter((p) => !nameProp || p.id !== nameProp.id)
        .map((p) => formatPropertyValue(row, p).replace(/\|/g, '\\|').replace(/\n/g, ' ')),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}

/** Strip a leading markdown H1 when it matches the page title (avoids duplicate title in PDF). */
export function stripDuplicateTitle(markdown: string, title: string): string {
  const trimmed = markdown.trimStart();
  const match = trimmed.match(/^#\s+(.+?)(?:\n|$)/);
  if (!match) return markdown;
  const heading = match[1].trim();
  const pageTitle = (title || 'Untitled').trim();
  if (heading.toLowerCase() !== pageTitle.toLowerCase()) return markdown;
  return trimmed.slice(match[0].length).trimStart();
}

export function stripDuplicateTitleFromHtml(html: string, title: string): string {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const first = div.firstElementChild;
  if (first?.tagName === 'H1') {
    const heading = (first.textContent ?? '').trim();
    const pageTitle = (title || 'Untitled').trim();
    if (heading.toLowerCase() === pageTitle.toLowerCase()) {
      first.remove();
    }
  }
  return div.innerHTML.trim() || '<p></p>';
}

export function markdownToPdfHtml(markdown: string, title: string): string {
  const body = stripDuplicateTitle(markdown, title);
  return marked.parse(body, { async: false }) as string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

/** Render styled HTML content to a downloadable PDF file. */
export async function downloadHtmlAsPdf(title: string, bodyHtml: string, filename: string): Promise<void> {
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  // Keep in viewport but invisible — off-screen positioning breaks html2canvas capture.
  container.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    `width: ${PDF_PAGE_WIDTH_PX}px`,
    'padding: 48px 56px',
    'background: #ffffff',
    'box-sizing: border-box',
    'z-index: -1',
    'opacity: 0',
    'pointer-events: none',
    'overflow: visible',
  ].join(';');

  container.innerHTML = `
    <style>${PDF_STYLES}</style>
    <article class="pdf-export">
      <h1 class="pdf-title">${escapeHtml(title || 'Untitled')}</h1>
      <div class="pdf-body">${bodyHtml || '<p></p>'}</div>
    </article>
  `;

  document.body.appendChild(container);

  try {
    await waitForImages(container);

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

    await doc.html(container, {
      x: 0,
      y: 0,
      width: doc.internal.pageSize.getWidth(),
      windowWidth: PDF_PAGE_WIDTH_PX,
      autoPaging: 'text',
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
      },
    });

    doc.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
