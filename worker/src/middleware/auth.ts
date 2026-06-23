import { Context, Next } from 'hono';
import type { Env, AuthContext, User } from './types';
import { verifyToken } from '../utils';

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const apiKey = c.req.header('X-API-Key');

  if (apiKey) {
    const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
      .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(''));

    const apiKeyRow = await c.env.DB.prepare(
      'SELECT user_id FROM api_keys WHERE key_hash = ?'
    ).bind(keyHash).first<{ user_id: string }>();

    if (apiKeyRow) {
      const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(apiKeyRow.user_id).first<User>();
      if (user) {
        c.set('auth', { user, sessionId: 'api' });
        return next();
      }
    }
    return c.json({ error: 'Invalid API key' }, 401);
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > ?'
  ).bind(payload.sessionId, Math.floor(Date.now() / 1000)).first();

  if (!session) {
    return c.json({ error: 'Session expired' }, 401);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(payload.userId).first<User>();

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  c.set('auth', { user, sessionId: payload.sessionId });
  return next();
}

export async function optionalAuth(c: Context<{ Bindings: Env; Variables: { auth?: AuthContext } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (payload) {
      const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(payload.userId).first<User>();
      if (user) {
        c.set('auth', { user, sessionId: payload.sessionId });
      }
    }
  }
  return next();
}
