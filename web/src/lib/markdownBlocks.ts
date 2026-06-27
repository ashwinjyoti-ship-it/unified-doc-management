/** Client-side markdown → block conversion (mirrors worker/src/utils.ts markdownToBlocks). */

import { wikiLinksToHtml } from './pageLinks';

export function markdownToBlocks(md: string): Array<{ type: string; content: object }> {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Array<{ type: string; content: object }> = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading1', content: { text: line.slice(2) } });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'heading2', content: { text: line.slice(3) } });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'heading3', content: { text: line.slice(4) } });
    } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      blocks.push({
        type: 'todo',
        content: { text: line.slice(6), checked: line.startsWith('- [x]') },
      });
    } else if (line.startsWith('- ')) {
      const items = [line.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].startsWith('- ')) {
        i++;
        items.push(lines[i].slice(2));
      }
      blocks.push({ type: 'bulletList', content: { items } });
    } else if (/^\d+\. /.test(line)) {
      const items = [line.replace(/^\d+\. /, '')];
      while (i + 1 < lines.length && /^\d+\. /.test(lines[i + 1])) {
        i++;
        items.push(lines[i].replace(/^\d+\. /, ''));
      }
      blocks.push({ type: 'numberedList', content: { items } });
    } else if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', content: { language: lang, code: codeLines.join('\n') } });
    } else if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', content: { text: line.slice(2) } });
    } else if (line === '---') {
      blocks.push({ type: 'divider', content: {} });
    } else if (line.trim()) {
      blocks.push({ type: 'paragraph', content: { text: line } });
    }
    i++;
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: { text: '' } });
  }

  return blocks;
}

export function blocksToTiptapHtml(
  blocks: Array<{ type: string; content: string }>,
  resolvePageId?: (title: string) => string | undefined,
): string {
  const inline = (text: string) => wikiLinksToHtml(text || '', resolvePageId);
  const parts: string[] = [];

  for (const block of blocks) {
    const content = JSON.parse(block.content || '{}');
    switch (block.type) {
      case 'heading1':
        parts.push(`<h1>${inline(content.text)}</h1>`);
        break;
      case 'heading2':
        parts.push(`<h2>${inline(content.text)}</h2>`);
        break;
      case 'heading3':
        parts.push(`<h3>${inline(content.text)}</h3>`);
        break;
      case 'bulletList':
        parts.push(`<ul>${(content.items || []).map((item: string) => `<li>${inline(item)}</li>`).join('')}</ul>`);
        break;
      case 'numberedList':
        parts.push(`<ol>${(content.items || []).map((item: string) => `<li>${inline(item)}</li>`).join('')}</ol>`);
        break;
      case 'todo':
        parts.push(`<ul data-type="taskList"><li data-type="taskItem" data-checked="${content.checked}">${inline(content.text)}</li></ul>`);
        break;
      case 'code':
        parts.push(`<pre><code>${escapeHtml(content.code || '')}</code></pre>`);
        break;
      case 'quote':
        parts.push(`<blockquote><p>${inline(content.text)}</p></blockquote>`);
        break;
      case 'callout': {
        const icon = escapeAttr(content.icon || '💡');
        const inner = (content.blocks as Array<{ type: string; content: Record<string, unknown> }> || [])
          .map((b) => nestedBlockToHtml(b, inline))
          .join('');
        parts.push(`<div data-type="callout" data-icon="${icon}" class="callout-box">${inner || '<p></p>'}</div>`);
        break;
      }
      case 'divider':
        parts.push('<hr>');
        break;
      case 'image':
        parts.push(`<img src="${content.url || ''}" alt="${content.alt || ''}" />`);
        break;
      case 'database_embed':
        parts.push(
          `<div data-type="database-embed" data-database-id="${escapeAttr(content.databaseId || '')}" data-title="${escapeAttr(content.title || 'Database')}"></div>`,
        );
        break;
      default:
        parts.push(`<p>${inline(content.text)}</p>`);
    }
  }

  return parts.join('') || '<p></p>';
}

function nestedBlockToHtml(
  block: { type: string; content: Record<string, unknown> },
  inline: (text: string) => string,
): string {
  const content = block.content;
  switch (block.type) {
    case 'heading1':
      return `<h1>${inline(String(content.text || ''))}</h1>`;
    case 'heading2':
      return `<h2>${inline(String(content.text || ''))}</h2>`;
    case 'heading3':
      return `<h3>${inline(String(content.text || ''))}</h3>`;
    case 'bulletList':
      return `<ul>${((content.items as string[]) || []).map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`;
    case 'numberedList':
      return `<ol>${((content.items as string[]) || []).map((item) => `<li>${inline(item)}</li>`).join('')}</ol>`;
    case 'todo':
      return `<ul data-type="taskList"><li data-type="taskItem" data-checked="${content.checked}">${inline(String(content.text || ''))}</li></ul>`;
    case 'code':
      return `<pre><code>${escapeHtml(String(content.code || ''))}</code></pre>`;
    case 'quote':
      return `<blockquote><p>${inline(String(content.text || ''))}</p></blockquote>`;
    case 'divider':
      return '<hr>';
    default:
      return `<p>${inline(String(content.text || ''))}</p>`;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

export function markdownToTiptapHtml(markdown: string): string {
  const blocks = markdownToBlocks(markdown);
  return blocksToTiptapHtml(
    blocks.map((block) => ({ type: block.type, content: JSON.stringify(block.content) })),
  );
}

export function plainTextToTiptapHtml(text: string): string {
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n{2,}/).filter((p) => p.trim());
  if (paragraphs.length === 0) return '<p></p>';
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
