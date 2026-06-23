import { create } from 'zustand';
import { api } from './api';
import type { User, Page, Workspace, Notification } from '../types';

interface AppState {
  user: User | null;
  workspace: Workspace | null;
  pages: Page[];
  notifications: Notification[];
  sidebarOpen: boolean;
  searchOpen: boolean;
  markdownMode: boolean;
  online: boolean;
  loading: boolean;

  setSidebarOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setMarkdownMode: (mode: boolean) => void;
  setOnline: (online: boolean) => void;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
  loadWorkspace: () => Promise<void>;
  loadPages: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  createPage: (data?: { title?: string; parentId?: string; type?: string; icon?: string }) => Promise<Page>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  workspace: null,
  pages: [],
  notifications: [],
  sidebarOpen: true,
  searchOpen: false,
  markdownMode: false,
  online: navigator.onLine,
  loading: true,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setMarkdownMode: (mode) => set({ markdownMode: mode }),
  setOnline: (online) => set({ online }),

  login: async (email, password) => {
    const { token, user } = await api.login(email, password);
    api.setToken(token);
    set({ user });
    await get().loadWorkspace();
  },

  register: async (email, password, name) => {
    const { token, user, workspaceId } = await api.register(email, password, name);
    api.setToken(token);
    set({ user, workspace: { id: workspaceId, name: `${name}'s Workspace`, owner_id: user.id, role: 'owner' } });
    await get().loadPages();
  },

  logout: async () => {
    await api.logout().catch(() => {});
    api.setToken(null);
    set({ user: null, workspace: null, pages: [] });
  },

  init: async () => {
    if (!api.getToken()) {
      set({ loading: false });
      return;
    }
    try {
      const { user } = await api.getMe();
      set({ user });
      await get().loadWorkspace();
    } catch {
      api.setToken(null);
    }
    set({ loading: false });
  },

  loadWorkspace: async () => {
    const { workspaces } = await api.getWorkspaces();
    if (workspaces.length > 0) {
      set({ workspace: workspaces[0] });
      await get().loadPages();
    }
  },

  loadPages: async () => {
    const workspace = get().workspace;
    if (!workspace) return;
    const { pages } = await api.getPages(workspace.id);
    set({ pages });
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
}
