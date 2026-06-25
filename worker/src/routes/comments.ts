import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';

function buildAgentPrompt(selectionQuote: string | null | undefined, instruction: string): string {
  const quote = (selectionQuote || '').trim();
  const text = instruction.trim();
  if (!quote) return text;
  if (!text) return `Selected text: "${quote}"`;
  return `Selected text: "${quote}"\n\nInstruction: ${text}`;
}

function enrichAgentComment(row: Record<string, unknown>) {
  const selectionQuote = (row.selection_quote as string | null) || '';
  const instruction = (row.content as string) || '';
  let selectionMeta: unknown = null;
  if (row.selection_meta && typeof row.selection_meta === 'string') {
    try {
      selectionMeta = JSON.parse(row.selection_meta);
    } catch {
      selectionMeta = null;
    }
  }
  return {
    ...row,
    selection_meta: selectionMeta,
    agent_prompt: buildAgentPrompt(selectionQuote, instruction),
  };
}

const comments = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

comments.get('/pages/:pageId/comments', async (c) => {
  const pageId = c.req.param('pageId');
  const typeFilter = c.req.query('type');
  const statusFilter = c.req.query('status');

  let query = `
    SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.page_id = ?
  `;
  const binds: string[] = [pageId];
  if (typeFilter) {
    query += ' AND c.comment_type = ?';
    binds.push(typeFilter);
  }
  if (statusFilter) {
    query += ' AND c.status = ?';
    binds.push(statusFilter);
  }
  query += ' ORDER BY c.created_at ASC';

  const result = await c.env.DB.prepare(query).bind(...binds).all();
  return c.json({ comments: result.results });
});

comments.get('/pages/:pageId/agent-comments', async (c) => {
  const pageId = c.req.param('pageId');
  const status = c.req.query('status') || 'open';
  const result = await c.env.DB.prepare(`
    SELECT c.*, u.name as author_name
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.page_id = ? AND c.comment_type = 'agent_instruction' AND c.status = ?
    ORDER BY c.created_at ASC
  `).bind(pageId, status).all();
  const rows = (result.results || []).map((row) => enrichAgentComment(row as Record<string, unknown>));
  const openCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM comments
    WHERE page_id = ? AND comment_type = 'agent_instruction' AND status = 'open'
  `).bind(pageId).first<{ count: number }>();
  return c.json({
    status,
    open_count: openCount?.count ?? 0,
    comments: rows,
  });
});

comments.patch('/comments/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string; content?: string }>();

  const existing = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first<{ user_id: string }>();
  if (!existing) return c.json({ error: 'Comment not found' }, 404);

  const now = Math.floor(Date.now() / 1000);
  if (body.content !== undefined) {
    await c.env.DB.prepare('UPDATE comments SET content = ?, updated_at = ? WHERE id = ?')
      .bind(body.content, now, id).run();
  }
  if (body.status !== undefined) {
    await c.env.DB.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE id = ?')
      .bind(body.status, now, id).run();
  }

  const comment = await c.env.DB.prepare(`
    SELECT c.*, u.name as author_name FROM comments c
    JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).bind(id).first();
  return c.json({ comment });
});

comments.delete('/comments/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT id, page_id FROM comments WHERE id = ?',
  ).bind(id).first<{ id: string; page_id: string }>();
  if (!existing) return c.json({ error: 'Comment not found' }, 404);

  await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();

  const roomId = c.env.COLLAB_ROOM.idFromName(existing.page_id);
  const room = c.env.COLLAB_ROOM.get(roomId);
  await room.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'comment_deleted', payload: { id } }),
  }));

  return c.json({ ok: true });
});

comments.post('/pages/:pageId/comments', async (c) => {
  const auth = c.get('auth');
  const pageId = c.req.param('pageId');
  const body = await c.req.json<{
    content: string;
    blockId?: string;
    commentType?: 'discussion' | 'agent_instruction';
    selectionQuote?: string;
    selectionMeta?: object;
    status?: string;
  }>();

  const commentId = generateId();
  const now = Math.floor(Date.now() / 1000);
  const commentType = body.commentType || 'discussion';
  const status = body.status || (commentType === 'agent_instruction' ? 'open' : 'open');

  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(body.content)) !== null) {
    mentions.push(match[2]);
  }

  await c.env.DB.prepare(`
    INSERT INTO comments (id, page_id, block_id, user_id, content, mentions, comment_type, selection_quote, selection_meta, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    commentId,
    pageId,
    body.blockId || null,
    auth.user.id,
    body.content,
    JSON.stringify(mentions),
    commentType,
    body.selectionQuote || null,
    body.selectionMeta ? JSON.stringify(body.selectionMeta) : null,
    status,
    now,
    now,
  ).run();

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
