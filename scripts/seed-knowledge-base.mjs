#!/usr/bin/env node
/**
 * Seeds a "My Knowledge Base" demo into a workspace.
 *
 * Usage:
 *   npm run seed:knowledge-base
 *   SEED_EMAIL=you@mail.com SEED_PASSWORD=secret npm run seed:knowledge-base
 *   API_URL=https://your-app.pages.dev SEED_EMAIL=... SEED_PASSWORD=... npm run seed:knowledge-base
 *
 * Without SEED_EMAIL, uses knowledge-demo@example.com / demo1234
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
    return { token: process.env.SEED_TOKEN, email: '(token)', password: '' };
  }
  try {
    const login = await api('/auth/login', {
      method: 'POST',
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    return { token: login.token, email: DEMO_EMAIL, password: DEMO_PASSWORD };
  } catch {
    const reg = await api('/auth/register', {
      method: 'POST',
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME },
    });
    return { token: reg.token, email: DEMO_EMAIL, password: DEMO_PASSWORD, created: true };
  }
}

async function main() {
  console.log(`\n🌱 Seeding Knowledge Base at ${API_URL}\n`);

  const { token, email, password, created } = await auth();
  const result = await api('/seed/knowledge-base', { method: 'POST', token });

  console.log(result.alreadySeeded ? 'ℹ️  Already seeded' : '✅ Knowledge Base seeded!');
  console.log(`   ${result.message}\n`);
  console.log('Login:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}${created ? ' (new account)' : ''}`);
  console.log('\nOr use Settings → Load demo Knowledge Base while logged in.\n');
  console.log('Explore:');
  console.log(`  Project:          /page/${result.pageIds.projectId}`);
  console.log(`  Learning folder:  /page/${result.pageIds.learningFolderId}`);
  console.log(`  Weekly Review:    /page/${result.pageIds.weeklyReviewId}`);
  console.log(`  Today's note:     /page/${result.pageIds.dailyNoteId} (${result.dailyNoteTitle})\n`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  console.error('\nTip: use npm (not npn):  npm run seed:knowledge-base');
  console.error('Make sure the API is running: npm run dev\n');
  process.exit(1);
});
