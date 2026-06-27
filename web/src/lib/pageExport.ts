import html2canvas from 'html2canvas';
import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import type { DatabaseProperty, DatabaseRow, Page } from '../types';
import { getPropValue, getRowTitle } from './databaseFilters';
import { getChildren, pageIcon } from './pageTree';

marked.setOptions({ gfm: true, breaks: false });

const PDF_STYLES = `
  .pdf-export { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1D3325; line-height: 1.6; font-size: 14px; overflow-wrap: break-word; word-wrap: break-word; }
  .pdf-title { font-size: 28px; font-weight: 700; margin: 0 0 24px; color: #1D3325; border-bottom: 2px solid #004228; padding-bottom: 12px; }
  .pdf-body h1 { font-size: 24px; font-weight: 700; margin: 20px 0 10px; color: #1D3325; }
  .pdf-body h2 { font-size: 20px; font-weight: 600; margin: 16px 0 8px; color: #1D3325; }
  .pdf-body h3 { font-size: 17px; font-weight: 600; margin: 14px 0 6px; color: #1D3325; }
  .pdf-body p { margin: 8px 0; color: #1D3325; page-break-inside: avoid; break-inside: avoid-page; }
  .pdf-body ul, .pdf-body ol { padding-left: 24px; margin: 8px 0; color: #1D3325; page-break-inside: avoid; break-inside: avoid-page; }
  .pdf-body li { margin: 4px 0; color: #1D3325; page-break-inside: avoid; break-inside: avoid-page; }
  .pdf-body blockquote { border-left: 3px solid #97B79E; padding: 8px 16px; margin: 12px 0; background: #F4F1ED; border-radius: 0 8px 8px 0; color: #1D3325; }
  .pdf-body pre { background: #17281D; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
  .pdf-body code { background: #F4F1ED; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, monospace; color: #1D3325; }
  .pdf-body pre code { background: none; padding: 0; color: inherit; }
  .pdf-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block; }
  .pdf-body table { border-collapse: collapse; width: 100%; margin: 12px 0; table-layout: fixed; }
  .pdf-body th, .pdf-body td { border: 1px solid #DCDED6; padding: 8px 10px; text-align: left; vertical-align: top; word-break: break-word; color: #1D3325; }
  .pdf-body th { background: #F4F1ED; font-weight: 600; }
  .pdf-body a { color: #004228; text-decoration: underline; }
  .pdf-body hr { border: none; border-top: 1px solid #DCDED6; margin: 16px 0; }
  .pdf-body ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  .pdf-body ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
  .pdf-body strong { font-weight: 600; color: #1D3325; }
  .pdf-body em { font-style: italic; color: #1D3325; }
`;

const PDF_PAGE_WIDTH_PX = 794; // ~A4 width at 96dpi
const PDF_PAGE_HEIGHT_PX = Math.round(PDF_PAGE_WIDTH_PX * (841.89 / 595.28)); // A4 height at 96dpi
const PDF_PADDING_TOP_PX = 48;
const PDF_PADDING_BOTTOM_PX = 48;
const PDF_PADDING_X_PX = 56;
const PDF_CAPTURE_SCALE = 2;

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

function buildPdfExportContainer(title: string, bodyHtml: string): HTMLDivElement {
  return buildPdfPageContainer(title, bodyHtml, true);
}

function buildPdfPageContainer(title: string, bodyContent: string | HTMLElement[], showTitle: boolean): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('data-pdf-export-root', 'true');
  // Must stay fully opaque and on-screen for html2canvas. Keep behind the UI so
  // the user never sees a flash; do not use opacity:0 or visibility:hidden.
  container.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    `width: ${PDF_PAGE_WIDTH_PX}px`,
    `padding: ${PDF_PADDING_TOP_PX}px ${PDF_PADDING_X_PX}px ${PDF_PADDING_BOTTOM_PX}px`,
    'background: #ffffff',
    'box-sizing: border-box',
    'color: #1D3325',
    'z-index: -1',
    'pointer-events: none',
    'overflow: visible',
  ].join(';');

  const article = document.createElement('article');
  article.className = 'pdf-export';

  if (showTitle) {
    const heading = document.createElement('h1');
    heading.className = 'pdf-title';
    heading.textContent = title || 'Untitled';
    article.appendChild(heading);
  }

  const body = document.createElement('div');
  body.className = 'pdf-body';
  if (Array.isArray(bodyContent)) {
    for (const block of bodyContent) {
      body.appendChild(block.cloneNode(true));
    }
  } else {
    body.innerHTML = bodyContent || '<p></p>';
  }
  article.appendChild(body);

  const style = document.createElement('style');
  style.textContent = PDF_STYLES;
  container.appendChild(style);
  container.appendChild(article);

  return container;
}

function blockOuterHeight(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return el.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
}

/**
 * Split top-level body blocks across pages using live DOM measurements so no
 * paragraph, heading, list item, or table is ever sliced across a page break.
 */
function paginateBodyBlocks(blocks: HTMLElement[], titleHeight: number): HTMLElement[][] {
  const fullPageBudget = PDF_PAGE_HEIGHT_PX - PDF_PADDING_TOP_PX - PDF_PADDING_BOTTOM_PX;
  const pages: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let used = 0;
  let budget = Math.max(0, fullPageBudget - titleHeight);

  for (const block of blocks) {
    const height = blockOuterHeight(block);

    // Block taller than a full page: flush current page and keep it whole.
    if (height > fullPageBudget) {
      if (current.length > 0) {
        pages.push(current);
        current = [];
        used = 0;
        budget = fullPageBudget;
      }
      pages.push([block]);
      continue;
    }

    if (used + height > budget && current.length > 0) {
      pages.push(current);
      current = [block];
      used = height;
      budget = fullPageBudget;
      continue;
    }

    current.push(block);
    used += height;
  }

  if (current.length > 0) {
    pages.push(current);
  }

  return pages;
}

