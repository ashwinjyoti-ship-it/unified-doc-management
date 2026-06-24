import { generateId, markdownToBlocks, syncBacklinks } from '../utils';

export interface KnowledgeBaseSeedResult {
  alreadySeeded: boolean;
  workspaceName: string;
  dailyNoteTitle: string;
  pageIds: {
    learningFolderId: string;
    weeklyReviewId: string;
    dailyNoteId: string;
  };
  message: string;
}

async function updatePageFts(db: D1Database, pageId: string, title: string, content: string) {
  await db.prepare('DELETE FROM pages_fts WHERE page_id = ?').bind(pageId).run();
  await db.prepare('INSERT INTO pages_fts (page_id, title, content) VALUES (?, ?, ?)')
    .bind(pageId, title, content).run();
}

async function insertPage(
  db: D1Database,
  workspaceId: string,
  userId: string,
  data: { title: string; type: string; icon?: string; parentId?: string | null },
): Promise<string> {
  const pageId = generateId();
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO pages (id, workspace_id, parent_id, title, icon, type, visibility, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'private', ?, ?, ?)
  `).bind(
    pageId, workspaceId, data.parentId ?? null, data.title, data.icon ?? null,
    data.type, userId, now, now,
  ).run();

  if (data.type === 'page') {
    await db.prepare(
      'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), pageId, 'paragraph', JSON.stringify({ text: '' }), 0, now, now).run();
  }

  await updatePageFts(db, pageId, data.title, '');
  return pageId;
}

async function setPageMarkdown(
  db: D1Database,
  workspaceId: string,
  pageId: string,
  title: string,
  markdown: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const parsed = markdownToBlocks(markdown);

  await db.prepare('DELETE FROM blocks WHERE page_id = ?').bind(pageId).run();
  for (let i = 0; i < parsed.length; i++) {
    await db.prepare(
      'INSERT INTO blocks (id, page_id, type, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), pageId, parsed[i].type, JSON.stringify(parsed[i].content), i, now, now).run();
  }

  await db.prepare('UPDATE pages SET content_md = ?, updated_at = ? WHERE id = ?')
    .bind(markdown, now, pageId).run();
  await updatePageFts(db, pageId, title, markdown);
  await syncBacklinks(db, pageId, workspaceId, markdown);
}

export async function seedKnowledgeBase(
  db: D1Database,
  workspaceId: string,
  userId: string,
): Promise<KnowledgeBaseSeedResult> {
  const existing = await db.prepare(`
    SELECT id, title FROM pages
    WHERE workspace_id = ? AND type = 'folder' AND title = 'Learning' AND parent_id IS NULL
    LIMIT 1
  `).bind(workspaceId).first<{ id: string; title: string }>();

  if (existing) {
    const weekly = await db.prepare(`
      SELECT id FROM pages WHERE workspace_id = ? AND title = 'Weekly Review' LIMIT 1
    `).bind(workspaceId).first<{ id: string }>();
    const today = new Date().toLocaleDateString('en-CA');
    const daily = await db.prepare(`
      SELECT id FROM pages WHERE workspace_id = ? AND title = ? LIMIT 1
    `).bind(workspaceId, today).first<{ id: string }>();

    return {
      alreadySeeded: true,
      workspaceName: 'My Knowledge Base',
      dailyNoteTitle: today,
      pageIds: {
        learningFolderId: existing.id,
        weeklyReviewId: weekly?.id || existing.id,
        dailyNoteId: daily?.id || existing.id,
      },
      message: 'Demo Knowledge Base already exists in this workspace.',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  await db.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
    .bind('My Knowledge Base', now, workspaceId).run();

  const today = new Date().toLocaleDateString('en-CA');

  const learningId = await insertPage(db, workspaceId, userId, { title: 'Learning', type: 'folder', icon: '📚' });
  const ideasId = await insertPage(db, workspaceId, userId, { title: 'Ideas', type: 'folder', icon: '💡' });
  const tasksId = await insertPage(db, workspaceId, userId, { title: 'Tasks', type: 'folder', icon: '📋' });
  const interestingId = await insertPage(db, workspaceId, userId, { title: 'Interesting', type: 'folder', icon: '📰' });

  const reactHooksId = await insertPage(db, workspaceId, userId, {
    title: 'React Hooks Deep Dive', type: 'page', icon: '⚛️', parentId: learningId,
  });
  const sqlBasicsId = await insertPage(db, workspaceId, userId, {
    title: 'SQL Fundamentals', type: 'page', icon: '🗄️', parentId: learningId,
  });
  const plantAppId = await insertPage(db, workspaceId, userId, {
    title: 'Plant care app idea', type: 'page', icon: '🌱', parentId: ideasId,
  });
  const weeklyHabitId = await insertPage(db, workspaceId, userId, {
    title: 'Weekly review habit', type: 'page', icon: '✨', parentId: ideasId,
  });
  const readCleanCodeId = await insertPage(db, workspaceId, userId, {
    title: 'Read Clean Code ch.3', type: 'page', icon: '✅', parentId: tasksId,
  });
  const q3GoalsId = await insertPage(db, workspaceId, userId, {
    title: 'Review Q3 goals', type: 'page', icon: '🎯', parentId: tasksId,
  });
  const wasmArticleId = await insertPage(db, workspaceId, userId, {
    title: 'Article: Future of WASM', type: 'page', icon: '🔗', parentId: interestingId,
  });
  const podcastId = await insertPage(db, workspaceId, userId, {
    title: 'Podcast: Syntax FM #700', type: 'page', icon: '🎧', parentId: interestingId,
  });
  const weeklyReviewId = await insertPage(db, workspaceId, userId, {
    title: 'Weekly Review', type: 'page', icon: '📝',
  });
  const dailyNoteId = await insertPage(db, workspaceId, userId, {
    title: today, type: 'page', icon: '📅',
  });

  await setPageMarkdown(db, workspaceId, reactHooksId, 'React Hooks Deep Dive', `# React Hooks Deep Dive

## useState
Local state for a component.

## useEffect
Side effects after render — data fetching, subscriptions.

Related: [[SQL Fundamentals]] for backend queries.
`);

  await setPageMarkdown(db, workspaceId, sqlBasicsId, 'SQL Fundamentals', `# SQL Fundamentals

- SELECT, WHERE, JOIN
- Indexes speed up lookups

See also [[React Hooks Deep Dive]] for the frontend side.
`);

  await setPageMarkdown(db, workspaceId, plantAppId, 'Plant care app idea', `# Plant care app idea

Track watering schedules, sunlight needs, and reminders.

Connects to [[Weekly review habit]] for regular check-ins.
`);

  await setPageMarkdown(db, workspaceId, weeklyHabitId, 'Weekly review habit', `# Weekly review habit

Every Sunday: review [[Weekly Review]] page and tidy folders.
`);

  await setPageMarkdown(db, workspaceId, readCleanCodeId, 'Read Clean Code ch.3', `# Read Clean Code ch.3

- [ ] Read functions chapter
- [ ] Note 3 takeaways for team doc
`);

  await setPageMarkdown(db, workspaceId, q3GoalsId, 'Review Q3 goals', `# Review Q3 goals

1. Ship knowledge base workflow
2. Improve test coverage
3. Learn WASM basics → see [[Article: Future of WASM]]
`);

  await setPageMarkdown(db, workspaceId, wasmArticleId, 'Article: Future of WASM', `# Article: Future of WASM

**Source:** example.com/wasm-future

Key points: near-native speed in the browser, growing toolchain.
`);

  await setPageMarkdown(db, workspaceId, podcastId, 'Podcast: Syntax FM #700', `# Podcast: Syntax FM #700

Topics: React 19, tooling, career tips.

Follow-up: [[React Hooks Deep Dive]]
`);

  await setPageMarkdown(db, workspaceId, weeklyReviewId, 'Weekly Review', `# Weekly Review

## This week
- Learning: [[React Hooks Deep Dive]], [[SQL Fundamentals]]
- Ideas captured: [[Plant care app idea]]
- Tasks done: check [[Read Clean Code ch.3]]

## Next week
- [[Review Q3 goals]]
- Read [[Article: Future of WASM]]
`);

  await setPageMarkdown(db, workspaceId, dailyNoteId, today, `# Daily note — ${today}

## Captured today
- Finished SQL notes → [[SQL Fundamentals]]
- New idea logged → [[Plant care app idea]]

## Tomorrow
- [[Read Clean Code ch.3]]
`);

  return {
    alreadySeeded: false,
    workspaceName: 'My Knowledge Base',
    dailyNoteTitle: today,
    pageIds: {
      learningFolderId: learningId,
      weeklyReviewId,
      dailyNoteId,
    },
    message: 'Demo Knowledge Base loaded with folders, pages, and links.',
  };
}
