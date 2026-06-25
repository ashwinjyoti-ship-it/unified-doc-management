-- Agent instruction comments on selected text
ALTER TABLE comments ADD COLUMN comment_type TEXT DEFAULT 'discussion';
ALTER TABLE comments ADD COLUMN selection_quote TEXT;
ALTER TABLE comments ADD COLUMN selection_meta TEXT;
ALTER TABLE comments ADD COLUMN status TEXT DEFAULT 'open';
