import { useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { RelationRowOption } from '../types';

interface RelationPickerProps {
  options: RelationRowOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export default function RelationPicker({ options, selected, onChange, className = '' }: RelationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.title.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const selectedLabels = selected
    .map((id) => options.find((o) => o.id === id)?.title || id)
    .filter(Boolean);

  return (
    <div className={`relative min-w-[140px] ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded-lg hover:bg-linen text-sm text-charcoal text-left"
      >
        <span className="truncate">
          {selectedLabels.length ? selectedLabels.join(', ') : 'Select…'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-mid-gray" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-56 max-h-64 overflow-hidden rounded-xl border border-green-mist bg-warm-white shadow-lg flex flex-col">
            <div className="p-2 border-b border-green-mist/50">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-linen border-none outline-none text-charcoal db-cell-input"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-mid-gray px-2 py-1">No matches</p>
              ) : (
                filtered.map((opt) => {
                  const on = selectedSet.has(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggle(opt.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                        on ? 'bg-forest/15 text-forest' : 'hover:bg-linen text-charcoal'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        on ? 'bg-forest border-forest text-white' : 'border-green-mist bg-warm-white'
                      }`}>
                        {on && '✓'}
                      </span>
                      <span className="truncate">{opt.title}</span>
                    </button>
                  );
                })
              )}
            </div>
            {selected.length > 0 && (
              <div className="p-2 border-t border-green-mist/50 flex flex-wrap gap-1">
                {selected.map((id) => {
                  const label = options.find((o) => o.id === id)?.title || id;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-forest/15 text-forest"
                    >
                      {label}
                      <button type="button" onClick={() => toggle(id)} className="hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
