import type { D1Database } from '@cloudflare/workers-types';
import { generateId } from './utils';

async function getDatabasePage(db: D1Database, pageId: string) {
  return db.prepare('SELECT id, title, workspace_id FROM pages WHERE id = ? AND type = ?')
    .bind(pageId, 'database')
    .first<{ id: string; title: string; workspace_id: string }>();
}

async function ensureNameProperty(db: D1Database, databaseId: string) {
  const existing = await db.prepare(
    'SELECT id FROM database_properties WHERE database_id = ? LIMIT 1',
  ).bind(databaseId).first();
  if (existing) return;

  await db.prepare(
    'INSERT INTO database_properties (id, database_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(generateId(), databaseId, 'Name', 'text', JSON.stringify([]), 0).run();
}

async function createInlineDatabasePage(
  db: D1Database,
  hostPageId: string,
  workspaceId: string,
  userId: string,
  title: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const databaseId = generateId();
  await db.prepare(`
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, '🗃️', 'database', 'private', ?, ?, ?)
  `).bind(databaseId, workspaceId, hostPageId, title, userId, now, now).run();
  await ensureNameProperty(db, databaseId);
  return databaseId;
}

async function updateEmbedBlockDatabaseId(
  db: D1Database,
  blockId: string,
  databaseId: string,
  title: string,
) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(
    'UPDATE blocks SET content = ?, updated_at = ? WHERE id = ?',
  ).bind(JSON.stringify({ databaseId, title }), now, blockId).run();
}

export type ResolveEmbeddedDatabaseResult = {
  databaseId: string;
  title: string;
  repaired: boolean;
};

/** Resolve (and optionally repair) the database page for an inline embed on a host page. */
export async function resolveEmbeddedDatabase(
  db: D1Database,
  hostPageId: string,
  candidateId: string | undefined,
  userId: string,
): Promise<ResolveEmbeddedDatabaseResult | null> {
  const host = await db.prepare('SELECT id, workspace_id, type FROM pages WHERE id = ?')
    .bind(hostPageId)
    .first<{ id: string; workspace_id: string; type: string }>();
  if (!host || host.type !== 'page') return null;

  const embedBlocks = await db.prepare(
    'SELECT id, content FROM blocks WHERE page_id = ? AND type = ? ORDER BY order_index',
  ).bind(hostPageId, 'database_embed').all<{ id: string; content: string }>();

  const parsedEmbeds = (embedBlocks.results || []).map((block) => {
    let content: { databaseId?: string; title?: string } = {};
    try {
      content = JSON.parse(block.content || '{}');
    } catch {
      content = {};
    }
    return { blockId: block.id, content };
  });

  const pickEmbed = () => {
    if (!parsedEmbeds.length) return null;
    if (candidateId) {
      const match = parsedEmbeds.find((e) => e.content.databaseId === candidateId);
      if (match) return match;
    }
    return parsedEmbeds[0] ?? null;
  };

  // Direct hit when candidate id is a real database page.
  if (candidateId && candidateId !== hostPageId) {
    const direct = await getDatabasePage(db, candidateId);
    if (direct) {
      await ensureNameProperty(db, direct.id);
      return { databaseId: direct.id, title: direct.title, repaired: false };
    }
  }

  // Try ids stored on embed blocks (source of truth for persisted embeds).
  for (const embed of parsedEmbeds) {
    const storedId = embed.content.databaseId;
    if (!storedId || storedId === hostPageId) continue;
    const dbPage = await getDatabasePage(db, storedId);
    if (dbPage) {
      await ensureNameProperty(db, dbPage.id);
      return { databaseId: dbPage.id, title: dbPage.title, repaired: false };
    }
  }

  // Child database pages parented under the host page (inline databases).
  const children = await db.prepare(
    "SELECT id, title FROM pages WHERE parent_id = ? AND type = 'database' ORDER BY created_at DESC",
  ).bind(hostPageId).all<{ id: string; title: string }>();

  if (children.results?.length) {
    const child = children.results[0]!;
    await ensureNameProperty(db, child.id);
    const embed = pickEmbed();
    if (embed && embed.content.databaseId !== child.id) {
      await updateEmbedBlockDatabaseId(db, embed.blockId, child.id, child.title);
    }
    return { databaseId: child.id, title: child.title, repaired: true };
  }

  // Nothing exists yet — create database page and repair the embed block.
  const embed = pickEmbed();
  if (!embed) return null;

  const title = embed.content.title || 'New Database';
  const databaseId = await createInlineDatabasePage(db, hostPageId, host.workspace_id, userId, title);
  await updateEmbedBlockDatabaseId(db, embed.blockId, databaseId, title);
  return { databaseId, title, repaired: true };
}
