-- Recreate pages table to add 'canvas' to type CHECK constraint
-- SQLite does not support ALTER TABLE ... DROP CONSTRAINT
--
-- IMPORTANT: Disable FK enforcement before DROP TABLE pages.
-- Cloudflare D1 has PRAGMA foreign_keys = ON by default; without this,
-- DROP TABLE pages would cascade-delete all blocks, comments, and
-- database_rows via their ON DELETE CASCADE foreign keys.
PRAGMA foreign_keys = OFF;

CREATE TABLE pages_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES pages_new(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  type TEXT NOT NULL DEFAULT 'page' CHECK(type IN ('page', 'folder', 'database', 'canvas')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'shared', 'public')),
  content_md TEXT DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_row_page INTEGER NOT NULL DEFAULT 0
);

INSERT INTO pages_new SELECT * FROM pages;

DROP INDEX IF EXISTS idx_pages_workspace;
DROP INDEX IF EXISTS idx_pages_parent;
DROP TABLE pages;
ALTER TABLE pages_new RENAME TO pages;

CREATE INDEX idx_pages_workspace ON pages(workspace_id);
CREATE INDEX idx_pages_parent ON pages(parent_id);

-- Re-enable FK enforcement now that DDL is complete
PRAGMA foreign_keys = ON;

-- Canvas component tree
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
CREATE INDEX idx_canvas_components_page ON canvas_components(page_id);
CREATE INDEX idx_canvas_components_parent ON canvas_components(parent_id);

-- Page-scoped design tokens
CREATE TABLE IF NOT EXISTS canvas_tokens (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('color', 'spacing', 'radius', 'fontSize', 'fontWeight')),
  value TEXT NOT NULL
);
CREATE INDEX idx_canvas_tokens_page ON canvas_tokens(page_id);

-- Extend comments for component anchoring
ALTER TABLE comments ADD COLUMN anchor_kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE comments ADD COLUMN anchor_id TEXT;
ALTER TABLE comments ADD COLUMN anchor_path TEXT;
ALTER TABLE comments ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE comments ADD COLUMN snapshot_before TEXT;

-- Extend page_versions for canvas snapshots
ALTER TABLE page_versions ADD COLUMN canvas_snapshot TEXT;
