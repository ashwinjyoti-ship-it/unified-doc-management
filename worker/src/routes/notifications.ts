import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';

const notifications = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

notifications.get('/', async (c) => {
  const auth = c.get('auth');
  const result = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(auth.user.id).all();
  return c.json({ notifications: result.results });
});

notifications.patch('/:id/read', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .bind(id, auth.user.id).run();
  return c.json({ ok: true });
});

notifications.post('/read-all', async (c) => {
  const auth = c.get('auth');
  await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(auth.user.id).run();
  return c.json({ ok: true });
});

export default notifications;
