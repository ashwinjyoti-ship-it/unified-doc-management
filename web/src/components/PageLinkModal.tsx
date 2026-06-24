import { useState } from 'react';
import type { Page } from '../types';
import { pageIcon } from '../lib/pageTree';

interface PageLinkModalProps {
  open: boolean;
  pages: Page[];
  currentPageId?: string;
  onClose: () => void;
  onSelect: (page: Page) => void;
}

export default function PageLinkModal({
  open, pages, currentPageId, onClose, onSelect,
}: PageLinkModalProps) {
  const [query, setQuery] = useState('');

  if (!open) return null;

  const filtered = pages
    .filter((p) => p.id !== currentPageId && p.type !== 'folder')
    .filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="card-surface w-full max-w-md max-h-[70vh] flex flex-col rounded-t-2xl md:rounded-[14px] safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-green-mist">
          <h3 className="font-semibold mb-2">Link to page</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full px-3 py-2 rounded-lg border border-green-mist bg-warm-white outline-none focus:border-forest text-sm"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-mid-gray text-center py-8">No pages found</p>
          ) : (
            filtered.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => { onSelect(page); onClose(); setQuery(''); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-linen text-left text-sm"
              >
                <span>{pageIcon(page)}</span>
                <span className="truncate">{page.title}</span>
              </button>
            ))
          )}
        </div>
        <div className="p-3 border-t border-green-mist">
          <button type="button" onClick={onClose} className="btn-secondary w-full text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
