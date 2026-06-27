import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';

const canvas = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

async function checkPageAccess(
  db: D1Database,
  pageId: string,
  userId: string,
): Promise<{ page: { id: string; workspace_id: string; type: string } | null; allowed: boolean }> {
  const page = await db
    .prepare('SELECT id, workspace_id, type FROM pages WHERE id = ?')
    .bind(pageId)
    .first<{ id: string; workspace_id: string; type: string }>();
  if (!page) return { page: null, allowed: false };
  const member = await db
    .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .bind(page.workspace_id, userId)
    .first();
  return { page, allowed: !!member };
}

async function broadcastCanvas(env: Env, pageId: string, kind: string, payload: unknown) {
  const roomId = env.COLLAB_ROOM.idFromName(pageId);
  const room = env.COLLAB_ROOM.get(roomId);
  await room.fetch(
    new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ type: kind, payload }),
    }),
  );
}

function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToComponent(row: Record<string, unknown>) {
  return {
    id: row.id,
    pageId: row.page_id,
    parentId: row.parent_id ?? null,
    nodePath: row.node_path,
    type: row.type,
    name: row.name,
    position: parseJsonField(row.position as string, { x: 0, y: 0 }),
    size: parseJsonField(row.size as string, { w: 100, h: 40 }),
    props: parseJsonField(row.props as string, {}),
    styles: parseJsonField(row.styles as string, {}),
    variants: parseJsonField(row.variants as string, []),
    viewport: row.viewport ?? null,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToToken(row: Record<string, unknown>) {
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    type: row.type,
    value: row.value,
  };
}

async function saveCanvasVersion(env: Env, pageId: string, userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const components = await env.DB.prepare(
    'SELECT * FROM canvas_components WHERE page_id = ? ORDER BY order_index ASC',
  )
    .bind(pageId)
    .all();
  const tokens = await env.DB.prepare('SELECT * FROM canvas_tokens WHERE page_id = ?')
    .bind(pageId)
    .all();
  const snapshot = JSON.stringify({ components: components.results, tokens: tokens.results });

  const page = await env.DB.prepare('SELECT title FROM pages WHERE id = ?').bind(pageId).first<{ title: string }>();
  await env.DB.prepare(
    'INSERT INTO page_versions (id, page_id, title, blocks_snapshot, canvas_snapshot, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(generateId(), pageId, page?.title ?? '', '[]', snapshot, userId, now)
    .run();
}

// ── GET /api/pages/:id/canvas ──────────────────────────────────────────────
canvas.get('/pages/:pageId/canvas', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);
  if (page.type !== 'canvas') return c.json({ error: 'Not a canvas page' }, 400);

  const components = await c.env.DB.prepare(
    'SELECT * FROM canvas_components WHERE page_id = ? ORDER BY order_index ASC',
  )
    .bind(pageId)
    .all<Record<string, unknown>>();
  const tokens = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE page_id = ?')
    .bind(pageId)
    .all<Record<string, unknown>>();

  return c.json({
    components: (components.results || []).map(rowToComponent),
    tokens: (tokens.results || []).map(rowToToken),
  });
});

// ── POST /api/pages/:id/canvas/reset ──────────────────────────────────────
canvas.post('/pages/:pageId/canvas/reset', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const confirm = c.req.query('confirm');
  if (confirm !== 'true') return c.json({ error: 'Pass ?confirm=true to reset canvas' }, 400);

  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);
  if (page.type !== 'canvas') return c.json({ error: 'Not a canvas page' }, 400);

  const count = await c.env.DB.prepare('SELECT COUNT(*) as n FROM canvas_components WHERE page_id = ?')
    .bind(pageId)
    .first<{ n: number }>();

  await c.env.DB.prepare('DELETE FROM canvas_components WHERE page_id = ?').bind(pageId).run();

  await broadcastCanvas(c.env, pageId, 'canvas:reset', { pageId });

  return c.json({ ok: true, deleted: count?.n ?? 0 });
});

