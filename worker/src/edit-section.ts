import type { Block } from './types';
import { blocksToMarkdown, markdownToBlocks, generateId, syncBacklinks } from './utils';

export class EditSectionError extends Error {
  constructor(
    public code: 'not_found' | 'ambiguous' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'EditSectionError';
  }
}

export type EditOccurrence = 'first' | 'all' | number;

export function countMatches(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

function findNthIndex(haystack: string, needle: string, n: number): number {
  if (n < 1) return -1;
  let pos = 0;
  for (let i = 0; i < n; i++) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) return -1;
    if (i === n - 1) return idx;
    pos = idx + needle.length;
  }
  return -1;
}

export function replaceInString(
  content: string,
  oldText: string,
  newText: string,
  occurrence: EditOccurrence = 'first',
  requireUnique = false,
): { content: string; replaced: number; match_count: number } {
  if (!oldText) {
    throw new EditSectionError('invalid', 'old_text is required');
  }

  const match_count = countMatches(content, oldText);
  if (match_count === 0) {
    throw new EditSectionError('not_found', 'old_text not found in page content');
  }
  if (requireUnique && match_count > 1) {
    throw new EditSectionError(
      'ambiguous',
      `old_text matches ${match_count} times; use a longer quote, set occurrence, or pass require_unique: false`,
    );
  }

  if (occurrence === 'all') {
    return {
      content: content.split(oldText).join(newText),
      replaced: match_count,
      match_count,
    };
  }

  const index = typeof occurrence === 'number'
    ? findNthIndex(content, oldText, occurrence)
    : content.indexOf(oldText);

  if (index === -1) {
    throw new EditSectionError('not_found', 'old_text not found at the requested occurrence');
  }

  return {
    content: content.slice(0, index) + newText + content.slice(index + oldText.length),
    replaced: 1,
    match_count,
  };
}

function blockPlainText(block: Block): string | null {
  let content: Record<string, unknown>;
  try {
    content = JSON.parse(block.content || '{}');
  } catch {
    return null;
  }

  switch (block.type) {
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'paragraph':
    case 'quote':
      return typeof content.text === 'string' ? content.text : null;
    case 'todo':
      return typeof content.text === 'string' ? content.text : null;
    case 'bulletList':
    case 'numberedList':
      return Array.isArray(content.items) ? (content.items as string[]).join('\n') : null;
    case 'code':
      return typeof content.code === 'string' ? content.code : null;
    default:
      return null;
  }
}

function replaceAllInBlock(block: Block, oldText: string, newText: string): Block | null {
  let content: Record<string, unknown>;
  try {
    content = JSON.parse(block.content || '{}');
  } catch {
    return null;
  }

  switch (block.type) {
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'paragraph':
    case 'quote':
      if (typeof content.text !== 'string' || !content.text.includes(oldText)) return null;
      return { ...block, content: JSON.stringify({ ...content, text: content.text.split(oldText).join(newText) }) };
    case 'todo':
      if (typeof content.text !== 'string' || !content.text.includes(oldText)) return null;
      return { ...block, content: JSON.stringify({ ...content, text: content.text.split(oldText).join(newText) }) };
    case 'bulletList':
    case 'numberedList': {
      if (!Array.isArray(content.items)) return null;
      const items = content.items as string[];
      const joined = items.join('\n');
      if (!joined.includes(oldText)) return null;
      return { ...block, content: JSON.stringify({ ...content, items: joined.split(oldText).join(newText).split('\n') }) };
    }
    case 'code':
      if (typeof content.code !== 'string' || !content.code.includes(oldText)) return null;
      return { ...block, content: JSON.stringify({ ...content, code: content.code.split(oldText).join(newText) }) };
    default:
      return null;
  }
}

