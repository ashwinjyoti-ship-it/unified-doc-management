# AGENTS.md

## Cursor Cloud specific instructions

Standard setup/run/deploy commands live in `README.md` and `DEPLOY.md`; this section only records non-obvious caveats for running the app locally in this environment.

### Architecture

Monorepo (npm workspaces: `web`, `worker`):

- `web/` — React 19 + Vite + Tailwind + TipTap frontend. Dev server on `http://localhost:5173`, proxies `/api` → `http://localhost:8787` (see `web/vite.config.ts`).
- `worker/` — Cloudflare Pages/Workers backend (Hono) backed by D1 (SQLite) and a `CollabRoom` Durable Object for realtime collaboration. API on `http://localhost:8787`.

The startup-time update script runs `npm install` only. Migrations, builds, and starting services are intentionally left out of it — do them as needed using the steps below.

### Required local secret (auth 500s without it)

The worker reads `JWT_SECRET` from `worker/.dev.vars` (gitignored). Without it, `/api/auth/*` returns 500. Create it once per fresh VM:

```bash
printf 'JWT_SECRET=dev-secret-change-in-production\n' > worker/.dev.vars
```

### Local D1 must be migrated before use

```bash
npm run db:migrate:local   # applies worker/migrations to local D1 "unified-doc-db"
```

### GOTCHA: `npm run dev` binds the wrong local D1

The packaged `npm run dev:worker` runs `wrangler pages dev ../web/dist --d1=DB`. The `--d1=DB` flag creates a **separate, empty** local D1 (shown as `env.DB (local-DB)`) instead of the migrated `unified-doc-db`, so API calls fail with `D1_ERROR: no such table: users`. It also leaves the Durable Object `[not connected]` (the Pages config's DO uses an external `script_name`).

Run the backend via `wrangler.worker.jsonc` instead — it binds the real `unified-doc-db` D1 (`env.DB (unified-doc-db)`), the `CollabRoom` Durable Object locally, and serves `web/dist` as SPA assets with `/api/*` routed to the worker:

```bash
# Terminal 1 — backend (API + assets + D1 + Durable Object) on :8787
cd worker && npx wrangler dev --config wrangler.worker.jsonc --port 8787

# Terminal 2 — frontend with HMR on :5173 (proxies /api -> :8787)
npm run dev:web
```

Then open `http://localhost:5173`. `wrangler.worker.jsonc` compiles `worker/src/index.ts` directly (no bundle step) and hot-reloads on source changes.

If you must use `npm run dev` / `wrangler pages dev`, first build the Pages bundle (`npm run build && npm run build:pages-worker`); note it still hits the empty-D1 gotcha above and the worker bundle does not hot-reload (rerun `npm run build:pages-worker` after worker edits).

### Checks / build

- No lint script. `npm run build` (Vite, `web`) and `npm run build:pages-worker` (esbuild, `worker`) are the real build checks and both pass.
- `tsc -p worker/tsconfig.json --noEmit` reports pre-existing type errors (e.g. `collab-room.ts`, Hono context generics). `tsc` is NOT part of the build pipeline (worker ships via esbuild), so these do not block building or running. `tsc -p web/tsconfig.json --noEmit` is clean.
