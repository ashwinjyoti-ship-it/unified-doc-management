import { Hono } from 'hono';
import type { Env, User } from '../types';
import { generateId, hashPassword, verifyPassword, createToken, hashApiKey } from '../utils';

const auth = new Hono<{ Bindings: Env }>();

auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json<{ email: string; password: string; name: string }>();

  if (!email || !password || !name) {
    return c.json({ error: 'Email, password, and name are required' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const userId = generateId();
  const passwordHash = await hashPassword(password);
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, email, passwordHash, name, now, now).run();

  const workspaceId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(workspaceId, `${name}'s Workspace`, userId, now, now).run();

  await c.env.DB.prepare(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
  ).bind(workspaceId, userId, 'owner').run();

  const welcomePageId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO pages (id, workspace_id, title, icon, type, visibility, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(welcomePageId, workspaceId, 'Getting Started', '👋', 'page', 'private', userId, now, now).run();

  const blockId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    blockId,
    welcomePageId,
    'paragraph',
    JSON.stringify({ text: 'Welcome to Unified Doc Management! Start typing to create your first page.' }),
    0,
    now,
    now
  ).run();

  const sessionId = generateId();
  const tokenHash = generateId();
  const expiresAt = now + 7 * 24 * 60 * 60;

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(sessionId, userId, tokenHash, expiresAt, now).run();

  const token = await createToken(userId, sessionId, c.env.JWT_SECRET);

  const user = await c.env.DB.prepare('SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = ?')
    .bind(userId).first<User>();

  return c.json({ token, user, workspaceId }, 201);
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User & { password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionId = generateId();
  const tokenHash = generateId();
  const expiresAt = now + 7 * 24 * 60 * 60;

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(sessionId, user.id, tokenHash, expiresAt, now).run();

  const token = await createToken(user.id, sessionId, c.env.JWT_SECRET);

  const { password_hash: _, ...safeUser } = user;
  return c.json({ token, user: safeUser });
});

auth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const { verifyToken } = await import('../utils');
    const payload = await verifyToken(authHeader.slice(7), c.env.JWT_SECRET);
    if (payload) {
      await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(payload.sessionId).run();
    }
  }
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { verifyToken } = await import('../utils');
  const payload = await verifyToken(authHeader.slice(7), c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid token' }, 401);

  const user = await c.env.DB.prepare('SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = ?')
    .bind(payload.userId).first<User>();

  return c.json({ user });
});

auth.post('/api-keys', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const { verifyToken } = await import('../utils');
  const payload = await verifyToken(authHeader.slice(7), c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);

  const user = await c.env.DB.prepare('SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = ?')
    .bind(payload.userId).first<User>();
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { name } = await c.req.json<{ name: string }>();
  const keyId = generateId();
  const rawKey = `udm_${generateId().replace(/-/g, '')}`;
  const keyHash = await hashApiKey(rawKey);
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    'INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(keyId, user.id, name || 'API Key', rawKey.slice(0, 12), keyHash, now).run();

  return c.json({ id: keyId, key: rawKey, prefix: rawKey.slice(0, 12) }, 201);
});

export default auth;
