import mammoth from 'mammoth';
import { parse, type HTMLElement } from 'node-html-parser';
import { generateId, markdownToBlocks } from './utils';

export type ImportBlock = { type: string; content: object; orderIndex: number };
export type ImportMode = 'new' | 'append' | 'overwrite';

const DATA_URI_RE = /data:([\w+/.-]+);base64,([A-Za-z0-9+/=]+)/g;

export async function uploadBytes(
  uploads: R2Bucket,
  userId: string,
  bytes: Uint8Array,
  contentType: string,
  filename: string,
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${userId}/${generateId()}-${safeName}`;
  await uploads.put(key, bytes, {
    httpMetadata: { contentType: contentType || 'application/octet-stream' },
  });
  return `/api/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/emf': 'emf',
    'image/wmf': 'wmf',
  };
  return map[mime] || 'bin';
}

/** Upload embedded data: URIs (e.g. from Word/Mermaid) and return hosted URLs. */
export async function resolveDataUrisInText(
  text: string,
  uploads: R2Bucket,
  userId: string,
): Promise<{ text: string; imagesUploaded: number }> {
  let imagesUploaded = 0;
  const replaced = await replaceAsync(text, DATA_URI_RE, async (match, mime: string, base64: string) => {
    const bytes = decodeBase64(base64);
    const ext = extensionForMime(mime);
    const url = await uploadBytes(uploads, userId, bytes, mime, `embedded.${ext}`);
    imagesUploaded++;
    return url;
  });
  return { text: replaced, imagesUploaded };
}

async function replaceAsync(
  input: string,
  regex: RegExp,
  replacer: (...args: string[]) => Promise<string>,
): Promise<string> {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    parts.push(input.slice(lastIndex, match.index));
    parts.push(await replacer(...(match as unknown as string[])));
    lastIndex = match.index + match[0].length;
  }
  parts.push(input.slice(lastIndex));
  return parts.join('');
}

function inlineText(node: HTMLElement): string {
  const parts: string[] = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      parts.push(child.text || '');
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    const inner = inlineText(el);
    if (tag === 'strong' || tag === 'b') parts.push(`**${inner}**`);
    else if (tag === 'em' || tag === 'i') parts.push(`*${inner}*`);
    else if (tag === 'br') parts.push('\n');
    else if (tag === 'a') parts.push(inner);
    else parts.push(inner);
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function tableToContent(table: HTMLElement): { rows: string[][] } {
  const rows: string[][] = [];
  for (const tr of table.querySelectorAll('tr')) {
    const cells = tr.querySelectorAll('th,td').map((cell) => inlineText(cell));
    if (cells.length) rows.push(cells);
  }
  return { rows };
}

export function htmlToBlocks(html: string): Array<{ type: string; content: object }> {
  const root = parse(html, { blockTextElements: { script: false, style: false, pre: true } });
  const container = root.querySelector('body') || root;
  const blocks: Array<{ type: string; content: object }> = [];

  const pushParagraph = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) blocks.push({ type: 'paragraph', content: { text: trimmed } });
  };

  const walk = (node: HTMLElement) => {
    const tag = node.tagName?.toLowerCase();
    if (!tag) return;

    if (tag === 'h1') return blocks.push({ type: 'heading1', content: { text: inlineText(node) } });
    if (tag === 'h2') return blocks.push({ type: 'heading2', content: { text: inlineText(node) } });
    if (tag === 'h3') return blocks.push({ type: 'heading3', content: { text: inlineText(node) } });
    if (tag === 'h4') return blocks.push({ type: 'heading4', content: { text: inlineText(node) } });

    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (src) blocks.push({ type: 'image', content: { url: src, alt: node.getAttribute('alt') || '' } });
      return;
    }

    if (tag === 'p') {
      const img = node.querySelector('img');
      if (img && node.childNodes.length === 1) {
        const src = img.getAttribute('src') || '';
        if (src) {
          blocks.push({ type: 'image', content: { url: src, alt: img.getAttribute('alt') || '' } });
          return;
        }
      }
      const text = inlineText(node);
      if (text) pushParagraph(text);
      return;
    }

    if (tag === 'ul') {
      const items = node.querySelectorAll(':scope > li').map((li) => inlineText(li));
      if (items.length) blocks.push({ type: 'bulletList', content: { items } });
      return;
    }

    if (tag === 'ol') {
      const items = node.querySelectorAll(':scope > li').map((li) => inlineText(li));
      if (items.length) blocks.push({ type: 'numberedList', content: { items } });
      return;
    }

    if (tag === 'blockquote') {
      const text = inlineText(node);
      if (text) blocks.push({ type: 'quote', content: { text } });
      return;
    }

    if (tag === 'pre') {
      const code = node.querySelector('code');
      const text = code ? inlineText(code) : inlineText(node);
      blocks.push({ type: 'code', content: { language: '', code: text } });
      return;
    }

    if (tag === 'hr') {
      blocks.push({ type: 'divider', content: {} });
      return;
    }

    if (tag === 'table') {
      const content = tableToContent(node);
      if (content.rows.length) blocks.push({ type: 'table', content });
      return;
    }

    if (tag === 'div' || tag === 'section' || tag === 'article') {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) walk(child as HTMLElement);
        else if (child.nodeType === 3 && child.text?.trim()) pushParagraph(child.text.trim());
      }
      return;
    }

    const text = inlineText(node);
    if (text) pushParagraph(text);
  };

  for (const child of container.childNodes) {
    if (child.nodeType === 1) walk(child as HTMLElement);
    else if (child.nodeType === 3 && child.text?.trim()) pushParagraph(child.text.trim());
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: { text: '' } });
  }

  return blocks;
}

