import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';
import { createProject } from './lib/projectCreate';
import { isStandalonePage } from './lib/standalonePages';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import PageView from './components/PageView';
import SearchModal from './components/SearchModal';
import QuickCapture from './components/QuickCapture';
import SettingsPage from './components/SettingsPage';
import NotificationsPage from './components/NotificationsPage';
import MobileTopBar from './components/MobileTopBar';

function HomePage() {
  const { pages, workspace, loadPages } = useStore();

  useEffect(() => {
    if (pages.length > 0) {
      window.location.href = `/page/${pages[0].id}`;
    }
  }, [pages]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-4">📄</div>
      <h1 className="text-2xl font-bold text-charcoal mb-2">
        Welcome to <span className="text-forest">Unified Doc Management</span>
      </h1>
      <p className="text-warm-gray mb-6 max-w-md">
        Create a project to organize pages, databases, and folders. Daily notes and quick captures stay in Inbox.
      </p>
      <button
        onClick={async () => {
          if (!workspace) return;
          const project = await createProject(workspace.id, {
            projectTitle: 'My First Project',
            projectIcon: '🗂️',
            child: { type: 'page', title: 'My First Page', icon: '✨' },
          });
          await loadPages();
          window.location.href = `/page/${project.id}`;
        }}
        className="btn-primary"
      >
        Create Your First Project
      </button>
    </div>
  );
}

function AppLayout() {
  const location = useLocation();
  const showMobileTopBar = !isStandalonePage(location.pathname);

  return (
    <div className="h-full flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {showMobileTopBar && <MobileTopBar />}
        <div id="app-scroll" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/page/:pageId" element={<PageView />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Routes>
        </div>
      </div>
      <SearchModal />
      <QuickCapture />
    </div>
  );
}

export default function App() {
  const { user, loading, init, loadNotifications, setSidebarOpen } = useStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, loadNotifications]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setSidebarOpen]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-forest font-medium animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
