import { useState, useEffect, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Tooltip from './Tooltip';

interface CollapsibleSidebarSectionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  tooltip?: string;
  count?: number;
  defaultOpen?: boolean;
  showWhenEmpty?: boolean;
  isEmpty?: boolean;
  children: ReactNode;
}

export default function CollapsibleSidebarSection({
  id,
  title,
  icon,
  tooltip,
  count,
  defaultOpen = true,
  showWhenEmpty = false,
  isEmpty = false,
  children,
}: CollapsibleSidebarSectionProps) {
  const storageKey = `sidebar-section-${id}`;
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const saved = localStorage.getItem(storageKey);
    return saved === null ? defaultOpen : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(open));
  }, [open, storageKey]);

  if (!showWhenEmpty && isEmpty) return null;

  const header = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-mid-gray uppercase tracking-wide hover:bg-linen rounded-lg transition-colors"
      aria-expanded={open}
    >
      {open ? (
        <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
      )}
      {icon}
      <span className="flex-1 text-left">{title}</span>
      {!open && count != null && count > 0 && (
        <span className="text-[10px] font-medium bg-linen text-charcoal px-1.5 py-0.5 rounded-full normal-case tracking-normal">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="mb-2">
      {tooltip ? (
        <Tooltip text={tooltip} position="right">
          {header}
        </Tooltip>
      ) : (
        header
      )}
      {open && <div className="mt-0.5">{children}</div>}
      {open && isEmpty && showWhenEmpty && (
        <p className="px-3 py-2 text-xs text-mid-gray">Star a page from its header to pin it here</p>
      )}
    </div>
  );
}
