-- Tags
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#97B79E',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, name)
);

CREATE TABLE page_tags (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- Favorites
CREATE TABLE page_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, page_id)
);

CREATE INDEX idx_page_favorites_user ON page_favorites(user_id);

-- Recent views
CREATE TABLE page_views (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  viewed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, page_id)
);

CREATE INDEX idx_page_views_user ON page_views(user_id, viewed_at DESC);

-- User preferences (theme)
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK(theme IN ('light', 'dark', 'system')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
