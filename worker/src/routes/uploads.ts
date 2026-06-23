import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';

const uploads = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

uploads.post('/uploads', async (c) => {
  const auth = c.get('auth');
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return c.json({ error: 'File too large (max 10 MB)' }, 400);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${auth.user.id}/${generateId()}-${safeName}`;

  await c.env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  return c.json({
    url: `/api/uploads/${key.split('/').map(encodeURIComponent).join('/')}`,
    key,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  });
});

uploads.get('/uploads/:userId/:filename', async (c) => {
  const userId = c.req.param('userId');
  const filename = c.req.param('filename');
  const key = `${userId}/${filename}`;

  const object = await c.env.UPLOADS.get(key);
  if (!object) return c.json({ error: 'File not found' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
});

export default uploads;
