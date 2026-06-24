import { useState, useRef } from 'react';
import { useStore } from '../lib/store';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Tooltip from './Tooltip';
import { pageItemClass } from '../lib/pageSelection';
import ImportOptionsModal, { type ImportMode } from './ImportOptionsModal';
import OperationBanner from './OperationBanner';
import NamePromptModal from './NamePromptModal';
import MoveToModal from './MoveToModal';
import PageTree from './PageTree';
import NewMenuDropdown from './NewMenuDropdown';
import { applyImportContent } from '../lib/importContent';
import { collectDescendantIds } from '../lib/pageTree';
import { closeSidebarOnMobile } from '../lib/device';
import { useDocumentCreate } from '../hooks/useDocumentCreate';
import type { Page } from '../types';
import {
  FileText,
  X, LogOut, Bell, Search as SearchIcon, Wifi, WifiOff, Settings,
  Star, Clock, CheckSquare, Trash2, FolderInput, Link2, CalendarDays,
} from 'lucide-react';

function todayNoteTitle() {
  return new Date().toLocaleDateString('en-CA');
}

function PageListSection({
  title, icon, pages, tooltip, onNavigate,
}: {
  title: string;
  icon: React.ReactNode;
  pages: Page[];
  tooltip: string;
  onNavigate: (pageId: string) => void;
}) {
  const { pageId } = useParams();
  if (pages.length === 0) return null;

  return (
    <div className="mb-3">
      <Tooltip text={tooltip} position="right">
        <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-mid-gray uppercase tracking-wide">
          {icon} {title}
        </div>
      </Tooltip>
      <div className="space-y-0.5">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => onNavigate(p.id)}
            className={pageItemClass(pageId === p.id, 'py-1.5')}
          >
            <span>{p.icon || '📄'}</span>
            <span className="truncate flex-1 text-left">{p.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const {
    pages, favorites, recent, workspace, sidebarOpen, setSidebarOpen,
    createPage, logout, online, notifications, setSearchOpen,
    loadPages, loadFavorites, loadRecent,
  } = useStore();
  const navigate = useNavigate();
  const { pageId } = useParams();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const {
    folderModal,
    setFolderModal,
    handleNewPage,
    handleNewDatabase,
    handleNewFolderRequest,
    confirmNewFolder,
  } = useDocumentCreate();

  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [operationLabel, setOperationLabel] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<string[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [importModal, setImportModal] = useState<{
    sourceLabel: string;
    sourceType: 'file' | 'url';
    content: string;
    suggestedTitle?: string;
  } | null>(null);

  const navigateToPage = (id: string) => {
    navigate(`/page/${id}`);
    closeSidebarOnMobile(setSidebarOpen);
  };

  const handleDailyNote = async () => {
    const title = todayNoteTitle();
    const existing = pages.find((p) => p.title === title && p.type === 'page');
    if (existing) {
      navigateToPage(existing.id);
      return;
    }
    const page = await createPage({ title, type: 'page', icon: '📅' });
    await loadPages();
    navigateToPage(page.id);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} page(s)? This cannot be undone.`)) return;
    await api.bulkPages('delete', [...selected]);
    setSelected(new Set());
    setBulkMode(false);
    await loadPages();
    await loadFavorites();
    await loadRecent();
    closeSidebarOnMobile(setSidebarOpen);
    navigate('/');
  };

  const handleBulkMoveConfirm = async (parentId: string | null) => {
    if (!moveModal?.length) return;
    await api.bulkPages('move', moveModal, parentId);
    setMoveModal(null);
    setSelected(new Set());
    setBulkMode(false);
    await loadPages();
  };

  const getMoveExcludeIds = (ids: string[]): string[] => {
    const exclude = new Set<string>();
    for (const id of ids) {
      for (const descId of collectDescendantIds(pages, id)) {
        exclude.add(descId);
      }
    }
    return [...exclude];
  };

  const cancelOperation = () => {
    abortRef.current?.abort();
    setOperationLabel(null);
    setImportModal(null);
  };

  const runImport = async (mode: ImportMode) => {
    if (!importModal || !workspace) return;
    const modal = importModal;
    setImportModal(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setOperationLabel('Importing...');
    try {
      const targetId = await applyImportContent({
        content: modal.content,
        mode,
        pageId: pageId,
        workspaceId: workspace.id,
        suggestedTitle: modal.suggestedTitle,
        signal: controller.signal,
      });
      await loadPages();
      await loadRecent();
      if (mode === 'new' || targetId !== pageId) {
        navigateToPage(targetId);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setOperationLabel(null);
      abortRef.current = null;
    }
  };

  const handleImportUrl = async () => {
    const url = window.prompt('Enter URL to import:');
    if (!url || !workspace) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setOperationLabel('Fetching URL...');
    try {
      const { title, markdown } = await api.importFromUrl(url, controller.signal);
      setImportModal({
        sourceLabel: url,
        sourceType: 'url',
        content: markdown,
        suggestedTitle: title,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setOperationLabel(null);
      abortRef.current = null;
    }
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`
          sidebar fixed inset-y-0 left-0 md:relative z-50 w-72 max-w-[85vw] h-dvh md:h-full
          bg-warm-white border-r border-green-mist flex flex-col
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0 md:w-72' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'}
        `}
      >
        <div className="p-4 border-b border-green-mist shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-forest truncate">{workspace?.name || 'Workspace'}</h2>
            <button type="button" onClick={() => setSidebarOpen(false)} className="md:hidden p-2 -mr-1 rounded-lg hover:bg-linen">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2">
            <NewMenuDropdown
              className="flex-1"
              onNewPage={() => void handleNewPage()}
              onNewFolder={() => handleNewFolderRequest()}
              onNewDatabase={() => void handleNewDatabase()}
            />
            <Tooltip text="Import a web page from a URL">
              <button type="button" onClick={handleImportUrl} disabled={!!operationLabel} className="btn-secondary text-sm p-2 shrink-0">
                <Link2 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
          <div className="flex gap-2 mt-2">
            <Tooltip text="Open or create today's daily note page">
              <button
                type="button"
                onClick={() => void handleDailyNote()}
                className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1"
              >
                <CalendarDays className="w-3.5 h-3.5" /> Today
              </button>
            </Tooltip>
          </div>
          <div className="flex gap-2 mt-2">
            <Tooltip text={bulkMode ? 'Exit bulk selection mode' : 'Select multiple pages to move or delete'}>
              <button
                type="button"
                onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
                className={`btn-secondary text-xs flex-1 flex items-center justify-center gap-1 ${bulkMode ? 'bg-sage/30' : ''}`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {bulkMode ? 'Cancel' : 'Select'}
              </button>
            </Tooltip>
            {bulkMode && selected.size > 0 && (
              <>
                <Tooltip text={`Delete ${selected.size} selected page(s)`}>
                  <button type="button" onClick={handleBulkDelete} className="btn-secondary text-xs p-2 text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                <Tooltip text={`Move ${selected.size} selected page(s) to a folder`}>
                  <button type="button" onClick={() => setMoveModal([...selected])} className="btn-secondary text-xs p-2">
                    <FolderInput className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-2 min-h-0">
          <PageListSection
            title="Favorites"
            icon={<Star className="w-3 h-3" />}
            pages={favorites}
            tooltip="Pages you've pinned for quick access"
            onNavigate={navigateToPage}
          />
          <PageListSection
            title="Recent"
            icon={<Clock className="w-3 h-3" />}
            pages={recent.filter((r) => !favorites.some((f) => f.id === r.id))}
            tooltip="Pages you've opened recently"
            onNavigate={navigateToPage}
          />

          <Tooltip text="Tap and hold the grip to drag pages into folders">
            <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-mid-gray uppercase tracking-wide mb-1">
              <FileText className="w-3 h-3" /> All Pages
            </div>
          </Tooltip>
          <PageTree
            pages={pages}
            bulkMode={bulkMode}
            selected={selected}
            onToggleSelect={toggleSelect}
            onPagesChange={loadPages}
            onNavigate={navigateToPage}
          />
        </div>

        <div className="p-3 border-t border-green-mist space-y-1 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Tooltip text="Search across all pages (Ctrl+K)">
            <button
              type="button"
              onClick={() => { setSearchOpen(true); closeSidebarOnMobile(setSidebarOpen); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-linen"
            >
              <SearchIcon className="w-4 h-4" /> Search
            </button>
          </Tooltip>
          <Tooltip text="View mentions, comments, and activity updates">
            <button
              type="button"
              onClick={() => { navigate('/notifications'); closeSidebarOnMobile(setSidebarOpen); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-linen"
            >
              <Bell className="w-4 h-4" /> Notifications
              {unreadCount > 0 && (
                <span className="ml-auto bg-forest text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          </Tooltip>
          <Tooltip text="Account settings, theme, and API keys">
            <button
              type="button"
              onClick={() => { navigate('/settings'); closeSidebarOnMobile(setSidebarOpen); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-linen"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          </Tooltip>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-mid-gray">
            {online ? <Wifi className="w-3 h-3 text-sage" /> : <WifiOff className="w-3 h-3 text-red-400" />}
            {online ? 'Online' : 'Offline — changes will sync'}
          </div>
          <Tooltip text="Sign out of your account">
            <button type="button" onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-linen text-red-600">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </Tooltip>
        </div>
      </aside>

      {importModal && (
        <ImportOptionsModal
          open
          sourceLabel={importModal.sourceLabel}
          sourceType={importModal.sourceType}
          onClose={() => setImportModal(null)}
          onConfirm={runImport}
        />
      )}
      {folderModal && (
        <NamePromptModal
          open
          title="New Folder"
          label="Folder name"
          placeholder="e.g. Project Documentation"
          confirmLabel="Create Folder"
          showIcon
          defaultIcon="📁"
          onClose={() => setFolderModal(null)}
          onConfirm={(name, icon) => void confirmNewFolder(name, icon)}
        />
      )}
      {moveModal && (
        <MoveToModal
          open
          pages={pages}
          excludeIds={getMoveExcludeIds(moveModal)}
          title={`Move ${moveModal.length} item(s)`}
          onClose={() => setMoveModal(null)}
          onConfirm={handleBulkMoveConfirm}
        />
      )}
      {operationLabel && (
        <OperationBanner label={operationLabel} onCancel={cancelOperation} />
      )}
    </>
  );
}
