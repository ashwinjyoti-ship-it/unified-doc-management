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
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, is_row_page, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, '📄', 'page', 'private', 1, ?, ?, ?)
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

export type RollupAggregation = 'count' | 'count_values' | 'sum' | 'average' | 'min' | 'max' | 'show_unique';

export interface RollupOptions {
  relationPropertyId: string;
  targetPropertyId: string;
  aggregation: RollupAggregation;
}

export interface RelatedSchemaProperty {
  id: string;
  name: string;
  type: string;
}

function parseRelationIds(propertiesJson: string, relationPropertyId: string): string[] {
  try {
    const props = JSON.parse(propertiesJson || '{}');
    const raw = props[relationPropertyId];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string' && raw) return [raw];
  } catch { /* ignore */ }
  return [];
}

function aggregateValues(values: unknown[], aggregation: RollupAggregation): string | number {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
  const numbers = nonEmpty.map((v) => Number(v)).filter((n) => !Number.isNaN(n));

  switch (aggregation) {
    case 'count':
      return values.length;
    case 'count_values':
      return nonEmpty.length;
    case 'sum':
      return numbers.reduce((a, b) => a + b, 0);
    case 'average':
      return numbers.length ? Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100 : 0;
    case 'min':
      if (numbers.length) return Math.min(...numbers);
      return nonEmpty.length ? String(nonEmpty[0]) : '';
    case 'max':
      if (numbers.length) return Math.max(...numbers);
      return nonEmpty.length ? String(nonEmpty[nonEmpty.length - 1]) : '';
    case 'show_unique':
      return [...new Set(nonEmpty.map(String))].join(', ');
    default:
      return '';
  }
}

export async function getRelatedSchemas(
  db: D1Database,
  properties: Array<{ id: string; type: string; options: string }>,
): Promise<Record<string, RelatedSchemaProperty[]>> {
  const relatedDbIds = new Set<string>();
  for (const prop of properties) {
    if (prop.type !== 'relation') continue;
    try {
      const opts = JSON.parse(prop.options || '{}');
      if (opts.relatedDatabaseId) relatedDbIds.add(opts.relatedDatabaseId);
    } catch { /* ignore */ }
  }

  const schemas: Record<string, RelatedSchemaProperty[]> = {};
  for (const dbId of relatedDbIds) {
    const result = await db.prepare(
      'SELECT id, name, type FROM database_properties WHERE database_id = ? ORDER BY order_index'
    ).bind(dbId).all<RelatedSchemaProperty>();
    schemas[dbId] = result.results || [];
  }
  return schemas;
}

export async function computeRollupValues(
  db: D1Database,
  properties: Array<{ id: string; type: string; options: string }>,
  rows: Array<{ id: string; properties: string }>,
): Promise<Record<string, Record<string, string | number>>> {
  const rollupProps = properties.filter((p) => p.type === 'rollup');
  if (rollupProps.length === 0) return {};

  const relationProps = new Map(
    properties.filter((p) => p.type === 'relation').map((p) => [p.id, p]),
  );

  const relatedRowsCache = new Map<string, Array<{ id: string; properties: string }>>();

  async function loadRelatedRows(databaseId: string) {
    if (!relatedRowsCache.has(databaseId)) {
      const result = await db.prepare(
        'SELECT id, properties FROM database_rows WHERE database_id = ?'
      ).bind(databaseId).all<{ id: string; properties: string }>();
      relatedRowsCache.set(databaseId, result.results || []);
    }
    return relatedRowsCache.get(databaseId)!;
  }

  const result: Record<string, Record<string, string | number>> = {};

  for (const row of rows) {
    result[row.id] = {};
    for (const rollupProp of rollupProps) {
      let opts: RollupOptions;
      try {
        opts = JSON.parse(rollupProp.options || '{}') as RollupOptions;
      } catch {
        result[row.id][rollupProp.id] = '';
        continue;
      }

      const relationProp = relationProps.get(opts.relationPropertyId);
      if (!relationProp) {
        result[row.id][rollupProp.id] = '';
        continue;
      }

      let relatedDatabaseId: string | undefined;
      try {
        relatedDatabaseId = JSON.parse(relationProp.options || '{}').relatedDatabaseId;
      } catch { /* ignore */ }

      if (!relatedDatabaseId) {
        result[row.id][rollupProp.id] = '';
        continue;
      }

      const linkedIds = parseRelationIds(row.properties, opts.relationPropertyId);
      const relatedRows = await loadRelatedRows(relatedDatabaseId);
      const linkedRows = relatedRows.filter((r) => linkedIds.includes(r.id));

      const targetValues = linkedRows.map((r) => {
        try {
          const props = JSON.parse(r.properties || '{}');
          return props[opts.targetPropertyId];
        } catch {
          return undefined;
        }
      });

      result[row.id][rollupProp.id] = aggregateValues(targetValues, opts.aggregation);
    }
  }

  return result;
}
