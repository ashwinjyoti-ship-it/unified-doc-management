import type { DatabaseProperty, DatabaseRow, Page } from '../types';
import { getPropValue, getRowTitle } from './databaseFilters';
import { getChildren, pageIcon } from './pageTree';

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

export function markdownToPdf(doc: { setFontSize: (n: number) => void; text: (t: string, x: number, y: number) => void; splitTextToSize: (t: string, w: number) => string[]; addPage: () => void }, title: string, markdown: string) {
  doc.setFontSize(16);
  doc.text(title || 'Untitled', 10, 15);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(markdown, 180);
  let y = 25;
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 15;
    }
    doc.text(line, 10, y);
    y += 5;
  }
}
