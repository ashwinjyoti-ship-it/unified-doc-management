import { Hono } from 'hono';
import type { Env, AuthContext, Page, Block } from '../types';
import { generateId, blocksToMarkdown, markdownToBlocks } from '../utils';

const features = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

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

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

features.get('/favorites', async (c) => {
  const auth = c.get('auth');
  const result = await c.env.DB.prepare(`
    SELECT p.* FROM page_favorites pf
    JOIN pages p ON pf.page_id = p.id
    WHERE pf.user_id = ?
    ORDER BY pf.created_at DESC
  `).bind(auth.user.id).all<Page>();
  return c.json({ pages: result.results });
});

features.get('/recent', async (c) => {
  const auth = c.get('auth');
  const result = await c.env.DB.prepare(`
    SELECT p.*, pv.viewed_at FROM page_views pv
    JOIN pages p ON pv.page_id = p.id
    WHERE pv.user_id = ?
    ORDER BY pv.viewed_at DESC LIMIT 20
  `).bind(auth.user.id).all();
  return c.json({ pages: result.results });
});

features.post('/pages/:pageId/view', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(`
    INSERT INTO page_views (user_id, page_id, viewed_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id, page_id) DO UPDATE SET viewed_at = excluded.viewed_at
  `).bind(auth.user.id, pageId, now).run();
  return c.json({ ok: true });
});

features.post('/pages/:pageId/favorite', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO page_favorites (user_id, page_id, created_at) VALUES (?, ?, ?)'
  ).bind(auth.user.id, pageId, now).run();
  return c.json({ ok: true });
});

features.delete('/pages/:pageId/favorite', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  await c.env.DB.prepare(
    'DELETE FROM page_favorites WHERE user_id = ? AND page_id = ?'
  ).bind(auth.user.id, pageId).run();
  return c.json({ ok: true });
});

features.get('/pages/:pageId/favorite', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const fav = await c.env.DB.prepare(
    'SELECT 1 FROM page_favorites WHERE user_id = ? AND page_id = ?'
  ).bind(auth.user.id, pageId).first();
  return c.json({ favorited: !!fav });
});

features.post('/pages/:pageId/duplicate', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');

  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const newPageId = generateId();
  const now = Math.floor(Date.now() / 1000);
  const newTitle = `${page.title} (Copy)`;

  await c.env.DB.prepare(`
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(newPageId, page.workspace_id, page.parent_id, newTitle, page.icon, page.type, page.visibility, auth.user.id, now, now).run();

  const blocks = await c.env.DB.prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY order_index').bind(pageId).all<Block>();
  for (const block of blocks.results || []) {
    await c.env.DB.prepare(
      'INSERT INTO blocks (id, page_id, parent_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), newPageId, block.parent_id, block.type, block.content, block.order_index, now, now).run();
  }

  const md = blocksToMarkdown((blocks.results || []).map((b) => ({ type: b.type, content: b.content })));
  await c.env.DB.prepare('UPDATE pages SET content_md = ? WHERE id = ?').bind(md, newPageId).run();
  await updatePageFts(c.env.DB, newPageId, newTitle, md);

  const pageTags = await c.env.DB.prepare('SELECT tag_id FROM page_tags WHERE page_id = ?').bind(pageId).all<{ tag_id: string }>();
  for (const pt of pageTags.results || []) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)')
      .bind(newPageId, pt.tag_id).run();
  }

  const newPage = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(newPageId).first<Page>();
  return c.json({ page: newPage }, 201);
});

features.post('/bulk', async (c) => {
  const auth = c.get('auth');
  const { action, pageIds, parentId } = await c.req.json<{
    action: 'delete' | 'move';
    pageIds: string[];
    parentId?: string | null;
  }>();

  if (!pageIds?.length) return c.json({ error: 'No pages selected' }, 400);

  const results: Array<{ id: string; status: string }> = [];

  for (const pageId of pageIds) {
    const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
    if (!page || !(await checkWorkspaceAccess(c.env.DB, page.workspace_id, auth.user.id))) {
      results.push({ id: pageId, status: 'denied' });
      continue;
    }

    if (action === 'delete') {
      await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(pageId).run();
      await c.env.DB.prepare('DELETE FROM pages_fts WHERE page_id = ?').bind(pageId).run();
      results.push({ id: pageId, status: 'deleted' });
    } else if (action === 'move') {
      const now = Math.floor(Date.now() / 1000);
      await c.env.DB.prepare('UPDATE pages SET parent_id = ?, updated_at = ? WHERE id = ?')
        .bind(parentId ?? null, now, pageId).run();
      results.push({ id: pageId, status: 'moved' });
    }
  }

  return c.json({ results });
});

features.post('/fetch-url', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) return c.json({ error: 'url required' }, 400);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return c.json({ error: 'Only HTTP/HTTPS URLs supported' }, 400);
    }
  } catch {
    return c.json({ error: 'Invalid URL' }, 400);
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'UnifiedDocBot/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) return c.json({ error: `Failed to fetch URL (${response.status})` }, 400);

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const pageTitle = titleMatch?.[1]?.trim() || parsedUrl.hostname;
  const text = htmlToText(html);
  const markdown = `# ${pageTitle}\n\nSource: ${url}\n\n${text}`;
  return c.json({ title: pageTitle, markdown });
});

features.post('/import-url', async (c) => {
  const auth = c.get('auth');
  const { url, workspaceId, parentId } = await c.req.json<{ url: string; workspaceId: string; parentId?: string }>();

  if (!url || !workspaceId) return c.json({ error: 'url and workspaceId required' }, 400);
  if (!(await checkWorkspaceAccess(c.env.DB, workspaceId, auth.user.id))) {
    return c.json({ error: 'Access denied' }, 403);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return c.json({ error: 'Only HTTP/HTTPS URLs supported' }, 400);
    }
  } catch {
    return c.json({ error: 'Invalid URL' }, 400);
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'UnifiedDocBot/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) return c.json({ error: `Failed to fetch URL (${response.status})` }, 400);

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const pageTitle = titleMatch?.[1]?.trim() || parsedUrl.hostname;
  const text = htmlToText(html);
  const markdown = `# ${pageTitle}\n\nSource: ${url}\n\n${text}`;

  const pageId = generateId();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(`
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, created_by, created_at, updated_at, content_md)
    VALUES (?, ?, ?, ?, '🔗', 'page', 'private', ?, ?, ?, ?)
  `).bind(pageId, workspaceId, parentId || null, pageTitle, auth.user.id, now, now, markdown).run();

  const parsed = markdownToBlocks(markdown);
  for (let i = 0; i < parsed.length; i++) {
    await c.env.DB.prepare(
      'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), pageId, parsed[i].type, JSON.stringify(parsed[i].content), i, now, now).run();
  }

  await updatePageFts(c.env.DB, pageId, pageTitle, markdown);
  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(pageId).first<Page>();
  return c.json({ page }, 201);
});

export default features;
