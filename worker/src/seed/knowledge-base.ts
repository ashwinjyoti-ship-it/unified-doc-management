import { generateId, markdownToBlocks, syncBacklinks } from '../utils';

export interface KnowledgeBaseSeedResult {
  alreadySeeded: boolean;
  migrated?: boolean;
  workspaceName: string;
  dailyNoteTitle: string;
  pageIds: {
    projectId: string;
    learningFolderId: string;
    weeklyReviewId: string;
    dailyNoteId: string;
  };
  message: string;
}

export interface LegacyMigrationResult {
  migrated: boolean;
  projectId?: string;
  movedCount: number;
  message: string;
}

const DEMO_FOLDER_TITLES = ['Learning', 'Ideas', 'Tasks', 'Interesting'] as const;
const PROJECT_TITLE = 'My Knowledge Base';

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

/** Move flat demo folders (Learning, Ideas, …) under one My Knowledge Base project. Idempotent. */
export async function migrateLegacyKnowledgeBase(
  db: D1Database,
  workspaceId: string,
  userId: string,
): Promise<LegacyMigrationResult> {
  const existingProject = await db.prepare(`
    SELECT id FROM pages
    WHERE workspace_id = ? AND type = 'folder' AND title = ? AND parent_id IS NULL
    LIMIT 1
  `).bind(workspaceId, PROJECT_TITLE).first<{ id: string }>();

  if (existingProject) {
    return {
      migrated: false,
      projectId: existingProject.id,
      movedCount: 0,
      message: 'Knowledge Base project already exists.',
    };
  }

  const rootDemoFolders = await db.prepare(`
    SELECT id, title FROM pages
    WHERE workspace_id = ? AND type = 'folder' AND parent_id IS NULL
      AND title IN (${DEMO_FOLDER_TITLES.map(() => '?').join(', ')})
  `).bind(workspaceId, ...DEMO_FOLDER_TITLES).all<{ id: string; title: string }>();

  const folders = rootDemoFolders.results ?? [];
  const hasLearning = folders.some((f) => f.title === 'Learning');
  if (!hasLearning || folders.length === 0) {
    return { migrated: false, movedCount: 0, message: 'No legacy demo layout detected.' };
  }

  const now = Math.floor(Date.now() / 1000);
  let projectId: string;

  const namedProject = await db.prepare(`
    SELECT id FROM pages
    WHERE workspace_id = ? AND type = 'folder' AND title = ?
    LIMIT 1
  `).bind(workspaceId, PROJECT_TITLE).first<{ id: string }>();

  if (namedProject) {
    projectId = namedProject.id;
    await db.prepare('UPDATE pages SET parent_id = NULL, updated_at = ? WHERE id = ?')
      .bind(now, projectId).run();
  } else {
    projectId = await insertPage(db, workspaceId, userId, {
      title: PROJECT_TITLE,
      type: 'folder',
      icon: '🗂️',
      parentId: null,
    });
  }

  let movedCount = 0;
  for (const folder of folders) {
    await db.prepare('UPDATE pages SET parent_id = ?, updated_at = ? WHERE id = ?')
      .bind(projectId, now, folder.id).run();
    movedCount++;
  }

  const weeklyAtRoot = await db.prepare(`
    SELECT id FROM pages
    WHERE workspace_id = ? AND title = 'Weekly Review' AND type = 'page' AND parent_id IS NULL
    LIMIT 1
  `).bind(workspaceId).first<{ id: string }>();

  if (weeklyAtRoot) {
    await db.prepare('UPDATE pages SET parent_id = ?, updated_at = ? WHERE id = ?')
      .bind(projectId, now, weeklyAtRoot.id).run();
    movedCount++;
  }

  await db.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
    .bind(PROJECT_TITLE, now, workspaceId).run();

  return {
    migrated: true,
    projectId,
    movedCount,
    message: `Organized ${movedCount} demo item(s) under "${PROJECT_TITLE}".`,
  };
}