function setBlockPlainText(block: Block, newText: string, oldText: string): Block | null {
  let content: Record<string, unknown>;
  try {
    content = JSON.parse(block.content || '{}');
  } catch {
    return null;
  }

  switch (block.type) {
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'paragraph':
    case 'quote':
      if (typeof content.text !== 'string' || !content.text.includes(oldText)) return null;
      return { ...block, content: JSON.stringify({ ...content, text: content.text.replace(oldText, newText) }) };
    case 'todo':
      if (typeof content.text !== 'string' || !content.text.includes(oldText)) return null;
      return { ...block, content: JSON.stringify({ ...content, text: content.text.replace(oldText, newText) }) };
    case 'bulletList':
    case 'numberedList': {
      if (!Array.isArray(content.items)) return null;
      const items = content.items as string[];
      const joined = items.join('\n');
      if (!joined.includes(oldText)) return null;
      const newJoined = joined.replace(oldText, newText);
      return { ...block, content: JSON.stringify({ ...content, items: newJoined.split('\n') }) };
    }
    case 'code':
      if (typeof content.code !== 'string' || !content.code.includes(oldText)) return null;
      return { ...block, content: JSON.stringify({ ...content, code: content.code.replace(oldText, newText) }) };
    default:
      return null;
  }
}

export function replaceInBlocks(
  blocks: Block[],
  oldText: string,
  newText: string,
  occurrence: EditOccurrence = 'first',
  requireUnique = false,
): { blocks: Block[]; replaced: number; match_count: number; via: 'blocks' } {
  const matches: Array<{ index: number; text: string }> = [];
  blocks.forEach((block, index) => {
    const text = blockPlainText(block);
    if (text && text.includes(oldText)) {
      matches.push({ index, text });
    }
  });

  const match_count = matches.reduce((sum, m) => sum + countMatches(m.text, oldText), 0);
  if (match_count === 0) {
    throw new EditSectionError('not_found', 'old_text not found in page blocks');
  }
  if (requireUnique && match_count > 1) {
    throw new EditSectionError(
      'ambiguous',
      `old_text matches ${match_count} times across blocks; use a longer quote or set occurrence`,
    );
  }

  if (occurrence === 'all') {
    let replaced = 0;
    const updated = blocks.map((block) => {
      const text = blockPlainText(block);
      if (!text || !text.includes(oldText)) return block;
      replaced += countMatches(text, oldText);
      return replaceAllInBlock(block, oldText, newText) ?? block;
    });
    if (replaced === 0) {
      throw new EditSectionError('not_found', 'old_text not found in page blocks');
    }
    return { blocks: updated, replaced, match_count, via: 'blocks' };
  }

  const targetIndex = typeof occurrence === 'number' ? occurrence - 1 : 0;
  let seen = 0;
  for (let i = 0; i < blocks.length; i++) {
    const text = blockPlainText(blocks[i]);
    if (!text || !text.includes(oldText)) continue;
    const blockMatches = countMatches(text, oldText);
    if (seen + blockMatches <= targetIndex) {
      seen += blockMatches;
      continue;
    }
    const updated = setBlockPlainText(blocks[i], newText, oldText);
    if (!updated) break;
    const nextBlocks = [...blocks];
    nextBlocks[i] = updated;
    return { blocks: nextBlocks, replaced: 1, match_count, via: 'blocks' };
  }

  throw new EditSectionError('not_found', 'old_text not found at the requested occurrence');
}

export async function savePageMarkdown(
  db: D1Database,
  env: { COLLAB_ROOM: DurableObjectNamespace },
  pageId: string,
  pageTitle: string,
  workspaceId: string,
  markdown: string,
  userId: string,
  existingBlocks?: Block[],
): Promise<Block[]> {
  const now = Math.floor(Date.now() / 1000);
  const prior = existingBlocks ?? (await db.prepare(
    'SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index ASC',
  ).bind(pageId).all<Block>()).results ?? [];

  await db.prepare(
    'INSERT INTO page_versions (id, page_id, title, blocks_snapshot, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(generateId(), pageId, pageTitle, JSON.stringify(prior), userId, now).run();

  const parsed = markdownToBlocks(markdown);
  await db.prepare('DELETE FROM blocks WHERE page_id = ?').bind(pageId).run();
  for (let i = 0; i < parsed.length; i++) {
    await db.prepare(
      'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(generateId(), pageId, parsed[i].type, JSON.stringify(parsed[i].content), i, now, now).run();
  }

  await db.prepare('UPDATE pages SET content_md = ?, updated_at = ? WHERE id = ?').bind(markdown, now, pageId).run();
  await db.prepare('DELETE FROM pages_fts WHERE page_id = ?').bind(pageId).run();
  await db.prepare('INSERT INTO pages_fts (page_id, title, content) VALUES (?, ?, ?)').bind(pageId, pageTitle, markdown).run();
  await syncBacklinks(db, pageId, workspaceId, markdown);

  const saved = await db.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index ASC').bind(pageId).all<Block>();

  const roomId = env.COLLAB_ROOM.idFromName(pageId);
  const room = env.COLLAB_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'blocks_updated', payload: { pageId, blocks: saved.results } }),
  }));

  return saved.results ?? [];
}

