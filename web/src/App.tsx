import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './lib/store';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import PageView from './components/PageView';
import SearchModal from './components/SearchModal';
import QuickCapture from './components/QuickCapture';
import SettingsPage from './components/SettingsPage';
import NotificationsPage from './components/NotificationsPage';
import MobileTopBar from './components/MobileTopBar';

function HomePage() {
  const { pages, createPage } = useStore();

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
        Create pages, databases, and collaborate in real-time. Select a page from the sidebar or create a new one.
      </p>
      <button
        onClick={async () => {
          const page = await createPage({ title: 'My First Page', icon: '✨' });
          window.location.href = `/page/${page.id}`;
        }}
        className="btn-primary"
      >
        Create Your First Page
      </button>
    </div>
  );
}

function AppLayout() {
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <MobileTopBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/page/:pageId" element={<PageView />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>
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
