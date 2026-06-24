import { Menu, Search as SearchIcon } from 'lucide-react';
import { useStore } from '../lib/store';
import NewMenuDropdown from './NewMenuDropdown';
import NamePromptModal from './NamePromptModal';
import { useDocumentCreate } from '../hooks/useDocumentCreate';
import Tooltip from './Tooltip';

export default function MobileTopBar() {
  const { workspace, setSidebarOpen, setSearchOpen } = useStore();
  const {
    folderModal,
    setFolderModal,
    handleNewPage,
    handleNewDatabase,
    handleNewFolderRequest,
    handleNewProjectRequest,
    confirmNewFolder,
  } = useDocumentCreate();

  return (
    <>
      <div className="md:hidden flex items-center gap-2 p-3 border-b border-green-mist bg-warm-white sticky top-0 z-20 safe-top">
        <Tooltip text="Open sidebar — pages, folders, favorites">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg hover:bg-linen shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        </Tooltip>

        <span className="flex-1 font-semibold text-forest text-sm truncate min-w-0">
          {workspace?.name || 'Unified Doc Management'}
        </span>

        <Tooltip text="Search all pages">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-linen shrink-0"
            aria-label="Search"
          >
            <SearchIcon className="w-5 h-5" />
          </button>
        </Tooltip>

        <NewMenuDropdown
          variant="compact"
          onNewPage={() => void handleNewPage()}
          onNewProject={() => handleNewProjectRequest()}
          onNewDatabase={() => void handleNewDatabase()}
        />
      </div>

      {folderModal && (
        <NamePromptModal
          open
          title={folderModal.kind === 'project' ? 'New Project' : 'New Folder'}
          label={folderModal.kind === 'project' ? 'Project name' : 'Folder name'}
          placeholder={folderModal.kind === 'project' ? 'e.g. Sprint Q2' : 'e.g. Meeting Notes'}
          confirmLabel={folderModal.kind === 'project' ? 'Create Project' : 'Create Folder'}
          showIcon
          defaultIcon={folderModal.kind === 'project' ? '🗂️' : '📁'}
          onClose={() => setFolderModal(null)}
          onConfirm={(name, icon) => void confirmNewFolder(name, icon)}
        />
      )}
    </>
  );
}
