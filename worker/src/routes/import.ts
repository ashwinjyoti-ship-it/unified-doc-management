import { Hono } from 'hono';
import type { Env, AuthContext, Page, Block } from '../types';
import { generateId, blocksToMarkdown, syncBacklinks } from '../utils';
import {
  docxToBlocks,
  markdownToImportBlocks,
  mergeImportBlocks,
  titleFromFilename,
  type ImportBlock,
  type ImportMode,
} from '../import-document';

const importRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

async function checkWorkspaceAccess(db: D1Database, workspaceId: string, userId: string): Promise<boolean> {
  const member = await db.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
  ).bind(workspaceId, userId).first();
  return !!member;
}

async function updatePageFts(db: D1Database, pageId: string, title: string, content: string) {
  await db.prepare('DELETE FROM pages_fts WHERE page_id = ?').bind(pageId).run();
  await db.prepare('INSERT INTO pages_fts (page_id, title, content) VALUES (?, ?, ?)')
    .bind(pageId, title, content).run();
}

async function savePageBlocks(
  env: Env,
  pageId: string,
  pageTitle: string,
  workspaceId: string,
  blocks: ImportBlock[],
  userId: string,
): Promise<Block[]> {
  const now = Math.floor(Date.now() / 1000);

  const existingBlocks = await env.DB.prepare('SELECT * FROM blocks WHERE page_id = ?').bind(pageId).all();
  await env.DB.prepare(
    'INSERT INTO page_versions (id, page_id, title, blocks_snapshot, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(generateId(), pageId, pageTitle, JSON.stringify(existingBlocks.results), userId, now).run();

  await env.DB.prepare('DELETE FROM blocks WHERE page_id = ?').bind(pageId).run();

  for (const block of blocks) {
    await env.DB.prepare(
      'INSERT INTO blocks (id, page_id, parent_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      generateId(),
      pageId,
      null,
      block.type,
      JSON.stringify(block.content),
      block.orderIndex,
      now,
      now,
    ).run();
  }

  const md = blocksToMarkdown(blocks.map((b) => ({ type: b.type, content: JSON.stringify(b.content) })));
  await env.DB.prepare('UPDATE pages SET content_md = ?, updated_at = ? WHERE id = ?').bind(md, now, pageId).run();
  await updatePageFts(env.DB, pageId, pageTitle, md);
  await syncBacklinks(env.DB, pageId, workspaceId, md);

  const roomId = env.COLLAB_ROOM.idFromName(pageId);
  const room = env.COLLAB_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'blocks_updated', payload: { pageId, blocks } }),
  }));

  const saved = await env.DB.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index').bind(pageId).all<Block>();
  return saved.results || [];
}

function parseMode(value: string | undefined, pageId?: string): ImportMode {
  if (value === 'append' || value === 'overwrite' || value === 'new') return value;
  return pageId ? 'overwrite' : 'new';
}

function isDocxName(name: string): boolean {
  return /\.docx?$/i.test(name);
}

function isDocxBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

