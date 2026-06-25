/** Client-side markdown → block conversion (mirrors worker/src/utils.ts markdownToBlocks). */

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

export function blocksToTiptapHtml(blocks: Array<{ type: string; content: string }>): string {
  const parts: string[] = [];

  for (const block of blocks) {
    const content = JSON.parse(block.content || '{}');
    switch (block.type) {
      case 'heading1':
        parts.push(`<h1>${escapeHtml(content.text || '')}</h1>`);
        break;
      case 'heading2':
        parts.push(`<h2>${escapeHtml(content.text || '')}</h2>`);
        break;
      case 'heading3':
        parts.push(`<h3>${escapeHtml(content.text || '')}</h3>`);
        break;
      case 'bulletList':
        parts.push(`<ul>${(content.items || []).map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
        break;
      case 'numberedList':
        parts.push(`<ol>${(content.items || []).map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`);
        break;
      case 'todo':
        parts.push(`<ul data-type="taskList"><li data-type="taskItem" data-checked="${content.checked}">${escapeHtml(content.text || '')}</li></ul>`);
        break;
      case 'code':
        parts.push(`<pre><code>${escapeHtml(content.code || '')}</code></pre>`);
        break;
      case 'quote':
        parts.push(`<blockquote><p>${escapeHtml(content.text || '')}</p></blockquote>`);
        break;
      case 'divider':
        parts.push('<hr>');
        break;
      case 'image':
        parts.push(`<img src="${content.url || ''}" alt="${content.alt || ''}" />`);
        break;
      default:
        parts.push(`<p>${escapeHtml(content.text || '')}</p>`);
    }
  }

  return parts.join('') || '<p></p>';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
