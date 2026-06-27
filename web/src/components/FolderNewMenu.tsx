import { useState, useRef } from 'react';
import { Plus, ChevronDown, FileText, FolderPlus } from 'lucide-react';
import Tooltip from './Tooltip';

interface FolderNewMenuProps {
  onNewPage: () => void | Promise<void>;
  onNewFolder: () => void;
}

export default function FolderNewMenu({ onNewPage, onNewFolder }: FolderNewMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  return (
    <div className="relative shrink-0" ref={ref}>
      <Tooltip text="Create a page or subfolder">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="btn-primary text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          New
          <ChevronDown className="w-3.5 h-3.5 opacity-80" />
        </button>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={close} aria-hidden />
          <div
            className="absolute right-0 top-full mt-1 z-[70] min-w-[10rem] bg-warm-white border border-green-mist rounded-xl shadow-lg py-1 overflow-hidden"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { close(); void onNewPage(); }}
              className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen active:bg-sage/30 flex items-center gap-2"
            >
              <FileText className="w-4 h-4 shrink-0" /> New Page
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { close(); onNewFolder(); }}
              className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen active:bg-sage/30 flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4 shrink-0" /> New Folder
            </button>
          </div>
        </>
      )}
    </div>
  );
}
