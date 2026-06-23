import { Hono } from 'hono';
import type { Env, AuthContext, Page } from '../types';
import { generateId } from '../utils';

const database = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

database.get('/pages/:pageId/database', async (c) => {
  const pageId = c.req.param('pageId');

  const properties = await c.env.DB.prepare(
    'SELECT * FROM database_properties WHERE database_id = ? ORDER BY order_index'
  ).bind(pageId).all();

  const rows = await c.env.DB.prepare(
    'SELECT * FROM database_rows WHERE database_id = ? ORDER BY order_index'
  ).bind(pageId).all();

  return c.json({ properties: properties.results, rows: rows.results });
});

database.post('/pages/:pageId/database/properties', async (c) => {
  const pageId = c.req.param('pageId');
  const body = await c.req.json<{ name: string; type: string; options?: string[] }>();

  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as max FROM database_properties WHERE database_id = ?'
  ).bind(pageId).first<{ max: number | null }>();

  const propId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO database_properties (id, database_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(propId, pageId, body.name, body.type, JSON.stringify(body.options || []), (maxOrder?.max ?? -1) + 1).run();

  const prop = await c.env.DB.prepare('SELECT * FROM database_properties WHERE id = ?').bind(propId).first();
  return c.json({ property: prop }, 201);
});

database.post('/pages/:pageId/database/rows', async (c) => {
  const pageId = c.req.param('pageId');
  const body = await c.req.json<{ properties?: Record<string, unknown> }>();

  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as max FROM database_rows WHERE database_id = ?'
  ).bind(pageId).first<{ max: number | null }>();

  const now = Math.floor(Date.now() / 1000);
  const rowId = generateId();

  await c.env.DB.prepare(
    'INSERT INTO database_rows (id, database_id, properties, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(rowId, pageId, JSON.stringify(body.properties || {}), (maxOrder?.max ?? -1) + 1, now, now).run();

  const row = await c.env.DB.prepare('SELECT * FROM database_rows WHERE id = ?').bind(rowId).first();
  return c.json({ row }, 201);
});

database.patch('/pages/:pageId/database/rows/:rowId', async (c) => {
  const { pageId, rowId } = c.req.param();
  const body = await c.req.json<{ properties?: Record<string, unknown>; orderIndex?: number }>();
  const now = Math.floor(Date.now() / 1000);

  const existing = await c.env.DB.prepare('SELECT * FROM database_rows WHERE id = ? AND database_id = ?')
    .bind(rowId, pageId).first<{ properties: string; order_index: number }>();

  if (!existing) return c.json({ error: 'Row not found' }, 404);

  const props = body.properties
    ? JSON.stringify({ ...JSON.parse(existing.properties), ...body.properties })
    : existing.properties;
  const orderIndex = body.orderIndex ?? existing.order_index;

  await c.env.DB.prepare(
    'UPDATE database_rows SET properties = ?, order_index = ?, updated_at = ? WHERE id = ?'
  ).bind(props, orderIndex, now, rowId).run();

  const row = await c.env.DB.prepare('SELECT * FROM database_rows WHERE id = ?').bind(rowId).first();
  return c.json({ row });
});

database.delete('/pages/:pageId/database/rows/:rowId', async (c) => {
  const { rowId } = c.req.param();
  await c.env.DB.prepare('DELETE FROM database_rows WHERE id = ?').bind(rowId).run();
  return c.json({ ok: true });
});

export default database;
