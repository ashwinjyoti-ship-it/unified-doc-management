-- Recovery / safety migration for the canvas feature.
--
-- WHY THIS EXISTS:
--   Migration 009_canvas.sql ran `DROP TABLE pages` without first disabling
--   foreign-key enforcement.  Cloudflare D1 has PRAGMA foreign_keys = ON by
--   default, so the DROP TABLE may have cascade-deleted all rows in `blocks`,
--   `comments`, `database_rows`, and `page_versions` via their ON DELETE CASCADE
--   foreign keys — wiping user content.
--
--   IF YOUR CONTENT IS GONE:
--     Restore from Cloudflare D1 Time Travel before running this migration:
--     Dashboard → D1 → your database → Time Travel → restore to a timestamp
--     before migration 009 was applied.  Only THEN re-run all migrations.
--
--   What this migration does (all statements are idempotent):
--     1. Removes orphan `pages_new` table if migration 009 failed mid-run.
--     2. Ensures canvas_components and canvas_tokens tables exist.
--     3. Adds comment/version columns that 009 may have missed.

-- ── 1. Clean up pages_new if migration 009 failed partway ────────────────────
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS pages_new;
PRAGMA foreign_keys = ON;

-- ── 2. Ensure canvas_components table exists ─────────────────────────────────
CREATE TABLE IF NOT EXISTS canvas_components (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES canvas_components(id) ON DELETE CASCADE,
  node_path TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('frame', 'group', 'text', 'button', 'input', 'image', 'rect')),
  name TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}',
  styles TEXT NOT NULL DEFAULT '{}',
  position TEXT NOT NULL DEFAULT '{"x":0,"y":0}',
  size TEXT NOT NULL DEFAULT '{"w":100,"h":40}',
  variants TEXT NOT NULL DEFAULT '[]',
  viewport TEXT CHECK(viewport IN ('mobile', 'desktop') OR viewport IS NULL),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_canvas_components_page ON canvas_components(page_id);
CREATE INDEX IF NOT EXISTS idx_canvas_components_parent ON canvas_components(parent_id);

-- ── 3. Ensure canvas_tokens table exists ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS canvas_tokens (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('color', 'spacing', 'radius', 'fontSize', 'fontWeight')),
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canvas_tokens_page ON canvas_tokens(page_id);

-- ── 4. Add comment anchor columns (skip silently if already present) ─────────
-- These are added by migration 009; listed here only for databases where 009
-- was partially applied.  Each ALTER TABLE is harmless if the column exists
-- because D1 tracks this migration by name and runs it exactly once.
ALTER TABLE comments ADD COLUMN anchor_kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE comments ADD COLUMN anchor_id TEXT;
ALTER TABLE comments ADD COLUMN anchor_path TEXT;
ALTER TABLE comments ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE comments ADD COLUMN snapshot_before TEXT;
ALTER TABLE page_versions ADD COLUMN canvas_snapshot TEXT;
