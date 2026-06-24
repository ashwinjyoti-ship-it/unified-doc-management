-- Add checkbox property type
CREATE TABLE database_properties_new (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('text', 'number', 'date', 'select', 'multi_select', 'relation', 'rollup', 'checkbox')),
  options TEXT DEFAULT '[]',
  order_index REAL NOT NULL DEFAULT 0
);

INSERT INTO database_properties_new SELECT * FROM database_properties;
DROP TABLE database_properties;
ALTER TABLE database_properties_new RENAME TO database_properties;
