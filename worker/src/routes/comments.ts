import { Hono } from 'hono';
import type { Env, AuthContext } from '../types';
import { generateId } from '../utils';
import { editPageSection, EditSectionError } from '../edit-section';

function buildAgentPrompt(selectionQuote: string | null | undefined, instruction: string): string {
  const quote = (selectionQuote || '').trim();
  const text = instruction.trim();
  if (!quote) return text;
  if (!text) return `Selected text: "${quote}"`;
  return `Selected text: "${quote}"\n\nInstruction: ${text}`;
}

function parseJsonSafe(raw: unknown): unknown {
  if (!raw || typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function enrichAgentComment(row: Record<string, unknown>) {
  const selectionQuote = (row.selection_quote as string | null) || '';
  const instruction = (row.content as string) || '';
  const anchorKind = (row.anchor_kind as string) || 'text';
  let agentPrompt = buildAgentPrompt(selectionQuote, instruction);
  if (anchorKind === 'component') {
    const path = (row.anchor_path as string) || '';
    agentPrompt = path
      ? `Component: "${path}"\n\nInstruction: ${instruction}`
      : `Instruction: ${instruction}`;
  }
  return {
    ...row,
    selection_meta: parseJsonSafe(row.selection_meta),
    tags: parseJsonSafe(row.tags) ?? [],
    snapshot_before: parseJsonSafe(row.snapshot_before),
    agent_prompt: agentPrompt,
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

comments.post('/comments/:id/apply', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json<{
    new_text?: string;
    old_text?: string;
    occurrence?: 'first' | 'all' | number;
    require_unique?: boolean;
    resolve?: boolean;
    component_patch?: Record<string, unknown>;
  }>();

  const comment = await c.env.DB.prepare(`
    SELECT c.*, p.title as page_title, p.workspace_id, p.type as page_type
    FROM comments c
    JOIN pages p ON c.page_id = p.id
    WHERE c.id = ?
  `).bind(id).first<{
    id: string;
    page_id: string;
    comment_type: string;
    anchor_kind: string;
    anchor_id: string | null;
    selection_quote: string | null;
    page_title: string;
    workspace_id: string;
    page_type: string;
  }>();

  if (!comment) return c.json({ error: 'Comment not found' }, 404);
  if (comment.comment_type !== 'agent_instruction') {
    return c.json({ error: 'apply is only for agent_instruction comments' }, 400);
  }

  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
  ).bind(comment.workspace_id, auth.user.id).first();
  if (!member) return c.json({ error: 'Access denied' }, 403);

  const now = Math.floor(Date.now() / 1000);

  // ── Component patch path ─────────────────────────────────────────────────
  if (body.component_patch) {
    if (!comment.anchor_id) {
      return c.json({ error: 'Comment has no anchor_id; cannot apply component_patch' }, 400);
    }

    const existing = await c.env.DB.prepare('SELECT * FROM canvas_components WHERE id = ?')
      .bind(comment.anchor_id)
      .first<Record<string, unknown>>();
    if (!existing) return c.json({ error: 'Anchored component not found' }, 404);

    // Snapshot before edit
    await c.env.DB.prepare('UPDATE comments SET snapshot_before = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(existing), now, id)
      .run();

    const patch = body.component_patch;

    function parseJsonField<T>(raw: string | null | undefined, fb: T): T {
      if (!raw) return fb;
      try { return JSON.parse(raw) as T; } catch { return fb; }
    }

    const newProps = patch.props
      ? JSON.stringify({ ...parseJsonField(existing.props as string, {}), ...(patch.props as object) })
      : (existing.props as string);
    const newStyles = patch.styles
      ? JSON.stringify({ ...parseJsonField(existing.styles as string, {}), ...(patch.styles as object) })
      : (existing.styles as string);
    const newPosition = patch.position ? JSON.stringify(patch.position) : (existing.position as string);
    const newSize = patch.size ? JSON.stringify(patch.size) : (existing.size as string);
    const newVariants = patch.variants ? JSON.stringify(patch.variants) : (existing.variants as string);

    await c.env.DB.prepare(`
      UPDATE canvas_components SET
        name = ?, props = ?, styles = ?, position = ?, size = ?, variants = ?, viewport = ?, updated_at = ?
      WHERE id = ?
    `)
      .bind(
        (patch.name as string) ?? existing.name,
        newProps,
        newStyles,
        newPosition,
        newSize,
        newVariants,
        patch.viewport !== undefined ? ((patch.viewport as string) || null) : existing.viewport,
        now,
        comment.anchor_id,
      )
      .run();

    const shouldResolve = body.resolve !== false;
    if (shouldResolve) {
      await c.env.DB.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE id = ?')
        .bind('resolved', now, id).run();
    }

    // Broadcast via CollabRoom
    const updatedComp = await c.env.DB.prepare('SELECT * FROM canvas_components WHERE id = ?')
      .bind(comment.anchor_id)
      .first<Record<string, unknown>>();
    const roomId = c.env.COLLAB_ROOM.idFromName(comment.page_id);
    const room = c.env.COLLAB_ROOM.get(roomId);
    await room.fetch(new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ type: 'canvas:component:update', payload: { id: comment.anchor_id, patch: updatedComp } }),
    }));

    const openCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM comments
      WHERE page_id = ? AND comment_type = 'agent_instruction' AND status = 'open'
    `).bind(comment.page_id).first<{ count: number }>();

    const updatedComment = await c.env.DB.prepare(`
      SELECT c.*, u.name as author_name FROM comments c
      JOIN users u ON c.user_id = u.id WHERE c.id = ?
    `).bind(id).first();

    return c.json({
      ok: true,
      page_id: comment.page_id,
      comment_id: id,
      component: updatedComp,
      comment_resolved: shouldResolve,
      open_count: openCount?.count ?? 0,
      comment: enrichAgentComment(updatedComment as Record<string, unknown>),
    });
  }

  // ── Text patch path (existing behavior) ──────────────────────────────────
  if (comment.page_type === 'database' || comment.page_type === 'folder') {
    return c.json({ error: 'Cannot apply edits to folder or database pages' }, 400);
  }
  if (body.new_text === undefined) {
    return c.json({ error: 'new_text or component_patch is required' }, 400);
  }

  const oldText = (body.old_text ?? comment.selection_quote ?? '').trim();
  if (!oldText) {
    return c.json({ error: 'old_text is required (or comment must have selection_quote)' }, 400);
  }

  try {
    const result = await editPageSection(
      c.env.DB,
      c.env,
      comment.page_id,
      comment.page_title,
      comment.workspace_id,
      auth.user.id,
      oldText,
      body.new_text,
      body.occurrence ?? 'first',
      body.require_unique ?? false,
    );

    const shouldResolve = body.resolve !== false;
    if (shouldResolve) {
      await c.env.DB.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE id = ?')
        .bind('resolved', now, id).run();
    }

    const openCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM comments
      WHERE page_id = ? AND comment_type = 'agent_instruction' AND status = 'open'
    `).bind(comment.page_id).first<{ count: number }>();

    const updated = await c.env.DB.prepare(`
      SELECT c.*, u.name as author_name FROM comments c
      JOIN users u ON c.user_id = u.id WHERE c.id = ?
    `).bind(id).first();

    return c.json({
      ok: true,
      page_id: comment.page_id,
      comment_id: id,
      old_text: oldText,
      replaced: result.replaced,
      match_count: result.match_count,
      via: result.via,
      comment_resolved: shouldResolve,
      open_count: openCount?.count ?? 0,
      comment: enrichAgentComment(updated as Record<string, unknown>),
    });
  } catch (err) {
    if (err instanceof EditSectionError) {
      const status = err.code === 'ambiguous' ? 409 : err.code === 'not_found' ? 404 : 400;
      return c.json({ error: err.message, code: err.code }, status);
    }
    throw err;
  }
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
    // canvas anchor fields
    anchor_kind?: 'text' | 'component';
    anchor_id?: string;
    anchor_path?: string;
    tags?: string[];
  }>();

  const commentId = generateId();
  const now = Math.floor(Date.now() / 1000);
  const commentType = body.commentType || 'discussion';
  const status = body.status || 'open';
  const anchorKind = body.anchor_kind || 'text';
  const tags = JSON.stringify(body.tags || []);

  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(body.content)) !== null) {
    mentions.push(match[2]);
  }

  await c.env.DB.prepare(`
    INSERT INTO comments
      (id, page_id, block_id, user_id, content, mentions, comment_type, selection_quote, selection_meta, status,
       anchor_kind, anchor_id, anchor_path, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    anchorKind,
    body.anchor_id || null,
    body.anchor_path || null,
    tags,
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
