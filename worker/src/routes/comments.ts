import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';

const comments = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

comments.get('/pages/:pageId/comments', async (c) => {
  const pageId = c.req.param('pageId');
  const result = await c.env.DB.prepare(`
    SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.page_id = ? ORDER BY c.created_at ASC
  `).bind(pageId).all();
  return c.json({ comments: result.results });
});

comments.post('/pages/:pageId/comments', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const body = await c.req.json<{ content: string; blockId?: string }>();

  const commentId = generateId();
  const now = Math.floor(Date.now() / 1000);

  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(body.content)) !== null) {
    mentions.push(match[2]);
  }

  await c.env.DB.prepare(
    'INSERT INTO comments (id, page_id, block_id, user_id, content, mentions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(commentId, pageId, body.blockId || null, auth.user.id, body.content, JSON.stringify(mentions), now, now).run();

  for (const userId of mentions) {
    await c.env.DB.prepare(
      'INSERT INTO notifications (id, user_id, type, title, body, page_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), userId, 'mention', `${auth.user.name} mentioned you`, body.content.slice(0, 100), pageId, now).run();
  }

  const comment = await c.env.DB.prepare(`
    SELECT c.*, u.name as author_name FROM comments c
    JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).bind(commentId).first();

  const roomId = c.env.COLLAB_ROOM.idFromName(pageId);
  const room = c.env.COLLAB_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'comment_added', payload: comment }),
  }));

  return c.json({ comment }, 201);
});

export default comments;
