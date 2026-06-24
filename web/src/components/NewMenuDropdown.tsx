import { useState, useRef } from 'react';
import { Plus, ChevronDown, FileText, FolderPlus, Database } from 'lucide-react';
import Tooltip from './Tooltip';

interface NewMenuDropdownProps {
  onNewPage: () => void;
  onNewFolder: () => void;
  onNewDatabase: () => void;
  className?: string;
  /** Compact icon-only style for tight mobile headers */
  variant?: 'default' | 'compact';
}

export default function NewMenuDropdown({
  onNewPage,
  onNewFolder,
  onNewDatabase,
  className = '',
  variant = 'default',
}: NewMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  const itemClass =
    'w-full px-4 py-3 md:py-2.5 text-sm text-left hover:bg-linen active:bg-sage/30 flex items-center gap-2';

  return (
    <div className={`relative ${className}`} ref={ref}>
      {variant === 'compact' ? (
        <Tooltip text="Create page, folder, or database">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="btn-primary p-2 rounded-lg flex items-center gap-0.5"
            aria-label="Create new"
          >
            <Plus className="w-5 h-5" />
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      ) : (
        <div className="flex">
          <Tooltip text="Create a new page, folder, or database">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-1 rounded-r-none"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </Tooltip>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="btn-primary px-2 rounded-l-none border-l border-white/20"
            aria-label="More create options"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={close} aria-hidden />
          <div
            className={`
              z-[70] bg-warm-white border border-green-mist rounded-xl shadow-lg py-1 overflow-hidden
              ${variant === 'compact'
                ? 'fixed left-3 right-3 bottom-4 md:absolute md:left-0 md:right-0 md:bottom-auto md:top-full md:mt-1'
                : 'absolute left-0 right-0 top-full mt-1'}
            `}
            role="menu"
          >
            {variant === 'compact' && (
              <div className="px-4 py-2 text-xs font-medium text-mid-gray uppercase tracking-wide border-b border-green-mist">
                Create new
              </div>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => { close(); onNewPage(); }}
              className={itemClass}
            >
              <FileText className="w-4 h-4 shrink-0" /> New Page
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { close(); onNewFolder(); }}
              className={itemClass}
            >
              <FolderPlus className="w-4 h-4 shrink-0" /> New Folder
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { close(); onNewDatabase(); }}
              className={itemClass}
            >
              <Database className="w-4 h-4 shrink-0" /> New Database
            </button>
          </div>
        </>
      )}
    </div>
  );
}
