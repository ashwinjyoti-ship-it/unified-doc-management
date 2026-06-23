import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, ChevronRight, ChevronDown, FileText, Folder, Database,
  X, LogOut, Bell, Search as SearchIcon, Wifi, WifiOff, Settings,
} from 'lucide-react';
import type { Page } from '../types';

function PageTreeItem({ page, pages, depth = 0 }: { page: Page; pages: Page[]; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const { pageId } = useParams();
  const children = pages.filter((p) => p.parent_id === page.id);

  return (
    <div>
      <button
        onClick={() => navigate(`/page/${page.id}`)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          pageId === page.id ? 'bg-sage/30 text-forest font-medium' : 'hover:bg-linen text-charcoal'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {children.length > 0 ? (
          <span onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="cursor-pointer">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        ) : (
          <span className="w-3" />
        )}
        <span>{page.icon || (page.type === 'folder' ? '📁' : page.type === 'database' ? '🗃️' : '📄')}</span>
        <span className="truncate flex-1 text-left">{page.title}</span>
      </button>
      {expanded && children.map((child) => (
        <PageTreeItem key={child.id} page={child} pages={pages} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function Sidebar() {
  const { pages, workspace, sidebarOpen, setSidebarOpen, createPage, logout, online, notifications, setSearchOpen } = useStore();
  const navigate = useNavigate();
  const rootPages = pages.filter((p) => !p.parent_id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNewPage = async (type: string = 'page') => {
    const page = await createPage({ type, title: type === 'database' ? 'New Database' : 'Untitled' });
    navigate(`/page/${page.id}`);
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
            <button onClick={() => handleNewPage('page')} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" /> Page
            </button>
            <button onClick={() => handleNewPage('database')} className="btn-secondary text-sm p-2" title="New Database">
              <Database className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {rootPages.map((page) => (
            <PageTreeItem key={page.id} page={page} pages={pages} />
          ))}
        </div>

        <div className="p-3 border-t border-green-mist space-y-1">
          <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen">
            <SearchIcon className="w-4 h-4" /> Search
          </button>
          <button onClick={() => navigate('/notifications')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen">
            <Bell className="w-4 h-4" /> Notifications
            {unreadCount > 0 && (
              <span className="ml-auto bg-forest text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </button>
          <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-mid-gray">
            {online ? <Wifi className="w-3 h-3 text-sage" /> : <WifiOff className="w-3 h-3 text-red-400" />}
            {online ? 'Online' : 'Offline — changes will sync'}
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-linen text-red-600">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
