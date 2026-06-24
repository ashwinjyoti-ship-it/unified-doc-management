import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { migrateLegacyKnowledgeBase, seedKnowledgeBase } from '../seed/knowledge-base';

const seed = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

async function getUserWorkspaceId(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare(`
    SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
  `).bind(userId).first<{ workspace_id: string }>();
  return row?.workspace_id ?? null;
}

seed.post('/seed/knowledge-base', async (c) => {
  const auth = c.get('auth');
  const workspaceId = await getUserWorkspaceId(c.env.DB, auth.user.id);

  if (!workspaceId) {
    return c.json({ error: 'No workspace found for your account' }, 404);
  }

  const result = await seedKnowledgeBase(c.env.DB, workspaceId, auth.user.id);
  return c.json(result);
});

seed.post('/seed/migrate-knowledge-base', async (c) => {
  const auth = c.get('auth');
  const workspaceId = await getUserWorkspaceId(c.env.DB, auth.user.id);

  if (!workspaceId) {
    return c.json({ error: 'No workspace found for your account' }, 404);
  }

  const result = await migrateLegacyKnowledgeBase(c.env.DB, workspaceId, auth.user.id);
  return c.json(result);
});

export default seed;
