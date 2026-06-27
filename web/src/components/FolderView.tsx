import FolderNewMenu from './FolderNewMenu';

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
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-4xl shrink-0">📁</span>
        <h2 className="text-lg font-medium text-charcoal truncate">{folderTitle}</h2>
      </div>
      <FolderNewMenu onNewPage={onNewPage} onNewFolder={onNewFolder} />
    </div>
  );
}
