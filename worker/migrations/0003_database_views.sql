-- Saved database views (filters + sort per view)
CREATE TABLE database_views (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'table',
  filters TEXT NOT NULL DEFAULT '[]',
  sort_config TEXT NOT NULL DEFAULT '[]',
  order_index REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_database_views_db ON database_views(database_id);
