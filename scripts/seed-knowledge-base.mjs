#!/usr/bin/env node
/**
 * Seeds a "My Knowledge Base" demo workspace with folders, pages, links, and a daily note.
 *
 * Usage:
 *   npm run seed:knowledge-base
 *   API_URL=http://localhost:8787 SEED_EMAIL=you@mail.com SEED_PASSWORD=secret npm run seed:knowledge-base
 *
 * Without SEED_EMAIL, registers knowledge-demo@example.com / demo1234 (or logs in if exists).
 */

const API_URL = (process.env.API_URL || 'http://localhost:8787').replace(/\/$/, '');
const DEMO_EMAIL = process.env.SEED_EMAIL || 'knowledge-demo@example.com';
const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'demo1234';
const DEMO_NAME = process.env.SEED_NAME || 'Knowledge Demo';

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.error || res.statusText}`);
  return data;
}

async function auth() {
  if (process.env.SEED_TOKEN) {
    return { token: process.env.SEED_TOKEN, workspaceId: process.env.SEED_WORKSPACE_ID };
  }
  try {
    const login = await api('/auth/login', {
      method: 'POST',
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    const { workspaces } = await api('/workspaces', { token: login.token });
    return { token: login.token, workspaceId: workspaces[0]?.id, email: DEMO_EMAIL, password: DEMO_PASSWORD };
  } catch {
    const reg = await api('/auth/register', {
      method: 'POST',
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME },
    });
    return { token: reg.token, workspaceId: reg.workspaceId, email: DEMO_EMAIL, password: DEMO_PASSWORD, created: true };
  }
}

async function createPage(token, workspaceId, data) {
  const { page } = await api(`/workspaces/${workspaceId}/pages`, {
    method: 'POST',
    token,
    body: data,
  });
  return page;
}

async function setMarkdown(token, pageId, markdown) {
  await api(`/pages/${pageId}/markdown`, { method: 'PUT', token, body: { markdown } });
}

async function main() {
  console.log(`\n🌱 Seeding Knowledge Base at ${API_URL}\n`);

  const { token, workspaceId, email, password, created } = await auth();
  if (!workspaceId) throw new Error('No workspace found');

  await api(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    token,
    body: { name: 'My Knowledge Base' },
  });

  const today = new Date().toLocaleDateString('en-CA');

  const folders = {
    learning: await createPage(token, workspaceId, { title: 'Learning', type: 'folder', icon: '📚' }),
    ideas: await createPage(token, workspaceId, { title: 'Ideas', type: 'folder', icon: '💡' }),
    tasks: await createPage(token, workspaceId, { title: 'Tasks', type: 'folder', icon: '📋' }),
    interesting: await createPage(token, workspaceId, { title: 'Interesting', type: 'folder', icon: '📰' }),
  };

  const pages = {
    reactHooks: await createPage(token, workspaceId, {
      title: 'React Hooks Deep Dive',
      type: 'page',
      parentId: folders.learning.id,
      icon: '⚛️',
    }),
    sqlBasics: await createPage(token, workspaceId, {
      title: 'SQL Fundamentals',
      type: 'page',
      parentId: folders.learning.id,
      icon: '🗄️',
    }),
    plantApp: await createPage(token, workspaceId, {
      title: 'Plant care app idea',
      type: 'page',
      parentId: folders.ideas.id,
      icon: '🌱',
    }),
    weeklyHabit: await createPage(token, workspaceId, {
      title: 'Weekly review habit',
      type: 'page',
      parentId: folders.ideas.id,
      icon: '✨',
    }),
    readCleanCode: await createPage(token, workspaceId, {
      title: 'Read Clean Code ch.3',
      type: 'page',
      parentId: folders.tasks.id,
      icon: '✅',
    }),
    q3Goals: await createPage(token, workspaceId, {
      title: 'Review Q3 goals',
      type: 'page',
      parentId: folders.tasks.id,
      icon: '🎯',
    }),
    wasmArticle: await createPage(token, workspaceId, {
      title: 'Article: Future of WASM',
      type: 'page',
      parentId: folders.interesting.id,
      icon: '🔗',
    }),
    podcastNotes: await createPage(token, workspaceId, {
      title: 'Podcast: Syntax FM #700',
      type: 'page',
      parentId: folders.interesting.id,
      icon: '🎧',
    }),
    weeklyReview: await createPage(token, workspaceId, {
      title: 'Weekly Review',
      type: 'page',
      icon: '📝',
    }),
    dailyNote: await createPage(token, workspaceId, {
      title: today,
      type: 'page',
      icon: '📅',
    }),
  };

  await setMarkdown(token, pages.reactHooks.id, `# React Hooks Deep Dive

