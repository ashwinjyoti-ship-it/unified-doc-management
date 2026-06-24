import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';

interface SidebarItemMenuProps {
  label: string;
  onDelete: () => void;
  disabled?: boolean;
  light?: boolean;
}

export default function SidebarItemMenu({ label, onDelete, disabled, light }: SidebarItemMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (disabled) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${
          light
            ? 'text-white/70 hover:text-white hover:bg-white/15'
            : 'text-mid-gray hover:text-charcoal hover:bg-linen'
        }`}
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-0.5 z-[60] bg-warm-white border border-green-mist rounded-lg shadow-lg py-1 min-w-[130px]"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-linen flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