// ── POST /api/pages/:id/canvas/components ─────────────────────────────────
canvas.post('/pages/:pageId/canvas/components', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);
  if (page.type !== 'canvas') return c.json({ error: 'Not a canvas page' }, 400);

  const body = await c.req.json<{ component: Record<string, unknown> }>();
  const comp = body.component || {};

  const validTypes = ['frame', 'group', 'text', 'button', 'input', 'image', 'rect'];
  if (!comp.type || !validTypes.includes(comp.type as string)) {
    return c.json({ error: `type must be one of: ${validTypes.join(', ')}` }, 400);
  }
  if (!comp.name) return c.json({ error: 'name is required' }, 400);

  const id = (comp.id as string) || generateId();
  const now = Math.floor(Date.now() / 1000);

  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as m FROM canvas_components WHERE page_id = ?',
  )
    .bind(pageId)
    .first<{ m: number | null }>();
  const orderIndex = typeof comp.orderIndex === 'number' ? comp.orderIndex : (maxOrder?.m ?? -1) + 1;

  await c.env.DB.prepare(`
    INSERT INTO canvas_components
      (id, page_id, parent_id, node_path, type, name, props, styles, position, size, variants, viewport, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      id,
      pageId,
      (comp.parentId as string) || null,
      (comp.nodePath as string) || (comp.name as string),
      comp.type as string,
      comp.name as string,
      JSON.stringify(comp.props || {}),
      JSON.stringify(comp.styles || {}),
      JSON.stringify(comp.position || { x: 0, y: 0 }),
      JSON.stringify(comp.size || { w: 100, h: 40 }),
      JSON.stringify(comp.variants || []),
      (comp.viewport as string) || null,
      orderIndex,
      now,
      now,
    )
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM canvas_components WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  const component = rowToComponent(row!);

  await broadcastCanvas(c.env, pageId, 'canvas:component:add', component);
  await saveCanvasVersion(c.env, pageId, auth.user.id);

  return c.json({ component }, 201);
});

// ── PATCH /api/pages/:id/canvas/components/:cid ───────────────────────────
canvas.patch('/pages/:pageId/canvas/components/:cid', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const cid = c.req.param('cid');

  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);

  const existing = await c.env.DB.prepare('SELECT * FROM canvas_components WHERE id = ? AND page_id = ?')
    .bind(cid, pageId)
    .first<Record<string, unknown>>();
  if (!existing) return c.json({ error: 'Component not found' }, 404);

  const body = await c.req.json<{ patch: Record<string, unknown> }>();
  const patch = body.patch || {};
  const now = Math.floor(Date.now() / 1000);

  // Deep-merge props and styles; replace position/size/scalars
  const newProps = patch.props
    ? JSON.stringify({ ...parseJsonField(existing.props as string, {}), ...(patch.props as object) })
    : (existing.props as string);
  const newStyles = patch.styles
    ? JSON.stringify({ ...parseJsonField(existing.styles as string, {}), ...(patch.styles as object) })
    : (existing.styles as string);
  const newPosition = patch.position ? JSON.stringify(patch.position) : (existing.position as string);
  const newSize = patch.size ? JSON.stringify(patch.size) : (existing.size as string);
  const newVariants = patch.variants ? JSON.stringify(patch.variants) : (existing.variants as string);

  await c.env.DB.prepare(`
    UPDATE canvas_components SET
      name = ?, node_path = ?, parent_id = ?, props = ?, styles = ?,
      position = ?, size = ?, variants = ?, viewport = ?,
      order_index = ?, updated_at = ?
    WHERE id = ?
  `)
    .bind(
      (patch.name as string) ?? existing.name,
      (patch.nodePath as string) ?? existing.node_path,
      patch.parentId !== undefined ? ((patch.parentId as string) || null) : existing.parent_id,
      newProps,
      newStyles,
      newPosition,
      newSize,
      newVariants,
      patch.viewport !== undefined ? ((patch.viewport as string) || null) : existing.viewport,
      patch.orderIndex !== undefined ? patch.orderIndex : existing.order_index,
      now,
      cid,
    )
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM canvas_components WHERE id = ?')
    .bind(cid)
    .first<Record<string, unknown>>();
  const component = rowToComponent(row!);

  await broadcastCanvas(c.env, pageId, 'canvas:component:update', { id: cid, patch: component });
  await saveCanvasVersion(c.env, pageId, auth.user.id);

  return c.json({ component });
});

// ── DELETE /api/pages/:id/canvas/components/:cid ──────────────────────────
canvas.delete('/pages/:pageId/canvas/components/:cid', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const cid = c.req.param('cid');

  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);

  const existing = await c.env.DB.prepare('SELECT id FROM canvas_components WHERE id = ? AND page_id = ?')
    .bind(cid, pageId)
    .first();
  if (!existing) return c.json({ error: 'Component not found' }, 404);

  await c.env.DB.prepare('DELETE FROM canvas_components WHERE id = ?').bind(cid).run();

  await broadcastCanvas(c.env, pageId, 'canvas:component:remove', { id: cid });
  await saveCanvasVersion(c.env, pageId, auth.user.id);

  return c.json({ ok: true });
});

// ── POST /api/pages/:id/canvas/components/:cid/duplicate ──────────────────
canvas.post('/pages/:pageId/canvas/components/:cid/duplicate', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const cid = c.req.param('cid');

  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);

  const existing = await c.env.DB.prepare('SELECT * FROM canvas_components WHERE id = ? AND page_id = ?')
    .bind(cid, pageId)
    .first<Record<string, unknown>>();
  if (!existing) return c.json({ error: 'Component not found' }, 404);

  const newId = generateId();
  const now = Math.floor(Date.now() / 1000);
  const pos = parseJsonField(existing.position as string, { x: 0, y: 0 });
  const offsetPos = JSON.stringify({ x: pos.x + 20, y: pos.y + 20 });

  await c.env.DB.prepare(`
    INSERT INTO canvas_components
      (id, page_id, parent_id, node_path, type, name, props, styles, position, size, variants, viewport, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      newId,
      pageId,
      existing.parent_id,
      `${existing.node_path} (copy)`,
      existing.type,
      `${existing.name} (copy)`,
      existing.props,
      existing.styles,
      offsetPos,
      existing.size,
      existing.variants,
      existing.viewport,
      (existing.order_index as number) + 0.5,
      now,
      now,
    )
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM canvas_components WHERE id = ?')
    .bind(newId)
    .first<Record<string, unknown>>();
  const component = rowToComponent(row!);

  await broadcastCanvas(c.env, pageId, 'canvas:component:add', component);
  await saveCanvasVersion(c.env, pageId, auth.user.id);

  return c.json({ component }, 201);
});

