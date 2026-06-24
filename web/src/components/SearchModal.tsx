import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Search, X } from 'lucide-react';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export default function SearchModal() {
  const { searchOpen, setSearchOpen } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; title: string; icon: string; type: string; snippet: string }>>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { results: r } = await api.search(query);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-start md:justify-center md:pt-[15vh] p-0 md:p-4" onClick={() => setSearchOpen(false)}>
      <div className="card-surface w-full max-w-xl overflow-hidden rounded-t-2xl md:rounded-[14px] safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-green-mist">
          <Search className="w-5 h-5 text-mid-gray" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all pages..."
            className="flex-1 bg-transparent border-none outline-none text-charcoal"
          />
          <button onClick={() => setSearchOpen(false)}>
            <X className="w-5 h-5 text-mid-gray" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && <div className="p-4 text-sm text-mid-gray">Searching...</div>}
          {!loading && query && results.length === 0 && (
            <div className="p-4 text-sm text-mid-gray">No results found.</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => { navigate(`/page/${r.id}`); setSearchOpen(false); }}
              className="w-full text-left p-4 hover:bg-linen border-b border-green-mist/30 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span>{r.icon || (r.type === 'database' ? '🗃️' : '📄')}</span>
                <span className="font-medium text-sm">{r.title}</span>
              </div>
              {r.snippet && (
                <div className="text-xs text-warm-gray mt-1 line-clamp-2">
                  {stripHtml(r.snippet)}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
