import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import Tooltip from './Tooltip';

interface SidebarItemMenuProps {
  label: string;
  onRename?: () => void;
  onDelete: () => void;
  disabled?: boolean;
  light?: boolean;
}

export default function SidebarItemMenu({ label, onRename, onDelete, disabled, light }: SidebarItemMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 130;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    setMenuStyle({ top: rect.bottom + 2, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (disabled) return null;

  return (
    <div className="relative shrink-0" ref={triggerRef}>
      <Tooltip text={`Actions for "${label}" — rename or delete`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className={`p-1 rounded-md opacity-80 md:opacity-50 md:group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity ${
            light
              ? 'text-white/70 hover:text-white hover:bg-white/15'
              : 'text-mid-gray hover:text-charcoal hover:bg-linen'
          }`}
          aria-label={`Actions for ${label}`}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </Tooltip>
      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, zIndex: 100 }}
          className="bg-warm-white border border-green-mist rounded-lg shadow-lg py-1 min-w-[130px]"
          role="menu"
        >
          {onRename && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onRename();
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-linen flex items-center gap-2 text-charcoal"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" /> Rename
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