async function resolveSeedPageIds(db: D1Database, workspaceId: string, projectId: string) {
  const learning = await db.prepare(`
    SELECT id FROM pages WHERE workspace_id = ? AND title = 'Learning' LIMIT 1
  `).bind(workspaceId).first<{ id: string }>();
  const weekly = await db.prepare(`
    SELECT id FROM pages WHERE workspace_id = ? AND title = 'Weekly Review' LIMIT 1
  `).bind(workspaceId).first<{ id: string }>();
  const today = new Date().toLocaleDateString('en-CA');
  const daily = await db.prepare(`
    SELECT id FROM pages WHERE workspace_id = ? AND title = ? LIMIT 1
  `).bind(workspaceId, today).first<{ id: string }>();

  return {
    projectId,
    learningFolderId: learning?.id || projectId,
    weeklyReviewId: weekly?.id || projectId,
    dailyNoteId: daily?.id || projectId,
  };
}

export async function seedKnowledgeBase(
  db: D1Database,
  workspaceId: string,
  userId: string,
): Promise<KnowledgeBaseSeedResult> {
  const existingProject = await db.prepare(`
    SELECT id, title FROM pages
    WHERE workspace_id = ? AND type = 'folder' AND title = ? AND parent_id IS NULL
    LIMIT 1
  `).bind(workspaceId, PROJECT_TITLE).first<{ id: string; title: string }>();

  const legacyLearning = !existingProject ? await db.prepare(`
    SELECT id, title FROM pages
    WHERE workspace_id = ? AND type = 'folder' AND title = 'Learning' AND parent_id IS NULL
    LIMIT 1
  `).bind(workspaceId).first<{ id: string; title: string }>() : null;

  if (legacyLearning) {
    const migration = await migrateLegacyKnowledgeBase(db, workspaceId, userId);
    const today = new Date().toLocaleDateString('en-CA');
    const projectId = migration.projectId ?? legacyLearning.id;
    return {
      alreadySeeded: true,
      migrated: migration.migrated,
      workspaceName: PROJECT_TITLE,
      dailyNoteTitle: today,
      pageIds: await resolveSeedPageIds(db, workspaceId, projectId),
      message: migration.message,
    };
  }

  if (existingProject) {
    const today = new Date().toLocaleDateString('en-CA');
    return {
      alreadySeeded: true,
      workspaceName: PROJECT_TITLE,
      dailyNoteTitle: today,
      pageIds: await resolveSeedPageIds(db, workspaceId, existingProject.id),
      message: 'Demo Knowledge Base already exists in this workspace.',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  await db.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
    .bind(PROJECT_TITLE, now, workspaceId).run();

  const today = new Date().toLocaleDateString('en-CA');

  const projectId = await insertPage(db, workspaceId, userId, {
    title: PROJECT_TITLE, type: 'folder', icon: '🗂️',
  });

  const learningId = await insertPage(db, workspaceId, userId, {
    title: 'Learning', type: 'folder', icon: '📚', parentId: projectId,
  });
  const ideasId = await insertPage(db, workspaceId, userId, {
    title: 'Ideas', type: 'folder', icon: '💡', parentId: projectId,
  });
  const tasksId = await insertPage(db, workspaceId, userId, {
    title: 'Tasks', type: 'folder', icon: '📋', parentId: projectId,
  });
  const interestingId = await insertPage(db, workspaceId, userId, {
    title: 'Interesting', type: 'folder', icon: '📰', parentId: projectId,
  });

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
    title: 'Weekly Review', type: 'page', icon: '📝', parentId: projectId,
  });
  const dailyNoteId = await insertPage(db, workspaceId, userId, {
    title: today, type: 'page', icon: '📅', parentId: null,
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
    workspaceName: PROJECT_TITLE,
    dailyNoteTitle: today,
    pageIds: {
      projectId,
      learningFolderId: learningId,
      weeklyReviewId,
      dailyNoteId,
    },
    message: 'Demo Knowledge Base loaded — open the My Knowledge Base project to explore.',
  };
}