importRoutes.post('/import-document', async (c) => {
  const auth = c.get('auth');
  const contentType = c.req.header('content-type') || '';

  let workspaceId: string | undefined;
  let pageId: string | undefined;
  let mode: ImportMode = 'new';
  let title: string | undefined;
  let parentId: string | null | undefined;
  let format: 'docx' | 'markdown' | undefined;
  let markdown: string | undefined;
  let docxBuffer: ArrayBuffer | undefined;
  let sourceName = 'imported';

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData();
    const file = form.get('file');
    workspaceId = String(form.get('workspaceId') || '');
    pageId = form.get('pageId') ? String(form.get('pageId')) : undefined;
    mode = parseMode(form.get('mode') ? String(form.get('mode')) : undefined, pageId);
    title = form.get('title') ? String(form.get('title')) : undefined;
    parentId = form.get('parentId') ? String(form.get('parentId')) : null;

    if (file instanceof File) {
      sourceName = file.name;
      const buffer = await file.arrayBuffer();
      if (isDocxName(file.name) || isDocxBuffer(buffer)) {
        docxBuffer = buffer;
        format = 'docx';
      } else {
        markdown = new TextDecoder().decode(buffer);
        format = 'markdown';
      }
    }
  } else {
    const body = await c.req.json<{
      workspaceId: string;
      pageId?: string;
      mode?: ImportMode;
      title?: string;
      parentId?: string | null;
      format?: 'docx' | 'markdown';
      base64?: string;
      markdown?: string;
      filename?: string;
    }>();

    workspaceId = body.workspaceId;
    pageId = body.pageId;
    mode = parseMode(body.mode, pageId);
    title = body.title;
    parentId = body.parentId ?? null;
    sourceName = body.filename || 'imported';

    if (body.format === 'docx' || body.base64) {
      if (!body.base64) return c.json({ error: 'base64 required for docx import' }, 400);
      docxBuffer = decodeBase64ToBuffer(body.base64);
      format = 'docx';
    } else if (body.markdown) {
      markdown = body.markdown;
      format = 'markdown';
    }
  }

  if (!workspaceId) return c.json({ error: 'workspaceId required' }, 400);
  if (!(await checkWorkspaceAccess(c.env.DB, workspaceId, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }
  if (!docxBuffer && !markdown) {
    return c.json({ error: 'Provide a .docx file, markdown file, base64 docx, or markdown body' }, 400);
  }

  let parsedBlocks: Array<{ type: string; content: object }>;
  let imagesUploaded = 0;

  if (format === 'docx' && docxBuffer) {
    const result = await docxToBlocks(docxBuffer, c.env.UPLOADS, auth.user.id);
    parsedBlocks = result.blocks;
    imagesUploaded = result.imagesUploaded;
  } else {
    const result = await markdownToImportBlocks(markdown || '', c.env.UPLOADS, auth.user.id);
    parsedBlocks = result.blocks;
    imagesUploaded = result.imagesUploaded;
  }

  const now = Math.floor(Date.now() / 1000);
  let page: Page | null = null;
  let existingBlocks: ImportBlock[] = [];

  if (pageId) {
    page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
    if (!page) return c.json({ error: 'Page not found' }, 404);
    if (page.workspace_id !== workspaceId) return c.json({ error: 'Page not in workspace' }, 400);
    if (page.type !== 'page') return c.json({ error: 'Import only supported on document pages' }, 400);

    const rows = await c.env.DB.prepare(
      'SELECT type, content, order_index FROM blocks WHERE page_id = ? ORDER BY order_index',
    ).bind(pageId).all<{ type: string; content: string; order_index: number }>();
    existingBlocks = (rows.results || []).map((row) => ({
      type: row.type,
      content: JSON.parse(row.content || '{}'),
      orderIndex: row.order_index,
    }));
  } else {
    if (mode === 'append' || mode === 'overwrite') {
      return c.json({ error: 'pageId required for append/overwrite mode' }, 400);
    }
    const newPageId = generateId();
    const pageTitle = title || titleFromFilename(sourceName);
    await c.env.DB.prepare(`
      INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'page', 'private', ?, ?, ?)
    `).bind(newPageId, workspaceId, parentId ?? null, pageTitle, '📄', auth.user.id, now, now).run();
    await updatePageFts(c.env.DB, newPageId, pageTitle, '');
    page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(newPageId).first<Page>();
    pageId = newPageId;
    mode = 'overwrite';
  }

  const finalBlocks = mergeImportBlocks(existingBlocks, parsedBlocks, mode);
  const savedBlocks = await savePageBlocks(
    c.env,
    pageId!,
    page!.title,
    workspaceId,
    finalBlocks,
    auth.user.id,
  );

  return c.json({
    page,
    blocks: savedBlocks,
    imagesUploaded,
    mode,
    hint: imagesUploaded > 0
      ? `Uploaded ${imagesUploaded} embedded image(s) from the document (flowcharts/diagrams render as images).`
      : 'No embedded images found. Word flowcharts are preserved when exported as images inside the .docx.',
  }, page?.created_at === now ? 201 : 200);
});

function decodeBase64ToBuffer(base64: string): ArrayBuffer {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export default importRoutes;
