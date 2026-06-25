-- Mark database row backing pages so they can be hidden from the sidebar tree
ALTER TABLE pages ADD COLUMN is_row_page INTEGER NOT NULL DEFAULT 0;

UPDATE pages SET is_row_page = 1
WHERE id IN (SELECT page_id FROM database_rows WHERE page_id IS NOT NULL);
