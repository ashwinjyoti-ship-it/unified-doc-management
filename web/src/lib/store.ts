import { create } from 'zustand';
import { api } from './api';
import { markOpenBlankPageAfterAuth } from './authSession';
import type { User, Page, Workspace, Notification, Tag, Theme } from '../types';

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyThemeToDom(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

interface AppState {
  user: User | null;
  workspace: Workspace | null;
  pages: Page[];
  favorites: Page[];
  recent: Page[];
  tags: Tag[];
  notifications: Notification[];
  sidebarOpen: boolean;
  searchOpen: boolean;
  markdownMode: boolean;
  online: boolean;
  loading: boolean;
  theme: Theme;

  setSidebarOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setMarkdownMode: (mode: boolean) => void;
  setOnline: (online: boolean) => void;
  setTheme: (theme: Theme) => Promise<void>;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
  loadWorkspace: () => Promise<void>;
  renameWorkspace: (name: string) => Promise<void>;
  loadPages: () => Promise<void>;
  addPageToStore: (page: Page) => void;
  patchPageInStore: (pageId: string, patch: Partial<Page>) => void;
  removePageFromStore: (pageId: string) => void;
  removePagesFromStore: (pageIds: string[]) => void;
  loadFavorites: () => Promise<void>;
  loadRecent: () => Promise<void>;
  loadTags: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  createPage: (data?: {
    title?: string;
    parentId?: string;
    type?: string;
    icon?: string;
    embedInPageId?: string;
  }) => Promise<Page>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  workspace: null,
  pages: [],
  favorites: [],
  recent: [],
  tags: [],
  notifications: [],
  sidebarOpen: typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  searchOpen: false,
  markdownMode: false,
  online: navigator.onLine,
  loading: true,
  theme: (localStorage.getItem('theme') as Theme) || 'light',

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setMarkdownMode: (mode) => set({ markdownMode: mode }),
  setOnline: (online) => set({ online }),

  setTheme: async (theme) => {
    localStorage.setItem('theme', theme);
    applyThemeToDom(theme);
    set({ theme });
    if (api.getToken()) {
      try {
        await api.updatePreferences(theme);
      } catch { /* offline or not migrated */ }
    }
  },

  login: async (email, password) => {
    const { token, user } = await api.login(email, password);
    api.setToken(token);
    set({ user });
    await get().loadWorkspace();
    markOpenBlankPageAfterAuth();
    try {
      const { preferences } = await api.getPreferences();
      await get().setTheme(preferences.theme);
    } catch {
      applyThemeToDom(get().theme);
    }
  },

  register: async (email, password, name) => {
    const { token, user, workspaceId } = await api.register(email, password, name);
    api.setToken(token);
    set({ user, workspace: { id: workspaceId, name: `${name}'s Workspace`, owner_id: user.id, role: 'owner' } });
    await get().loadPages();
    markOpenBlankPageAfterAuth();
    applyThemeToDom(get().theme);
  },

  logout: async () => {
    await api.logout().catch(() => {});
    api.setToken(null);
    set({ user: null, workspace: null, pages: [], favorites: [], recent: [], tags: [] });
  },

  init: async () => {
    applyThemeToDom(get().theme);
    api.syncTokenFromStorage();
    if (!api.getToken()) {
      set({ loading: false });
      return;
    }
    try {
      const { user } = await api.getMe();
      set({ user });
      try {
        const { preferences } = await api.getPreferences();
        await get().setTheme(preferences.theme);
      } catch { /* use local */ }
      await get().loadWorkspace();
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) {
        api.setToken(null);
        set({ user: null, workspace: null, pages: [] });
      }
      /* Keep token on network errors so mobile sessions survive flaky connectivity */
    }
    set({ loading: false });
  },

  loadWorkspace: async () => {
    const { workspaces } = await api.getWorkspaces();
    if (workspaces.length > 0) {
      set({ workspace: workspaces[0] });
      try {
        await api.migrateKnowledgeBase();
      } catch { /* offline or already organized */ }
      await Promise.all([
        get().loadPages(),
        get().loadFavorites(),
        get().loadRecent(),
        get().loadTags(),
      ]);
      const { workspaces: refreshed } = await api.getWorkspaces();
      if (refreshed.length > 0) {
        set({ workspace: refreshed[0] });
      }
    }
  },

  renameWorkspace: async (name: string) => {
    const workspace = get().workspace;
    if (!workspace) return;
    const { workspace: updated } = await api.updateWorkspace(workspace.id, { name });
    set({ workspace: { ...workspace, name: updated.name } });
  },

  loadPages: async () => {
    const workspace = get().workspace;
    if (!workspace) return;
    const { pages } = await api.getPages(workspace.id);
    set({ pages });
  },

  patchPageInStore: (pageId, patch) => {
    set({
      pages: get().pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
    });
  },

  addPageToStore: (page) => {
    set({ pages: [...get().pages, page] });
  },

  removePageFromStore: (pageId) => {
    get().removePagesFromStore([pageId]);
  },

  removePagesFromStore: (pageIds) => {
    const idSet = new Set(pageIds);
    set({
      pages: get().pages.filter((p) => !idSet.has(p.id)),
      favorites: get().favorites.filter((p) => !idSet.has(p.id)),
      recent: get().recent.filter((p) => !idSet.has(p.id)),
    });
  },

  loadFavorites: async () => {
    try {
      const { pages } = await api.getFavorites();
      set({ favorites: pages });
    } catch { /* offline */ }
  },

  loadRecent: async () => {
    try {
      const { pages } = await api.getRecent();
      set({ recent: pages });
    } catch { /* offline */ }
  },

  loadTags: async () => {
    const workspace = get().workspace;
    if (!workspace) return;
    try {
      const { tags } = await api.getTags(workspace.id);
      set({ tags });
    } catch { /* offline */ }
  },

  loadNotifications: async () => {
    const { notifications } = await api.getNotifications();
    set({ notifications });
  },

  createPage: async (data) => {
    const workspace = get().workspace;
    if (!workspace) throw new Error('No workspace');
    const { page } = await api.createPage(workspace.id, data || {});
    set({ pages: [...get().pages, page] });
    return page;
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useStore.getState().setOnline(true));
  window.addEventListener('offline', () => useStore.getState().setOnline(false));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useStore.getState();
    if (theme === 'system') applyThemeToDom('system');
  });
}
