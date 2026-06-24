import type { D1Database } from '@cloudflare/workers-types';
import { generateId } from './utils';

export async function ensureRowPage(
  db: D1Database,
  databaseId: string,
  rowId: string,
  userId: string,
  title = 'Untitled',
): Promise<string> {
  const row = await db.prepare('SELECT page_id FROM database_rows WHERE id = ?')
    .bind(rowId).first<{ page_id: string | null }>();
  if (row?.page_id) return row.page_id;

  const database = await db.prepare('SELECT workspace_id FROM pages WHERE id = ?')
    .bind(databaseId).first<{ workspace_id: string }>();
  if (!database) throw new Error('Database not found');

  const now = Math.floor(Date.now() / 1000);
  const pageId = generateId();
  await db.prepare(`
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, '📄', 'page', 'private', ?, ?, ?)
  `).bind(pageId, database.workspace_id, databaseId, title, userId, now, now).run();

  await db.prepare(
    'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(generateId(), pageId, 'paragraph', JSON.stringify({ text: '' }), 0, now, now).run();

  await db.prepare('UPDATE database_rows SET page_id = ? WHERE id = ?').bind(pageId, rowId).run();

  const nameProp = await db.prepare(
    "SELECT id FROM database_properties WHERE database_id = ? AND lower(name) = 'name' ORDER BY order_index LIMIT 1"
  ).bind(databaseId).first<{ id: string }>();

  if (nameProp) {
    const existing = await db.prepare('SELECT properties FROM database_rows WHERE id = ?')
      .bind(rowId).first<{ properties: string }>();
    const props = JSON.parse(existing?.properties || '{}');
    props[nameProp.id] = title;
    await db.prepare('UPDATE database_rows SET properties = ? WHERE id = ?')
      .bind(JSON.stringify(props), rowId).run();
  }

  return pageId;
}

export async function syncRowPageTitle(
  db: D1Database,
  pageId: string,
  title: string,
): Promise<void> {
  const row = await db.prepare('SELECT id, database_id, properties FROM database_rows WHERE page_id = ?')
    .bind(pageId).first<{ id: string; database_id: string; properties: string }>();
  if (!row) return;

  const nameProp = await db.prepare(
    "SELECT id FROM database_properties WHERE database_id = ? AND lower(name) = 'name' ORDER BY order_index LIMIT 1"
  ).bind(row.database_id).first<{ id: string }>();

  if (!nameProp) return;

  const props = JSON.parse(row.properties || '{}');
  if (props[nameProp.id] === title) return;

  props[nameProp.id] = title;
  await db.prepare('UPDATE database_rows SET properties = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(props), Math.floor(Date.now() / 1000), row.id).run();
}

export async function syncPageTitleFromRowProperty(
  db: D1Database,
  databaseId: string,
  rowId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const nameProp = await db.prepare(
    "SELECT id FROM database_properties WHERE database_id = ? AND lower(name) = 'name' ORDER BY order_index LIMIT 1"
  ).bind(databaseId).first<{ id: string }>();

  if (!nameProp || properties[nameProp.id] === undefined) return;

  const row = await db.prepare('SELECT page_id FROM database_rows WHERE id = ?')
    .bind(rowId).first<{ page_id: string | null }>();
  if (!row?.page_id) return;

  const title = String(properties[nameProp.id] || 'Untitled');
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('UPDATE pages SET title = ?, updated_at = ? WHERE id = ?')
    .bind(title, now, row.page_id).run();
}

export async function getRelationData(
  db: D1Database,
  properties: Array<{ id: string; type: string; options: string }>,
): Promise<Record<string, Array<{ id: string; page_id: string | null; title: string }>>> {
  const relationData: Record<string, Array<{ id: string; page_id: string | null; title: string }>> = {};

  for (const prop of properties) {
    if (prop.type !== 'relation') continue;
    let relatedDatabaseId: string | undefined;
    try {
      const opts = JSON.parse(prop.options || '{}');
      relatedDatabaseId = opts.relatedDatabaseId;
    } catch { /* ignore */ }
    if (!relatedDatabaseId) continue;

    const relatedRows = await db.prepare(`
      SELECT dr.id, dr.page_id, p.title
      FROM database_rows dr
      LEFT JOIN pages p ON dr.page_id = p.id
      WHERE dr.database_id = ?
      ORDER BY dr.order_index
    `).bind(relatedDatabaseId).all<{ id: string; page_id: string | null; title: string | null }>();

    relationData[prop.id] = (relatedRows.results || []).map((r) => ({
      id: r.id,
      page_id: r.page_id,
      title: r.title || 'Untitled',
    }));
  }

  return relationData;
}
