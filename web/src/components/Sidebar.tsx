import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Tooltip from './Tooltip';
import type { Page } from '../types';
import {
  Plus, ChevronRight, ChevronDown, FileText, Database,
  X, LogOut, Bell, Search as SearchIcon, Wifi, WifiOff, Settings,
  Star, Clock, CheckSquare, Square, Trash2, FolderInput, Link2,
} from 'lucide-react';

function PageTreeItem({
  page, pages, depth = 0, bulkMode, selected, onToggleSelect,
}: {
  page: Page;
  pages: Page[];
  depth?: number;
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const { pageId } = useParams();
  const children = pages.filter((p) => p.parent_id === page.id);
  const isSelected = selected?.has(page.id);

  return (
    <div>
      <div
        className={`w-full flex items-center gap-1 rounded-lg text-sm transition-colors ${
          pageId === page.id ? 'bg-sage/30 text-forest font-medium' : 'hover:bg-linen text-charcoal'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {bulkMode && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(page.id); }}
            className="p-1 shrink-0"
          >
            {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-forest" /> : <Square className="w-3.5 h-3.5 text-mid-gray" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/page/${page.id}`)}
          className="flex-1 flex items-center gap-2 px-1 py-1.5 min-w-0"
        >
          {children.length > 0 ? (
            <span
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="cursor-pointer shrink-0"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className="shrink-0">{page.icon || (page.type === 'folder' ? '📁' : page.type === 'database' ? '🗃️' : '📄')}</span>
          <span className="truncate flex-1 text-left">{page.title}</span>
        </button>
      </div>
      {expanded && children.map((child) => (
        <PageTreeItem
          key={child.id}
          page={child}
          pages={pages}
          depth={depth + 1}
          bulkMode={bulkMode}
          selected={selected}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

function PageListSection({ title, icon, pages, tooltip }: { title: string; icon: React.ReactNode; pages: Page[]; tooltip: string }) {
  const navigate = useNavigate();
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
            onClick={() => navigate(`/page/${p.id}`)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              pageId === p.id ? 'bg-sage/30 text-forest font-medium' : 'hover:bg-linen text-charcoal'
            }`}
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
  const rootPages = pages.filter((p) => !p.parent_id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importingUrl, setImportingUrl] = useState(false);

  const handleNewPage = async (type: string = 'page') => {
    const page = await createPage({ type, title: type === 'database' ? 'New Database' : 'Untitled' });
    navigate(`/page/${page.id}`);
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
    navigate('/');
  };

  const handleBulkMove = async () => {
    if (selected.size === 0) return;
    const parentId = window.prompt('Move to parent page ID (leave empty for root):');
    await api.bulkPages('move', [...selected], parentId || null);
    setSelected(new Set());
    setBulkMode(false);
    await loadPages();
  };

  const handleImportUrl = async () => {
    const url = window.prompt('Enter URL to import as a new page:');
    if (!url || !workspace) return;
    setImportingUrl(true);
    try {
      const { page } = await api.importFromUrlAsPage(url, workspace.id);
      await loadPages();
      await loadRecent();
      navigate(`/page/${page.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingUrl(false);
    }
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`sidebar fixed md:relative z-30 w-72 h-full bg-warm-white border-r border-green-mist flex flex-col transition-transform duration-200 ${sidebarOpen ? 'open translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'}`}>
        <div className="p-4 border-b border-green-mist">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-forest truncate">{workspace?.name || 'Workspace'}</h2>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2">
            <Tooltip text="Create a new blank page">
              <button onClick={() => handleNewPage('page')} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Page
              </button>
            </Tooltip>
            <Tooltip text="Create a new database (table/board view)">
              <button onClick={() => handleNewPage('database')} className="btn-secondary text-sm p-2">
                <Database className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip text="Import a web page from a URL as a new note">
              <button onClick={handleImportUrl} disabled={importingUrl} className="btn-secondary text-sm p-2">
                <Link2 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
          <div className="flex gap-2 mt-2">
            <Tooltip text={bulkMode ? 'Exit bulk selection mode' : 'Select multiple pages to move or delete'}>
              <button
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
                  <button onClick={handleBulkDelete} className="btn-secondary text-xs p-2 text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                <Tooltip text={`Move ${selected.size} selected page(s) to another folder`}>
                  <button onClick={handleBulkMove} className="btn-secondary text-xs p-2">
                    <FolderInput className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <PageListSection
            title="Favorites"
            icon={<Star className="w-3 h-3" />}
            pages={favorites}
            tooltip="Pages you've pinned for quick access"
          />
          <PageListSection
            title="Recent"
            icon={<Clock className="w-3 h-3" />}
            pages={recent.filter((r) => !favorites.some((f) => f.id === r.id))}
            tooltip="Pages you've opened recently"
          />

          <Tooltip text="All pages in your workspace, organized in a tree">
            <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-mid-gray uppercase tracking-wide mb-1">
              <FileText className="w-3 h-3" /> All Pages
            </div>
          </Tooltip>
          {rootPages.map((page) => (
            <PageTreeItem
              key={page.id}
              page={page}
              pages={pages}
              bulkMode={bulkMode}
              selected={selected}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>

        <div className="p-3 border-t border-green-mist space-y-1">
          <Tooltip text="Search across all pages (Ctrl+K)">
            <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen">
              <SearchIcon className="w-4 h-4" /> Search
            </button>
          </Tooltip>
          <Tooltip text="View mentions, comments, and activity updates">
            <button onClick={() => navigate('/notifications')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen">
              <Bell className="w-4 h-4" /> Notifications
              {unreadCount > 0 && (
                <span className="ml-auto bg-forest text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          </Tooltip>
          <Tooltip text="Account settings, theme, and API keys">
            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen">
              <Settings className="w-4 h-4" /> Settings
            </button>
          </Tooltip>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-mid-gray">
            {online ? <Wifi className="w-3 h-3 text-sage" /> : <WifiOff className="w-3 h-3 text-red-400" />}
            {online ? 'Online' : 'Offline — changes will sync'}
          </div>
          <Tooltip text="Sign out of your account">
            <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen text-red-600">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </Tooltip>
        </div>
      </aside>
    </>
  );
}
