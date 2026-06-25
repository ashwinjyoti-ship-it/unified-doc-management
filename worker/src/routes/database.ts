import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';
import {
  ensureRowPage,
  getRelationData,
  getRelatedSchemas,
  computeRollupValues,
  syncPageTitleFromRowProperty,
} from '../database-helpers';

const database = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

async function getDatabasePage(db: D1Database, pageId: string) {
  return db.prepare('SELECT * FROM pages WHERE id = ? AND type = ?').bind(pageId, 'database').first<{
    id: string;
    workspace_id: string;
  }>();
}

database.get('/pages/:pageId/database', async (c) => {
  const pageId = c.req.param('pageId');
  const auth = c.get('auth');

  const dbPage = await getDatabasePage(c.env.DB, pageId);
  if (!dbPage) return c.json({ error: 'Database not found' }, 404);

  const properties = await c.env.DB.prepare(
    'SELECT * FROM database_properties WHERE database_id = ? ORDER BY order_index'
  ).bind(pageId).all();

  const rows = await c.env.DB.prepare(
    'SELECT * FROM database_rows WHERE database_id = ? ORDER BY order_index'
  ).bind(pageId).all<{ id: string; page_id: string | null }>();

  for (const row of rows.results || []) {
    if (!row.page_id) {
      await ensureRowPage(c.env.DB, pageId, row.id, auth.user.id);
    }
  }

  const refreshedRows = await c.env.DB.prepare(`
    SELECT dr.*, p.title as page_title
    FROM database_rows dr
    LEFT JOIN pages p ON dr.page_id = p.id
    WHERE dr.database_id = ?
    ORDER BY dr.order_index
  `).bind(pageId).all();

  const views = await c.env.DB.prepare(
    'SELECT * FROM database_views WHERE database_id = ? ORDER BY order_index'
  ).bind(pageId).all();

  const relationData = await getRelationData(
    c.env.DB,
    (properties.results || []) as Array<{ id: string; type: string; options: string }>,
  );

  const propList = (properties.results || []) as Array<{ id: string; type: string; options: string }>;
  const relatedSchemas = await getRelatedSchemas(c.env.DB, propList);
  const rollupValues = await computeRollupValues(
    c.env.DB,
    propList,
    (refreshedRows.results || []) as Array<{ id: string; properties: string }>,
  );

  const databases = await c.env.DB.prepare(
    "SELECT id, title, icon FROM pages WHERE workspace_id = ? AND type = 'database' AND id != ? ORDER BY title"
  ).bind(dbPage.workspace_id, pageId).all();

  return c.json({
    properties: properties.results,
    rows: refreshedRows.results,
    views: views.results,
    relationData,
    relatedSchemas,
    rollupValues,
    databases: databases.results,
  });
});

database.post('/pages/:pageId/database/properties', async (c) => {
  const pageId = c.req.param('pageId');
  const body = await c.req.json<{
    name: string;
    type: string;
    options?: string[] | {
      relatedDatabaseId?: string;
      relationPropertyId?: string;
      targetPropertyId?: string;
      aggregation?: string;
    };
  }>();

  if (!(await getDatabasePage(c.env.DB, pageId))) {
    return c.json({ error: 'Database not found' }, 404);
  }

  let optionsJson: string;
  if (body.type === 'relation' && body.options && !Array.isArray(body.options)) {
    optionsJson = JSON.stringify(body.options);
  } else if (body.type === 'rollup' && body.options && !Array.isArray(body.options)) {
    optionsJson = JSON.stringify(body.options);
  } else if (Array.isArray(body.options)) {
    optionsJson = JSON.stringify(body.options);
  } else {
    optionsJson = '[]';
  }

  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as max FROM database_properties WHERE database_id = ?'
  ).bind(pageId).first<{ max: number | null }>();

  const propId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO database_properties (id, database_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(propId, pageId, body.name, body.type, optionsJson, (maxOrder?.max ?? -1) + 1).run();

  const prop = await c.env.DB.prepare('SELECT * FROM database_properties WHERE id = ?').bind(propId).first();
  return c.json({ property: prop }, 201);
});

