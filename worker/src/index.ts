import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import pagesRoutes from './routes/pages';
import databaseRoutes from './routes/database';
import commentsRoutes from './routes/comments';
import searchRoutes from './routes/search';
import notificationsRoutes from './routes/notifications';
import uploadsRoutes from './routes/uploads';
export { CollabRoom } from './collab-room';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

app.get('/api/health', (c) => c.json({ status: 'ok', version: '1.0.0' }));

app.route('/api/auth', authRoutes);

const publicPaths = ['/api/auth/register', '/api/auth/login', '/api/health'];

app.use('/api/*', async (c, next) => {
  if (publicPaths.includes(c.req.path)) {
    return next();
  }
  if (c.req.path.startsWith('/api/ws/')) {
    return next();
  }
  if (c.req.method === 'GET' && c.req.path.startsWith('/api/uploads/')) {
    return next();
  }
  if (c.req.path === '/api/auth/me' || c.req.path === '/api/auth/logout') {
    return next();
  }
  return authMiddleware(c, next);
});

app.route('/api', pagesRoutes);
app.route('/api', databaseRoutes);
app.route('/api', commentsRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/notifications', notificationsRoutes);
app.route('/api', uploadsRoutes);

app.get('/api/ws/:pageId', async (c) => {
  const pageId = c.req.param('pageId');
  const roomId = c.env.COLLAB_ROOM.idFromName(pageId);
  const room = c.env.COLLAB_ROOM.get(roomId);
  return room.fetch(c.req.raw);
});

app.post('/api/sync', async (c) => {
  const auth = c.get('auth' as never) as { user: { id: string } };
  const { operations } = await c.req.json<{ operations: Array<{ id: string; operation: string; entityType: string; entityId: string; payload: unknown }> }>();

  const results = [];
  for (const op of operations) {
    try {
      if (op.operation === 'update_blocks') {
        const payload = op.payload as { pageId: string; blocks: unknown[] };
        await c.env.DB.prepare('DELETE FROM blocks WHERE page_id = ?').bind(payload.pageId).run();
        results.push({ id: op.id, status: 'synced' });
      } else {
        results.push({ id: op.id, status: 'synced' });
      }
    } catch {
      results.push({ id: op.id, status: 'failed' });
    }
  }

  return c.json({ results });
});

app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.notFound();
});

export default app;
