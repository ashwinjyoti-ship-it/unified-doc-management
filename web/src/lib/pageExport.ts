import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import type { DatabaseProperty, DatabaseRow, Page } from '../types';
import { getPropValue, getRowTitle } from './databaseFilters';
import { getChildren, pageIcon } from './pageTree';

marked.setOptions({ gfm: true, breaks: false });

const PDF_STYLES = `
  .pdf-export { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1D3325; line-height: 1.6; font-size: 14px; overflow-wrap: break-word; word-wrap: break-word; padding-bottom: 8px; }
  .pdf-title { font-size: 28px; font-weight: 700; margin: 0 0 24px; color: #1D3325; border-bottom: 2px solid #004228; padding-bottom: 12px; page-break-after: avoid; break-after: avoid-page; }
  .pdf-body h1 { font-size: 24px; font-weight: 700; margin: 20px 0 10px; color: #1D3325; page-break-after: avoid; break-after: avoid-page; }
  .pdf-body h2 { font-size: 20px; font-weight: 600; margin: 16px 0 8px; color: #1D3325; page-break-after: avoid; break-after: avoid-page; }
  .pdf-body h3 { font-size: 17px; font-weight: 600; margin: 14px 0 6px; color: #1D3325; page-break-after: avoid; break-after: avoid-page; }
  .pdf-body p { margin: 8px 0; color: #1D3325; orphans: 3; widows: 3; }
  .pdf-body ul, .pdf-body ol { padding-left: 24px; margin: 8px 0; color: #1D3325; }
  .pdf-body li { margin: 4px 0; color: #1D3325; }
  .pdf-body blockquote { border-left: 3px solid #97B79E; padding: 8px 16px; margin: 12px 0; background: #F4F1ED; border-radius: 0 8px 8px 0; color: #1D3325; page-break-inside: avoid; break-inside: avoid-page; }
  .pdf-body pre { background: #17281D; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; break-inside: avoid-page; }
  .pdf-body code { background: #F4F1ED; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, monospace; color: #1D3325; }
  .pdf-body pre code { background: none; padding: 0; color: inherit; }
  .pdf-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block; page-break-inside: avoid; break-inside: avoid-page; }
  .pdf-body table { border-collapse: collapse; width: 100%; margin: 12px 0; table-layout: fixed; page-break-inside: avoid; break-inside: avoid-page; }
  .pdf-body th, .pdf-body td { border: 1px solid #DCDED6; padding: 8px 10px; text-align: left; vertical-align: top; word-break: break-word; color: #1D3325; }
  .pdf-body th { background: #F4F1ED; font-weight: 600; }
  .pdf-body a { color: #004228; text-decoration: underline; }
  .pdf-body hr { border: none; border-top: 1px solid #DCDED6; margin: 16px 0; page-break-after: avoid; break-after: avoid-page; }
  .pdf-body ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  .pdf-body ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
  .pdf-body strong { font-weight: 600; color: #1D3325; }
  .pdf-body em { font-style: italic; color: #1D3325; }
`;

const PDF_PAGE_WIDTH_PX = 794; // ~A4 at 96dpi
const PDF_PAGE_BREAK_MARGIN_PT = 44;

/** Trigger a file download in the browser. */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

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

function prepareClonedExportRoot(clonedDoc: Document): void {
  clonedDoc.querySelectorAll('[data-pdf-export-root]').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.opacity = '1';
    node.style.transform = 'none';
    node.style.visibility = 'visible';
  });
}

function buildPdfExportContainer(title: string, bodyHtml: string): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('data-pdf-export-root', 'true');
  // Keep fully opaque for html2canvas; hide off-screen until jsPDF clones it.
  container.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    `width: ${PDF_PAGE_WIDTH_PX}px`,
    'padding: 48px 56px',
    'background: #ffffff',
    'box-sizing: border-box',
    'color: #1D3325',
    'opacity: 1',
    'visibility: visible',
    'transform: translateX(-200vw)',
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

  return container;
}

/** Render styled HTML content to a downloadable PDF file. */
export async function downloadHtmlAsPdf(title: string, bodyHtml: string, filename: string): Promise<void> {
  const container = buildPdfExportContainer(title, bodyHtml);
  document.body.appendChild(container);

  try {
    await waitForImages(container);

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();

    await doc.html(container, {
      x: 0,
      y: 0,
      width: pageWidth,
      windowWidth: PDF_PAGE_WIDTH_PX,
      margin: [PDF_PAGE_BREAK_MARGIN_PT, 0, PDF_PAGE_BREAK_MARGIN_PT, 0],
      autoPaging: 'text',
      html2canvas: {
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => prepareClonedExportRoot(clonedDoc),
      },
    });

    doc.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