async function renderPageCanvas(pageContainer: HTMLDivElement): Promise<HTMLCanvasElement> {
  await waitForImages(pageContainer);
  return html2canvas(pageContainer, {
    scale: PDF_CAPTURE_SCALE,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: -window.scrollY,
    width: PDF_PAGE_WIDTH_PX,
    windowWidth: PDF_PAGE_WIDTH_PX,
  });
}

/** Slice an oversized canvas across multiple PDF pages at whitespace boundaries. */
function appendCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  pageIndex: number,
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pxPerPt = canvas.width / pageWidth;
  const pageHeightPx = pageHeight * pxPerPt;
  const ctx = canvas.getContext('2d');

  let srcY = 0;
  let nextPageIndex = pageIndex;

  while (srcY < canvas.height) {
    if (nextPageIndex > 0) {
      pdf.addPage();
    }

    const remaining = canvas.height - srcY;
    let sliceHeight = Math.min(pageHeightPx, remaining);

    if (ctx && remaining > pageHeightPx) {
      const idealBreak = srcY + pageHeightPx;
      const minBreak = srcY + pageHeightPx * 0.5;
      sliceHeight = findWhitespaceBreakHeight(ctx, idealBreak, minBreak, canvas.width, srcY);
    }

    sliceHeight = Math.max(1, Math.floor(sliceHeight));
    const pageCanvas = sliceCanvasPage(canvas, srcY, sliceHeight);
    const imgHeightPt = sliceHeight / pxPerPt;
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, imgHeightPt);

    srcY += sliceHeight;
    nextPageIndex += 1;
  }

  return nextPageIndex;
}

/** Return true when every sampled pixel in a canvas row is near-white. */
function isCanvasRowBlank(ctx: CanvasRenderingContext2D, y: number, width: number): boolean {
  const row = ctx.getImageData(0, y, width, 1).data;
  for (let x = 0; x < width; x += 4) {
    const i = x * 4;
    if (row[i] < 248 || row[i + 1] < 248 || row[i + 2] < 248) {
      return false;
    }
  }
  return true;
}

/** Find the tallest slice ending at or before idealBreak that breaks on whitespace. */
function findWhitespaceBreakHeight(
  ctx: CanvasRenderingContext2D,
  idealBreakY: number,
  minBreakY: number,
  width: number,
  srcY: number,
): number {
  const searchStart = Math.max(minBreakY, idealBreakY - 160);
  let bestBreak = idealBreakY;
  let blankRun = 0;

  for (let y = Math.floor(idealBreakY); y >= searchStart; y--) {
    if (isCanvasRowBlank(ctx, y, width)) {
      blankRun += 1;
      // Require a short blank band so we break between lines, not on anti-aliasing.
      if (blankRun >= 3) {
        bestBreak = y + blankRun - 1;
        break;
      }
    } else {
      blankRun = 0;
    }
  }

  return Math.max(1, bestBreak - srcY);
}

function sliceCanvasPage(source: HTMLCanvasElement, srcY: number, height: number): HTMLCanvasElement {
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = source.width;
  pageCanvas.height = height;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create PDF page canvas');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  ctx.drawImage(source, 0, srcY, source.width, height, 0, 0, source.width, height);
  return pageCanvas;
}

/**
 * Render styled HTML content to a downloadable PDF file.
 *
 * Measures block-level DOM nodes and renders each page separately so paragraphs,
 * headings, and list items never span a page boundary. Oversized blocks (long
 * code blocks) fall back to canvas slicing with whitespace-aware breaks.
 */
export async function downloadHtmlAsPdf(title: string, bodyHtml: string, filename: string): Promise<void> {
  const measureContainer = buildPdfExportContainer(title, bodyHtml);
  document.body.appendChild(measureContainer);

  try {
    await waitForImages(measureContainer);

    const body = measureContainer.querySelector('.pdf-body');
    const titleEl = measureContainer.querySelector('.pdf-title');
    if (!body) {
      throw new Error('PDF export produced empty content');
    }

    const blocks = Array.from(body.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (blocks.length === 0) {
      throw new Error('PDF export produced empty content');
    }

    const titleHeight = titleEl ? blockOuterHeight(titleEl as HTMLElement) : 0;
    const pageGroups = paginateBodyBlocks(blocks, titleHeight);

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let pageIndex = 0;

    for (let i = 0; i < pageGroups.length; i++) {
      const pageContainer = buildPdfPageContainer(title, pageGroups[i], i === 0);
      document.body.appendChild(pageContainer);

      try {
        const canvas = await renderPageCanvas(pageContainer);
        const pxPerPt = canvas.width / pageWidth;
        const imgHeightPt = canvas.height / pxPerPt;
        const fullPageBudget = PDF_PAGE_HEIGHT_PX - PDF_PADDING_TOP_PX - PDF_PADDING_BOTTOM_PX;
        const blockIsOversized = pageGroups[i].some((block) => blockOuterHeight(block) > fullPageBudget);

        if (blockIsOversized && imgHeightPt > pageHeight) {
          pageIndex = appendCanvasToPdf(pdf, canvas, pageIndex);
        } else {
          if (pageIndex > 0) {
            pdf.addPage();
          }
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, Math.min(imgHeightPt, pageHeight));
          pageIndex += 1;
        }
      } finally {
        document.body.removeChild(pageContainer);
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(measureContainer);
  }
}
