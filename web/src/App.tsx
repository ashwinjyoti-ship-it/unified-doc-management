import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './lib/store';
import { createProject } from './lib/projectCreate';
import { consumeOpenBlankPageAfterAuth } from './lib/authSession';
import { isStandalonePage } from './lib/standalonePages';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import PageView from './components/PageView';
import SearchModal from './components/SearchModal';
import QuickCapture from './components/QuickCapture';
import SettingsPage from './components/SettingsPage';
import NotificationsPage from './components/NotificationsPage';
import MobileTopBar from './components/MobileTopBar';

const LAST_PATH_KEY = 'unifieddocs:lastPath';

function HomePage() {
  const navigate = useNavigate();
  const { workspace, createPage, recent, loadPages } = useStore();
  const [opening, setOpening] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!workspace || handled.current || opening) return;

    if (consumeOpenBlankPageAfterAuth()) {
      handled.current = true;
      setOpening(true);
      void createPage({ type: 'page', title: 'Untitled', icon: '📄' })
        .then((page) => navigate(`/page/${page.id}`, { replace: true }))
        .finally(() => setOpening(false));
      return;
    }

    if (recent.length > 0) {
      handled.current = true;
      navigate(`/page/${recent[0].id}`, { replace: true });
    }
  }, [workspace, createPage, navigate, opening, recent]);

  if (opening) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-forest font-medium animate-pulse">Opening blank page...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 pb-24 md:pb-8 text-center">
      <div className="text-6xl mb-4">📄</div>
      <h1 className="text-2xl font-bold text-charcoal mb-2">
        Welcome to <span className="text-forest">Unified Doc Management</span>
      </h1>
      <p className="text-warm-gray mb-6 max-w-md">
        New pages and databases open in Inbox. Create a project folder when you want to organize them later.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={async () => {
            if (!workspace) return;
            const page = await createPage({ type: 'page', title: 'Untitled', icon: '📄' });
            await loadPages();
            navigate(`/page/${page.id}`, { replace: true });
          }}
          className="btn-primary"
        >
          New Page
        </button>
        <button
          onClick={async () => {
            if (!workspace) return;
            const project = await createProject(workspace.id, {
              projectTitle: 'My First Project',
              projectIcon: '🗂️',
            });
            await loadPages();
            navigate(`/page/${project.id}`, { replace: true });
          }}
          className="btn-secondary"
        >
          New Project
        </button>
      </div>
    </div>
  );
}

function AppLayout() {
  const location = useLocation();
  const showMobileTopBar = !isStandalonePage(location.pathname);

  useEffect(() => {
    const path = location.pathname + location.search + location.hash;
    if (path !== '/' && path !== '/login') {
      sessionStorage.setItem(LAST_PATH_KEY, path);
    }
  }, [location.pathname, location.search, location.hash]);

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