database.patch('/pages/:pageId/database/properties/:propId', async (c) => {
  const { pageId, propId } = c.req.param();
  const body = await c.req.json<{
    name?: string;
    type?: string;
    options?: string[] | {
      relatedDatabaseId?: string;
      relationPropertyId?: string;
      targetPropertyId?: string;
      aggregation?: string;
    };
  }>();

  if (!(await getDatabasePage(c.env.DB, pageId))) {
    return c.json({ error: 'Database not found' }, 404);
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM database_properties WHERE id = ? AND database_id = ?'
  ).bind(propId, pageId).first<{ id: string; name: string; type: string; options: string }>();

  if (!existing) return c.json({ error: 'Property not found' }, 404);

  if (body.name !== undefined && existing.name.toLowerCase() === 'name' && body.name.toLowerCase() !== 'name') {
    return c.json({ error: 'Cannot rename the Name property' }, 400);
  }

  const newType = body.type ?? existing.type;
  const newName = body.name ?? existing.name;

  let optionsJson = existing.options;
  if (body.options !== undefined) {
    if (newType === 'relation' && body.options && !Array.isArray(body.options)) {
      optionsJson = JSON.stringify(body.options);
    } else if (newType === 'rollup' && body.options && !Array.isArray(body.options)) {
      optionsJson = JSON.stringify(body.options);
    } else if (Array.isArray(body.options)) {
      optionsJson = JSON.stringify(body.options);
    } else {
      optionsJson = '[]';
    }
  }

  if (newType !== existing.type) {
    const rows = await c.env.DB.prepare(
      'SELECT id, properties FROM database_rows WHERE database_id = ?'
    ).bind(pageId).all<{ id: string; properties: string }>();

    for (const row of rows.results || []) {
      const props = JSON.parse(row.properties || '{}') as Record<string, unknown>;
      if (!(propId in props)) continue;
      const raw = props[propId];
      delete props[propId];
      if (newType === 'checkbox') {
        props[propId] = raw === true || raw === 'true' || raw === 1;
      } else if (newType === 'number') {
        const n = Number(raw);
        props[propId] = Number.isFinite(n) ? n : '';
      } else if (newType === 'multi_select') {
        props[propId] = Array.isArray(raw) ? raw : (raw ? [String(raw)] : []);
      } else if (newType === 'relation') {
        props[propId] = Array.isArray(raw) ? raw : [];
      } else {
        props[propId] = raw != null ? String(raw) : '';
      }
      await c.env.DB.prepare(
        'UPDATE database_rows SET properties = ?, updated_at = ? WHERE id = ?'
      ).bind(JSON.stringify(props), Math.floor(Date.now() / 1000), row.id).run();
    }
  }

  await c.env.DB.prepare(
    'UPDATE database_properties SET name = ?, type = ?, options = ? WHERE id = ?'
  ).bind(newName, newType, optionsJson, propId).run();

  const property = await c.env.DB.prepare('SELECT * FROM database_properties WHERE id = ?').bind(propId).first();
  return c.json({ property });
});

