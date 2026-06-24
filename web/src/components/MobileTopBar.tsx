import { Menu, Search as SearchIcon, Bell } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { pageIcon } from '../lib/pageTree';
import NewMenuDropdown from './NewMenuDropdown';
import NamePromptModal from './NamePromptModal';
import { useDocumentCreate } from '../hooks/useDocumentCreate';
import Tooltip from './Tooltip';

export default function MobileTopBar() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { workspace, pages, notifications, setSidebarOpen, setSearchOpen } = useStore();
  const {
    folderModal,
    setFolderModal,
    handleNewPage,
    handleNewDatabase,
    handleNewProjectRequest,
    confirmNewFolder,
  } = useDocumentCreate();

  const currentPage = pageId ? pages.find((p) => p.id === pageId) : null;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const barTitle = currentPage
    ? `${pageIcon(currentPage)} ${currentPage.title}`
    : workspace?.name || 'Unified Doc Management';

  return (
    <>
      <div className="md:hidden flex items-center gap-1.5 px-3 py-3 border-b border-green-mist bg-warm-white sticky top-0 z-20 safe-top">
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
          {barTitle}
        </span>

        <Tooltip text="Notifications">
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="p-2 rounded-lg hover:bg-linen shrink-0 relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-forest rounded-full" aria-hidden />
            )}
          </button>
        </Tooltip>

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
