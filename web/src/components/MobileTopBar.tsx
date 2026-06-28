import { Menu, Search as SearchIcon, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useShallow } from 'zustand/react/shallow';
import { pageIcon } from '../lib/pageTree';
import NewMenuDropdown from './NewMenuDropdown';
import NamePromptModal from './NamePromptModal';
import { useDocumentCreate } from '../hooks/useDocumentCreate';
import { getActivePageIdFromPath } from '../lib/pageRoute';
import Tooltip from './Tooltip';
import AppAvatar from './AppAvatar';

export default function MobileTopBar() {
  const location = useLocation();
  const activePageId = getActivePageIdFromPath(location.pathname);
  const navigate = useNavigate();
  const { workspace, pages, notifications, setSidebarOpen, setSearchOpen } = useStore(
    useShallow((s) => ({
      workspace: s.workspace,
      pages: s.pages,
      notifications: s.notifications,
      setSidebarOpen: s.setSidebarOpen,
      setSearchOpen: s.setSearchOpen,
    })),
  );
  const {
    folderModal,
    setFolderModal,
    handleNewPage,
    handleNewDatabase,
    handleNewProjectRequest,
    confirmNewFolder,
  } = useDocumentCreate();

  const currentPage = activePageId ? pages.find((p) => p.id === activePageId) : null;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const isHome = location.pathname === '/';
  const showBrand = isHome;
  const barTitle = currentPage
    ? `${pageIcon(currentPage)} ${currentPage.title}`
    : workspace?.name || 'Tandem';

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

        {showBrand ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-lg hover:bg-linen/80 px-1 py-1 -mx-1"
          >
            <AppAvatar size="xs" className="shrink-0 rounded-lg" />
            <span className="font-semibold text-forest text-sm truncate">Tandem</span>
          </button>
        ) : (
          <>
            <Tooltip text="Go to home">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="p-1 rounded-lg hover:bg-linen shrink-0"
                aria-label="Go to home"
              >
                <AppAvatar size="xs" className="rounded-md" />
              </button>
            </Tooltip>
            <span className="flex-1 font-semibold text-forest text-sm truncate min-w-0">
              {barTitle}
            </span>
          </>
        )}

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
