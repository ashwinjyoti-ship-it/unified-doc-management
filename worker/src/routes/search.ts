import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';

const search = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

search.get('/', async (c) => {
  const auth = c.get('auth');
  const q = c.req.query('q') || '';

  if (!q.trim()) {
    return c.json({ results: [] });
  }

  const results = await c.env.DB.prepare(`
    SELECT p.id, p.title, p.icon, p.type, p.workspace_id,
           snippet(pages_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
    FROM pages_fts
    JOIN pages p ON pages_fts.page_id = p.id
    JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pages_fts MATCH ? AND wm.user_id = ?
    ORDER BY rank
    LIMIT 50
  `).bind(q, auth.user.id).all();

  return c.json({ results: results.results });
});

export default search;
