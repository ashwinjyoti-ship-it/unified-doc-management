import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';

const tags = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

async function checkWorkspaceAccess(db: D1Database, workspaceId: string, userId: string): Promise<boolean> {
  const member = await db.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(workspaceId, userId).first();
  return !!member;
}

tags.get('/workspaces/:workspaceId/tags', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('workspaceId');
  if (!(await checkWorkspaceAccess(c.env.DB, workspaceId, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }
  const result = await c.env.DB.prepare(
    'SELECT * FROM tags WHERE workspace_id = ? ORDER BY name ASC'
  ).bind(workspaceId).all();
  return c.json({ tags: result.results });
});

tags.post('/workspaces/:workspaceId/tags', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('workspaceId');
  const { name, color } = await c.req.json<{ name: string; color?: string }>();
  if (!(await checkWorkspaceAccess(c.env.DB, workspaceId, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }
  const tagId = generateId();
  const now = Math.floor(Date.now() / 1000);
  try {
    await c.env.DB.prepare(
      'INSERT INTO tags (id, workspace_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(tagId, workspaceId, name.trim(), color || '#97B79E', now).run();
  } catch {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM tags WHERE workspace_id = ? AND name = ?'
    ).bind(workspaceId, name.trim()).first();
    return c.json({ tag: existing });
  }
  const tag = await c.env.DB.prepare('SELECT * FROM tags WHERE id = ?').bind(tagId).first();
  return c.json({ tag }, 201);
});

tags.get('/pages/:pageId/tags', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const result = await c.env.DB.prepare(`
    SELECT t.* FROM page_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.page_id = ?
  `).bind(pageId).all();
  return c.json({ tags: result.results });
});

tags.post('/pages/:pageId/tags', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const { tagId, name, color } = await c.req.json<{ tagId?: string; name?: string; color?: string }>();

  const page = await c.env.DB.prepare('SELECT workspace_id FROM pages WHERE id = ?').bind(pageId).first<{ workspace_id: string }>();
  if (!page) return c.json({ error: 'Page not found' }, 404);

  let resolvedTagId = tagId;
  if (!resolvedTagId && name) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM tags WHERE workspace_id = ? AND name = ?'
    ).bind(page.workspace_id, name.trim()).first<{ id: string }>();
    if (existing) {
      resolvedTagId = existing.id;
    } else {
      resolvedTagId = generateId();
      const now = Math.floor(Date.now() / 1000);
      await c.env.DB.prepare(
        'INSERT INTO tags (id, workspace_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(resolvedTagId, page.workspace_id, name.trim(), color || '#97B79E', now).run();
    }
  }

  if (!resolvedTagId) return c.json({ error: 'tagId or name required' }, 400);

  await c.env.DB.prepare('INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)')
    .bind(pageId, resolvedTagId).run();

  const tag = await c.env.DB.prepare('SELECT * FROM tags WHERE id = ?').bind(resolvedTagId).first();
  return c.json({ tag });
});

tags.delete('/pages/:pageId/tags/:tagId', async (c) => {
  const pageId = c.req.param('pageId');
  const tagId = c.req.param('tagId');
  await c.env.DB.prepare('DELETE FROM page_tags WHERE page_id = ? AND tag_id = ?').bind(pageId, tagId).run();
  return c.json({ ok: true });
});

export default tags;