## useState
Local state for a component.

## useEffect
Side effects after render — data fetching, subscriptions.

Related: [[SQL Fundamentals]] for backend queries.
`);

  await setMarkdown(token, pages.sqlBasics.id, `# SQL Fundamentals

- SELECT, WHERE, JOIN
- Indexes speed up lookups

See also [[React Hooks Deep Dive]] for the frontend side.
`);

  await setMarkdown(token, pages.plantApp.id, `# Plant care app idea

Track watering schedules, sunlight needs, and reminders.

Connects to [[Weekly review habit]] for regular check-ins.
`);

  await setMarkdown(token, pages.weeklyHabit.id, `# Weekly review habit

Every Sunday: review [[Weekly Review]] page and tidy folders.
`);

  await setMarkdown(token, pages.readCleanCode.id, `# Read Clean Code ch.3

- [ ] Read functions chapter
- [ ] Note 3 takeaways for team doc
`);

  await setMarkdown(token, pages.q3Goals.id, `# Review Q3 goals

1. Ship knowledge base workflow
2. Improve test coverage
3. Learn WASM basics → see [[Article: Future of WASM]]
`);

  await setMarkdown(token, pages.wasmArticle.id, `# Article: Future of WASM

**Source:** example.com/wasm-future

Key points: near-native speed in the browser, growing toolchain.
`);

  await setMarkdown(token, pages.podcastNotes.id, `# Podcast: Syntax FM #700

Topics: React 19, tooling, career tips.

Follow-up: [[React Hooks Deep Dive]]
`);

  await setMarkdown(token, pages.weeklyReview.id, `# Weekly Review

## This week
- Learning: [[React Hooks Deep Dive]], [[SQL Fundamentals]]
- Ideas captured: [[Plant care app idea]]
- Tasks done: check [[Read Clean Code ch.3]]

## Next week
- [[Review Q3 goals]]
- Read [[Article: Future of WASM]]
`);

  await setMarkdown(token, pages.dailyNote.id, `# Daily note — ${today}

## Captured today
- Finished SQL notes → [[SQL Fundamentals]]
- New idea logged → [[Plant care app idea]]

## Tomorrow
- [[Read Clean Code ch.3]]
`);

  console.log('✅ Knowledge Base seeded!\n');
  console.log('Login:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}${created ? ' (new account)' : ''}`);
  console.log('\nOpen the app and explore:');
  console.log('  • Sidebar → "My Knowledge Base" workspace');
  console.log('  • Folders: 📚 Learning, 💡 Ideas, 📋 Tasks, 📰 Interesting');
  console.log(`  • Daily note: 📅 ${today}`);
  console.log('  • Weekly Review + [[page links]] with backlinks');
  console.log('\nStart page suggestions:');
  console.log(`  /page/${folders.learning.id}  (Learning folder)`);
  console.log(`  /page/${pages.weeklyReview.id}  (Weekly Review)`);
  console.log(`  /page/${pages.dailyNote.id}  (Today\'s note)\n`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  console.error('\nMake sure the API is running: npm run dev');
  process.exit(1);
});