export async function savePageBlocks(
  db: D1Database,
  env: { COLLAB_ROOM: DurableObjectNamespace },
  pageId: string,
  pageTitle: string,
  workspaceId: string,
  blocks: Block[],
  userId: string,
  priorBlocks?: Block[],
): Promise<Block[]> {
  const now = Math.floor(Date.now() / 1000);
  const prior = priorBlocks ?? (await db.prepare(
    'SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index ASC',
  ).bind(pageId).all<Block>()).results ?? [];

  await db.prepare(
    'INSERT INTO page_versions (id, page_id, title, blocks_snapshot, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(generateId(), pageId, pageTitle, JSON.stringify(prior), userId, now).run();

  await db.prepare('DELETE FROM blocks WHERE page_id = ?').bind(pageId).run();
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    await db.prepare(
      'INSERT INTO blocks (id, page_id, parent_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      block.id || generateId(),
      pageId,
      block.parent_id || null,
      block.type,
      block.content,
      block.order_index ?? i,
      now,
      now,
    ).run();
  }

  const md = blocksToMarkdown(blocks.map((b) => ({ type: b.type, content: b.content })));
  await db.prepare('UPDATE pages SET content_md = ?, updated_at = ? WHERE id = ?').bind(md, now, pageId).run();
  await db.prepare('DELETE FROM pages_fts WHERE page_id = ?').bind(pageId).run();
  await db.prepare('INSERT INTO pages_fts (page_id, title, content) VALUES (?, ?, ?)').bind(pageId, pageTitle, md).run();
  await syncBacklinks(db, pageId, workspaceId, md);

  const saved = await db.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index ASC').bind(pageId).all<Block>();

  const roomId = env.COLLAB_ROOM.idFromName(pageId);
  const room = env.COLLAB_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'blocks_updated', payload: { pageId, blocks: saved.results } }),
  }));

  return saved.results ?? [];
}

export async function editPageSection(
  db: D1Database,
  env: { COLLAB_ROOM: DurableObjectNamespace },
  pageId: string,
  pageTitle: string,
  workspaceId: string,
  userId: string,
  oldText: string,
  newText: string,
  occurrence: EditOccurrence = 'first',
  requireUnique = false,
): Promise<{ replaced: number; match_count: number; via: 'markdown' | 'blocks' }> {
  const existingBlocks = await db.prepare(
    'SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index ASC',
  ).bind(pageId).all<Block>();
  const blocks = existingBlocks.results ?? [];
  const markdown = blocksToMarkdown(blocks.map((b) => ({ type: b.type, content: b.content })));

  try {
    const result = replaceInString(markdown, oldText, newText, occurrence, requireUnique);
    await savePageMarkdown(db, env, pageId, pageTitle, workspaceId, result.content, userId, blocks);
    return { replaced: result.replaced, match_count: result.match_count, via: 'markdown' };
  } catch (err) {
    if (!(err instanceof EditSectionError) || err.code !== 'not_found') {
      throw err;
    }
  }

  const blockResult = replaceInBlocks(blocks, oldText, newText, occurrence, requireUnique);
  await savePageBlocks(db, env, pageId, pageTitle, workspaceId, blockResult.blocks, userId, blocks);
  return { replaced: blockResult.replaced, match_count: blockResult.match_count, via: 'blocks' };
}