// ── GET /api/pages/:id/canvas/tokens ──────────────────────────────────────
canvas.get('/pages/:pageId/canvas/tokens', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);

  const tokens = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE page_id = ?')
    .bind(pageId)
    .all<Record<string, unknown>>();
  return c.json({ tokens: (tokens.results || []).map(rowToToken) });
});

// ── POST /api/pages/:id/canvas/tokens ─────────────────────────────────────
canvas.post('/pages/:pageId/canvas/tokens', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);

  const body = await c.req.json<{ token: Record<string, unknown> }>();
  const t = body.token || {};
  const validTypes = ['color', 'spacing', 'radius', 'fontSize', 'fontWeight'];
  if (!t.name) return c.json({ error: 'name is required' }, 400);
  if (!t.type || !validTypes.includes(t.type as string))
    return c.json({ error: `type must be one of: ${validTypes.join(', ')}` }, 400);
  if (!t.value) return c.json({ error: 'value is required' }, 400);

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO canvas_tokens (id, page_id, name, type, value) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, pageId, t.name as string, t.type as string, t.value as string)
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  const token = rowToToken(row!);

  const allTokens = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE page_id = ?')
    .bind(pageId)
    .all<Record<string, unknown>>();
  await broadcastCanvas(c.env, pageId, 'canvas:token:update', (allTokens.results || []).map(rowToToken));

  return c.json({ token }, 201);
});

// ── PATCH /api/pages/:id/canvas/tokens/:tid ───────────────────────────────
canvas.patch('/pages/:pageId/canvas/tokens/:tid', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const tid = c.req.param('tid');

  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);

  const existing = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE id = ? AND page_id = ?')
    .bind(tid, pageId)
    .first<Record<string, unknown>>();
  if (!existing) return c.json({ error: 'Token not found' }, 404);

  const body = await c.req.json<{ patch: Record<string, unknown> }>();
  const patch = body.patch || {};

  await c.env.DB.prepare('UPDATE canvas_tokens SET name = ?, type = ?, value = ? WHERE id = ?')
    .bind(
      (patch.name as string) ?? existing.name,
      (patch.type as string) ?? existing.type,
      (patch.value as string) ?? existing.value,
      tid,
    )
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE id = ?')
    .bind(tid)
    .first<Record<string, unknown>>();
  const token = rowToToken(row!);

  const allTokens = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE page_id = ?')
    .bind(pageId)
    .all<Record<string, unknown>>();
  await broadcastCanvas(c.env, pageId, 'canvas:token:update', (allTokens.results || []).map(rowToToken));

  return c.json({ token });
});

// ── DELETE /api/pages/:id/canvas/tokens/:tid ──────────────────────────────
canvas.delete('/pages/:pageId/canvas/tokens/:tid', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const tid = c.req.param('tid');

  const { page, allowed } = await checkPageAccess(c.env.DB, pageId, auth.user.id);
  if (!page) return c.json({ error: 'Page not found' }, 404);
  if (!allowed) return c.json({ error: 'Access denied' }, 403);

  const existing = await c.env.DB.prepare('SELECT id FROM canvas_tokens WHERE id = ? AND page_id = ?')
    .bind(tid, pageId)
    .first();
  if (!existing) return c.json({ error: 'Token not found' }, 404);

  await c.env.DB.prepare('DELETE FROM canvas_tokens WHERE id = ?').bind(tid).run();

  const allTokens = await c.env.DB.prepare('SELECT * FROM canvas_tokens WHERE page_id = ?')
    .bind(pageId)
    .all<Record<string, unknown>>();
  await broadcastCanvas(c.env, pageId, 'canvas:token:update', (allTokens.results || []).map(rowToToken));

  return c.json({ ok: true });
});

export default canvas;
