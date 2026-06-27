import { Plus, FolderPlus } from 'lucide-react';
import Tooltip from './Tooltip';

interface FolderViewProps {
  folderTitle: string;
  onNewPage: () => void | Promise<void>;
  onNewFolder: () => void;
}

export default function FolderView({
  folderTitle,
  onNewPage,
  onNewFolder,
}: FolderViewProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">📁</span>
        <h2 className="text-lg font-medium text-charcoal">{folderTitle}</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <Tooltip text="Create a new page inside this folder">
          <button
            type="button"
            onClick={() => void onNewPage()}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Page
          </button>
        </Tooltip>
        <Tooltip text="Create a subfolder inside this folder">
          <button
            type="button"
            onClick={() => onNewFolder()}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" /> New Folder
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
