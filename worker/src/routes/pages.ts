import { Hono } from 'hono';
import type { Env, AuthContext, Page, Block } from '../types';
import { generateId, blocksToMarkdown, markdownToBlocks, isPageDescendant, syncBacklinks } from '../utils';
import { syncRowPageTitle } from '../database-helpers';

const pages = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

async function checkWorkspaceAccess(db: D1Database, workspaceId: string, userId: string): Promise<boolean> {
  const member = await db.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(workspaceId, userId).first();
  return !!member;
}

async function updatePageFts(db: D1Database, pageId: string, title: string, content: string) {
  await db.prepare('DELETE FROM pages_fts WHERE page_id = ?').bind(pageId).run();
  await db.prepare('INSERT INTO pages_fts (page_id, title, content) VALUES (?, ?, ?)')
    .bind(pageId, title, content).run();
}

pages.get('/workspaces', async (c) => {
  const auth = c.get('auth');
  const workspaces = await c.env.DB.prepare(`
    SELECT w.*, wm.role FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
    ORDER BY w.updated_at DESC
  `).bind(auth.user.id).all();
  return c.json({ workspaces: workspaces.results });
});

pages.patch('/workspaces/:workspaceId', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('workspaceId');
  const body = await c.req.json<{ name?: string }>();

  if (!(await checkWorkspaceAccess(c.env.DB, workspaceId, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  if (!body.name?.trim()) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?'
  ).bind(body.name.trim(), now, workspaceId).run();

  const workspace = await c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspaceId).first();
  return c.json({ workspace });
});

pages.get('/workspaces/:workspaceId/pages', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('workspaceId');

  if (!(await checkWorkspaceAccess(c.env.DB, workspaceId, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const result = await c.env.DB.prepare(
    'SELECT * FROM pages WHERE workspace_id = ? ORDER BY type DESC, title ASC'
  ).bind(workspaceId).all<Page>();

  return c.json({ pages: result.results });
});

pages.post('/workspaces/:workspaceId/pages', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('workspaceId');
  const body = await c.req.json<{ title?: string; parentId?: string; type?: string; icon?: string }>();

  if (!(await checkWorkspaceAccess(c.env.DB, workspaceId, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const pageId = generateId();
  const now = Math.floor(Date.now() / 1000);
  const title = body.title || 'Untitled';
  const type = body.type || 'page';

  await c.env.DB.prepare(`
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'private', ?, ?, ?)
  `).bind(pageId, workspaceId, body.parentId || null, title, body.icon || null, type, auth.user.id, now, now).run();

  if (type === 'page') {
    await c.env.DB.prepare(
      'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), pageId, 'paragraph', JSON.stringify({ text: '' }), 0, now, now).run();
  }

  if (type === 'database') {
    const props = [
      { name: 'Name', type: 'text' },
      { name: 'Status', type: 'select', options: ['To Do', 'In Progress', 'Done'] },
      { name: 'Due Date', type: 'date' },
    ];
    for (let i = 0; i < props.length; i++) {
      await c.env.DB.prepare(
        'INSERT INTO database_properties (id, database_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(generateId(), pageId, props[i].name, props[i].type, JSON.stringify(props[i].options || []), i).run();
    }
  }

  await updatePageFts(c.env.DB, pageId, title, '');

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  return c.json({ page }, 201);
});

pages.get('/pages/:pageId', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);

  if (page.visibility === 'private' && !(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const blocks = await c.env.DB.prepare(
    'SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index ASC'
  ).bind(pageId).all<Block>();

  const backlinks = await c.env.DB.prepare(`
    SELECT p.id, p.title, p.icon FROM backlinks b
    JOIN pages p ON b.source_page_id = p.id
    WHERE b.target_page_id = ?
  `).bind(pageId).all();

  return c.json({ page, blocks: blocks.results, backlinks: backlinks.results });
});

pages.patch('/pages/:pageId', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const body = await c.req.json<{ title?: string; icon?: string; parentId?: string; visibility?: string }>();

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const now = Math.floor(Date.now() / 1000);
  const title = body.title ?? page.title;
  const icon = body.icon ?? page.icon;
  let parentId = body.parentId !== undefined ? body.parentId : page.parent_id;
  const visibility = body.visibility ?? page.visibility;

  if (body.parentId !== undefined) {
    if (parentId === pageId) {
      return c.json({ error: 'A page cannot be its own parent' }, 400);
    }
    if (parentId && await isPageDescendant(c.env.DB, pageId, parentId)) {
      return c.json({ error: 'Cannot move a page into its own descendant' }, 400);
    }
  }

  await c.env.DB.prepare(
    'UPDATE pages SET title = ?, icon = ?, parent_id = ?, visibility = ?, updated_at = ? WHERE id = ?'
  ).bind(title, icon, parentId, visibility, now, pageId).run();

  await syncRowPageTitle(c.env.DB, pageId, title);

  const blocks = await c.env.DB.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index').bind(pageId).all<Block>();
  const md = blocksToMarkdown(blocks.results || []);
  await c.env.DB.prepare('UPDATE pages SET content_md = ? WHERE id = ?').bind(md, pageId).run();
  await updatePageFts(c.env.DB, pageId, title, md);

  const updated = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  return c.json({ page: updated });
});

pages.delete('/pages/:pageId', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(pageId).run();
  await c.env.DB.prepare('DELETE FROM pages_fts WHERE page_id = ?').bind(pageId).run();
  return c.json({ ok: true });
});

pages.put('/pages/:pageId/blocks', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const { blocks } = await c.req.json<{ blocks: Array<{ id?: string; type: string; content: object; parentId?: string; orderIndex: number }> }>();

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const now = Math.floor(Date.now() / 1000);

  // Save version snapshot
  const existingBlocks = await c.env.DB.prepare('SELECT * FROM blocks WHERE page_id = ?').bind(pageId).all();
  await c.env.DB.prepare(
    'INSERT INTO page_versions (id, page_id, title, blocks_snapshot, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(generateId(), pageId, page.title, JSON.stringify(existingBlocks.results), auth.user.id, now).run();

  await c.env.DB.prepare('DELETE FROM blocks WHERE page_id = ?').bind(pageId).run();

  for (const block of blocks) {
    const blockId = block.id || generateId();
    await c.env.DB.prepare(
      'INSERT INTO blocks (id, page_id, parent_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(blockId, pageId, block.parentId || null, block.type, JSON.stringify(block.content), block.orderIndex, now, now).run();
  }

  const md = blocksToMarkdown(blocks.map((b) => ({ type: b.type, content: JSON.stringify(b.content) })));
  await c.env.DB.prepare('UPDATE pages SET content_md = ?, updated_at = ? WHERE id = ?').bind(md, now, pageId).run();
  await updatePageFts(c.env.DB, pageId, page.title, md);
  await syncBacklinks(c.env.DB, pageId, page.workspace_id, md);

  // Broadcast to collab room
  const roomId = c.env.COLLAB_ROOM.idFromName(pageId);
  const room = c.env.COLLAB_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'blocks_updated', payload: { pageId, blocks } }),
  }));

  const saved = await c.env.DB.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index').bind(pageId).all();
  return c.json({ blocks: saved.results });
});

