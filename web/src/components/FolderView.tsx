import { useNavigate } from 'react-router-dom';
import { Plus, FolderPlus, FileText } from 'lucide-react';
import type { Page } from '../types';
import { getChildren, pageIcon } from '../lib/pageTree';
import Tooltip from './Tooltip';

interface FolderViewProps {
  folderId: string;
  folderTitle: string;
  pages: Page[];
  onNewPage: () => void | Promise<void>;
  onNewFolder: () => void;
}

export default function FolderView({
  folderId,
  folderTitle,
  pages,
  onNewPage,
  onNewFolder,
}: FolderViewProps) {
  const navigate = useNavigate();
  const children = getChildren(pages, folderId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">📁</span>
        <div>
          <h2 className="text-lg font-medium text-charcoal">{folderTitle}</h2>
          <p className="text-sm text-mid-gray">{children.length} item{children.length === 1 ? '' : 's'}</p>
        </div>
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

      {children.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-green-mist bg-linen/30">
          <FileText className="w-10 h-10 text-mid-gray mx-auto mb-3 opacity-50" />
          <p className="text-mid-gray text-sm mb-1">This folder is empty</p>
          <p className="text-xs text-mid-gray">
            Add pages here, or drag items from the sidebar into &ldquo;{folderTitle}&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => navigate(`/page/${child.id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-green-mist hover:border-forest hover:bg-sage/10 transition-colors text-left text-charcoal"
            >
              <span className="text-xl shrink-0">{pageIcon(child)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate text-charcoal">{child.title}</div>
                <div className="text-xs text-mid-gray capitalize">{child.type}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