export async function docxToBlocks(
  buffer: ArrayBuffer,
  uploads: R2Bucket,
  userId: string,
): Promise<{ blocks: Array<{ type: string; content: object }>; imagesUploaded: number }> {
  let imagesUploaded = 0;

  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read('base64');
        const mime = image.contentType || 'image/png';
        const bytes = decodeBase64(base64);
        const ext = extensionForMime(mime);
        const url = await uploadBytes(uploads, userId, bytes, mime, `word-image.${ext}`);
        imagesUploaded++;
        return { src: url, alt: 'Diagram' };
      }),
    },
  );

  const blocks = htmlToBlocks(result.value);
  return { blocks, imagesUploaded };
}

export async function markdownToImportBlocks(
  markdown: string,
  uploads: R2Bucket,
  userId: string,
): Promise<{ blocks: Array<{ type: string; content: object }>; imagesUploaded: number }> {
  const { text, imagesUploaded } = await resolveDataUrisInText(markdown, uploads, userId);
  const blocks = markdownToBlocks(text);
  return { blocks, imagesUploaded };
}

export function withOrderIndex(blocks: Array<{ type: string; content: object }>, start = 0): ImportBlock[] {
  return blocks.map((block, index) => ({ ...block, orderIndex: start + index }));
}

export function mergeImportBlocks(
  existing: ImportBlock[],
  incoming: Array<{ type: string; content: object }>,
  mode: ImportMode,
): ImportBlock[] {
  const normalized = incoming.map((b) => ({ type: b.type, content: b.content }));
  if (mode === 'overwrite' || existing.length === 0) {
    return withOrderIndex(normalized);
  }
  const divider = existing.length > 0 ? [{ type: 'divider', content: {} }] : [];
  return withOrderIndex([
    ...existing.map(({ type, content }) => ({ type, content })),
    ...divider,
    ...normalized,
  ]);
}

export function titleFromFilename(filename: string): string {
  return filename.replace(/\.(docx|doc|md|markdown|txt)$/i, '').trim() || 'Imported';
}