pages.get('/pages/:pageId/markdown', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const blocks = await c.env.DB.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index').bind(pageId).all<Block>();
  const md = blocksToMarkdown(blocks.results || []);
  return c.json({ markdown: md, title: page.title });
});

pages.put('/pages/:pageId/markdown', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const { markdown } = await c.req.json<{ markdown: string }>();

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const parsed = markdownToBlocks(markdown);
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare('DELETE FROM blocks WHERE page_id = ?').bind(pageId).run();
  for (let i = 0; i < parsed.length; i++) {
    await c.env.DB.prepare(
      'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), pageId, parsed[i].type, JSON.stringify(parsed[i].content), i, now, now).run();
  }

  await c.env.DB.prepare('UPDATE pages SET content_md = ?, updated_at = ? WHERE id = ?').bind(markdown, now, pageId).run();
  await updatePageFts(c.env.DB, pageId, page.title, markdown);
  await syncBacklinks(c.env.DB, pageId, page.workspace_id, markdown);

  const blocks = await c.env.DB.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index').bind(pageId).all();
  return c.json({ blocks: blocks.results });
});

pages.get('/pages/:pageId/versions', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const versions = await c.env.DB.prepare(`
    SELECT pv.*, u.name as author_name FROM page_versions pv
    JOIN users u ON pv.created_by = u.id
    WHERE pv.page_id = ? ORDER BY pv.created_at DESC LIMIT 50
  `).bind(pageId).all();

  return c.json({ versions: versions.results });
});

pages.post('/pages/:pageId/restore/:versionId', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const versionId = c.req.param('versionId');

  const version = await c.env.DB.prepare('SELECT * FROM page_versions WHERE id = ? AND page_id = ?')
    .bind(versionId, pageId).first<{ blocks_snapshot: string; title: string | null }>();

  if (!version) return c.json({ error: 'Version not found' }, 404);

  const snapshot = JSON.parse(version.blocks_snapshot) as Block[];
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare('DELETE FROM blocks WHERE page_id = ?').bind(pageId).run();
  for (const block of snapshot) {
    await c.env.DB.prepare(
      'INSERT INTO blocks (id, page_id, parent_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(block.id, pageId, block.parent_id, block.type, block.content, block.order_index, now, now).run();
  }

  if (version.title) {
    await c.env.DB.prepare('UPDATE pages SET title = ?, updated_at = ? WHERE id = ?').bind(version.title, now, pageId).run();
  }

  const blocks = await c.env.DB.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index').bind(pageId).all();
  return c.json({ blocks: blocks.results });
});

export default pages;