database.delete('/pages/:pageId/database/properties/:propId', async (c) => {
  const { pageId, propId } = c.req.param();

  if (!(await getDatabasePage(c.env.DB, pageId))) {
    return c.json({ error: 'Database not found' }, 404);
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM database_properties WHERE id = ? AND database_id = ?'
  ).bind(propId, pageId).first<{ name: string }>();

  if (!existing) return c.json({ error: 'Property not found' }, 404);
  if (existing.name.toLowerCase() === 'name') {
    return c.json({ error: 'Cannot delete the Name property' }, 400);
  }

  const rows = await c.env.DB.prepare(
    'SELECT id, properties FROM database_rows WHERE database_id = ?'
  ).bind(pageId).all<{ id: string; properties: string }>();

  const now = Math.floor(Date.now() / 1000);
  for (const row of rows.results || []) {
    const props = JSON.parse(row.properties || '{}') as Record<string, unknown>;
    if (!(propId in props)) continue;
    delete props[propId];
    await c.env.DB.prepare(
      'UPDATE database_rows SET properties = ?, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(props), now, row.id).run();
  }

  await c.env.DB.prepare('DELETE FROM database_properties WHERE id = ?').bind(propId).run();
  return c.json({ ok: true });
});

database.post('/pages/:pageId/database/rows', async (c) => {
  const pageId = c.req.param('pageId');
  const auth = c.get('auth');
  const body = await c.req.json<{ properties?: Record<string, unknown>; title?: string }>();

  const dbPage = await getDatabasePage(c.env.DB, pageId);
  if (!dbPage) return c.json({ error: 'Database not found' }, 404);

  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as max FROM database_rows WHERE database_id = ?'
  ).bind(pageId).first<{ max: number | null }>();

  const now = Math.floor(Date.now() / 1000);
  const rowId = generateId();
  const title = body.title || 'Untitled';

  const nameProp = await c.env.DB.prepare(
    "SELECT id FROM database_properties WHERE database_id = ? AND lower(name) = 'name' ORDER BY order_index LIMIT 1"
  ).bind(pageId).first<{ id: string }>();

  const rowProperties: Record<string, unknown> = { ...(body.properties || {}) };
  if (nameProp && rowProperties[nameProp.id] === undefined) {
    rowProperties[nameProp.id] = title;
  }

  const linkedPageId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, is_row_page, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, '📄', 'page', 'private', 1, ?, ?, ?)
  `).bind(linkedPageId, dbPage.workspace_id, pageId, title, auth.user.id, now, now).run();

  await c.env.DB.prepare(
    'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(generateId(), linkedPageId, 'paragraph', JSON.stringify({ text: '' }), 0, now, now).run();

  await c.env.DB.prepare(
    'INSERT INTO database_rows (id, database_id, page_id, properties, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(rowId, pageId, linkedPageId, JSON.stringify(rowProperties), (maxOrder?.max ?? -1) + 1, now, now).run();

  const row = await c.env.DB.prepare(`
    SELECT dr.*, p.title as page_title
    FROM database_rows dr
    LEFT JOIN pages p ON dr.page_id = p.id
    WHERE dr.id = ?
  `).bind(rowId).first();

  return c.json({ row }, 201);
});

database.patch('/pages/:pageId/database/rows/:rowId', async (c) => {
  const { pageId, rowId } = c.req.param();
  const body = await c.req.json<{ properties?: Record<string, unknown>; orderIndex?: number }>();
  const now = Math.floor(Date.now() / 1000);

  const existing = await c.env.DB.prepare('SELECT * FROM database_rows WHERE id = ? AND database_id = ?')
    .bind(rowId, pageId).first<{ properties: string; order_index: number; page_id: string | null }>();

  if (!existing) return c.json({ error: 'Row not found' }, 404);

  const mergedProps = body.properties
    ? { ...JSON.parse(existing.properties), ...body.properties }
    : JSON.parse(existing.properties);
  const props = JSON.stringify(mergedProps);
  const orderIndex = body.orderIndex ?? existing.order_index;

  await c.env.DB.prepare(
    'UPDATE database_rows SET properties = ?, order_index = ?, updated_at = ? WHERE id = ?'
  ).bind(props, orderIndex, now, rowId).run();

  if (body.properties) {
    await syncPageTitleFromRowProperty(c.env.DB, pageId, rowId, mergedProps);
  }

  const row = await c.env.DB.prepare(`
    SELECT dr.*, p.title as page_title
    FROM database_rows dr
    LEFT JOIN pages p ON dr.page_id = p.id
    WHERE dr.id = ?
  `).bind(rowId).first();

  return c.json({ row });
});

database.delete('/pages/:pageId/database/rows/:rowId', async (c) => {
  const { rowId } = c.req.param();

  const row = await c.env.DB.prepare('SELECT page_id FROM database_rows WHERE id = ?')
    .bind(rowId).first<{ page_id: string | null }>();

  await c.env.DB.prepare('DELETE FROM database_rows WHERE id = ?').bind(rowId).run();

  if (row?.page_id) {
    await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(row.page_id).run();
  }

  return c.json({ ok: true });
});

database.post('/pages/:pageId/database/views', async (c) => {
  const pageId = c.req.param('pageId');
  const body = await c.req.json<{
    name: string;
    viewType?: string;
    filters?: unknown[];
    sortConfig?: unknown[];
  }>();

  if (!(await getDatabasePage(c.env.DB, pageId))) {
    return c.json({ error: 'Database not found' }, 404);
  }

  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as max FROM database_views WHERE database_id = ?'
  ).bind(pageId).first<{ max: number | null }>();

  const viewId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO database_views (id, database_id, name, view_type, filters, sort_config, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    viewId,
    pageId,
    body.name,
    body.viewType || 'table',
    JSON.stringify(body.filters || []),
    JSON.stringify(body.sortConfig || []),
    (maxOrder?.max ?? -1) + 1,
  ).run();

  const view = await c.env.DB.prepare('SELECT * FROM database_views WHERE id = ?').bind(viewId).first();
  return c.json({ view }, 201);
});

database.patch('/pages/:pageId/database/views/:viewId', async (c) => {
  const { pageId, viewId } = c.req.param();
  const body = await c.req.json<{
    name?: string;
    viewType?: string;
    filters?: unknown[];
    sortConfig?: unknown[];
  }>();

  const existing = await c.env.DB.prepare(
    'SELECT * FROM database_views WHERE id = ? AND database_id = ?'
  ).bind(viewId, pageId).first();

  if (!existing) return c.json({ error: 'View not found' }, 404);

  await c.env.DB.prepare(`
    UPDATE database_views SET name = ?, view_type = ?, filters = ?, sort_config = ?
    WHERE id = ?
  `).bind(
    body.name ?? existing.name,
    body.viewType ?? existing.view_type,
    JSON.stringify(body.filters ?? JSON.parse(existing.filters as string || '[]')),
    JSON.stringify(body.sortConfig ?? JSON.parse(existing.sort_config as string || '[]')),
    viewId,
  ).run();

  const view = await c.env.DB.prepare('SELECT * FROM database_views WHERE id = ?').bind(viewId).first();
  return c.json({ view });
});

database.delete('/pages/:pageId/database/views/:viewId', async (c) => {
  const { viewId } = c.req.param();
  await c.env.DB.prepare('DELETE FROM database_views WHERE id = ?').bind(viewId).run();
  return c.json({ ok: true });
});

export default database;
