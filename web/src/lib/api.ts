import type { User, Page, Workspace, Notification, Block, Comment, DatabaseProperty, DatabaseRow, SavedDatabaseView, Tag, Theme } from '../types';
import type { DatabaseFilter, DatabaseSort } from './databaseFilters';

const API_BASE = '/api';

class ApiClient {
  private token: string | null = localStorage.getItem('token');

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  syncTokenFromStorage() {
    this.token = localStorage.getItem('token');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const message = err.error || 'Request failed';
      if (res.status === 401) {
        this.setToken(null);
      }
      const error = new Error(message) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    return res.json();
  }

  register(email: string, password: string, name: string) {
    return this.request<{ token: string; user: User; workspaceId: string }>(
      '/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }
    );
  }

  login(email: string, password: string) {
    return this.request<{ token: string; user: User }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    );
  }

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  getMe() {
    return this.request<{ user: User }>('/auth/me');
  }

  getWorkspaces() {
    return this.request<{ workspaces: Workspace[] }>('/workspaces');
  }

  updateWorkspace(workspaceId: string, data: { name: string }) {
    return this.request<{ workspace: Workspace }>(
      `/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  getPages(workspaceId: string) {
    return this.request<{ pages: Page[] }>(`/workspaces/${workspaceId}/pages`);
  }

  createPage(workspaceId: string, data: {
    title?: string;
    parentId?: string;
    type?: string;
    icon?: string;
    embedInPageId?: string;
  }) {
    return this.request<{ page: Page; embeddedInPageId?: string | null }>(
      `/workspaces/${workspaceId}/pages`, { method: 'POST', body: JSON.stringify(data) }
    );
  }

  getPage(pageId: string) {
    return this.request<{ page: Page; blocks: Block[]; backlinks: Array<{ id: string; title: string; icon: string }> }>(
      `/pages/${pageId}`
    );
  }

  updatePage(pageId: string, data: Partial<{ title: string; icon: string; parentId: string | null; visibility: string }>) {
    return this.request<{ page: Page }>(
      `/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  deletePage(pageId: string) {
    return this.request(`/pages/${pageId}`, { method: 'DELETE' });
  }

  saveBlocks(pageId: string, blocks: Array<{ id?: string; type: string; content: object; parentId?: string; orderIndex: number }>) {
    return this.request<{ blocks: Block[] }>(
      `/pages/${pageId}/blocks`, { method: 'PUT', body: JSON.stringify({ blocks }) }
    );
  }

  getMarkdown(pageId: string) {
    return this.request<{ markdown: string; title: string }>(`/pages/${pageId}/markdown`);
  }

  saveMarkdown(pageId: string, markdown: string) {
    return this.request<{ blocks: Block[] }>(
      `/pages/${pageId}/markdown`, { method: 'PUT', body: JSON.stringify({ markdown }) }
    );
  }

  getVersions(pageId: string) {
    return this.request<{ versions: Array<{ id: string; title: string; created_at: number; author_name: string }> }>(
      `/pages/${pageId}/versions`
    );
  }

  restoreVersion(pageId: string, versionId: string) {
    return this.request<{ blocks: Block[] }>(
      `/pages/${pageId}/restore/${versionId}`, { method: 'POST' }
    );
  }

  resolveEmbeddedDatabase(hostPageId: string, candidateId?: string) {
    const qs = candidateId ? `?candidateId=${encodeURIComponent(candidateId)}` : '';
    return this.request<{ databaseId: string; title: string; repaired: boolean }>(
      `/pages/${hostPageId}/embedded-database${qs}`,
    );
  }

  getDatabase(pageId: string) {
    return this.request<{
      properties: DatabaseProperty[];
      rows: DatabaseRow[];
      views: SavedDatabaseView[];
      relationData: Record<string, Array<{ id: string; page_id: string | null; title: string }>>;
      relatedSchemas: Record<string, Array<{ id: string; name: string; type: string }>>;
      rollupValues: Record<string, Record<string, string | number>>;
      databases: Array<{ id: string; title: string; icon: string | null }>;
    }>(`/pages/${pageId}/database`);
  }

  createDatabaseRow(pageId: string, properties?: Record<string, unknown>, title?: string) {
    return this.request<{ row: DatabaseRow }>(
      `/pages/${pageId}/database/rows`, { method: 'POST', body: JSON.stringify({ properties, title }) }
    );
  }

  updateDatabaseRow(pageId: string, rowId: string, data: { properties?: Record<string, unknown>; orderIndex?: number }) {
    return this.request<{ row: DatabaseRow }>(
      `/pages/${pageId}/database/rows/${rowId}`, { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  deleteDatabaseRow(pageId: string, rowId: string) {
    return this.request(`/pages/${pageId}/database/rows/${rowId}`, { method: 'DELETE' });
  }

  createDatabaseProperty(pageId: string, data: {
    name: string;
    type: string;
    options?: string[] | {
      relatedDatabaseId?: string;
      relationPropertyId?: string;
      targetPropertyId?: string;
      aggregation?: string;
    };
  }) {
    return this.request<{ property: DatabaseProperty }>(
      `/pages/${pageId}/database/properties`, { method: 'POST', body: JSON.stringify(data) }
    );
  }

  updateDatabaseProperty(pageId: string, propId: string, data: {
    name?: string;
    type?: string;
    options?: string[] | {
      relatedDatabaseId?: string;
      relationPropertyId?: string;
      targetPropertyId?: string;
      aggregation?: string;
    };
  }) {
    return this.request<{ property: DatabaseProperty }>(
      `/pages/${pageId}/database/properties/${propId}`, { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  deleteDatabaseProperty(pageId: string, propId: string) {
    return this.request(`/pages/${pageId}/database/properties/${propId}`, { method: 'DELETE' });
  }

  createDatabaseView(pageId: string, data: {
    name: string;
    viewType?: string;
    filters?: DatabaseFilter[];
    sortConfig?: DatabaseSort[];
  }) {
    return this.request<{ view: SavedDatabaseView }>(
      `/pages/${pageId}/database/views`, { method: 'POST', body: JSON.stringify(data) }
    );
  }

  updateDatabaseView(pageId: string, viewId: string, data: {
    name?: string;
    viewType?: string;
    filters?: DatabaseFilter[];
    sortConfig?: DatabaseSort[];
  }) {
    return this.request<{ view: SavedDatabaseView }>(
      `/pages/${pageId}/database/views/${viewId}`, { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  deleteDatabaseView(pageId: string, viewId: string) {
    return this.request(`/pages/${pageId}/database/views/${viewId}`, { method: 'DELETE' });
  }

  getComments(pageId: string) {
    return this.request<{ comments: Comment[] }>(`/pages/${pageId}/comments`);
  }

  addComment(
    pageId: string,
    content: string,
    blockId?: string,
    extra?: {
      commentType?: 'discussion' | 'agent_instruction';
      selectionQuote?: string;
      selectionMeta?: object;
      status?: string;
    },
  ) {
    return this.request<{ comment: Comment }>(
      `/pages/${pageId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          blockId,
          commentType: extra?.commentType,
          selectionQuote: extra?.selectionQuote,
          selectionMeta: extra?.selectionMeta,
          status: extra?.status,
        }),
      },
    );
  }

  getAgentComments(pageId: string, status = 'open') {
    return this.request<{ comments: Comment[]; status: string; open_count: number }>(
      `/pages/${pageId}/agent-comments?status=${encodeURIComponent(status)}`,
    );
  }

  updateComment(commentId: string, data: { status?: string; content?: string }) {
    return this.request<{ comment: Comment }>(
      `/comments/${commentId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
  }

  deleteComment(commentId: string) {
    return this.request<{ ok: boolean }>(`/comments/${commentId}`, { method: 'DELETE' });
  }

  search(q: string) {
    return this.request<{ results: Array<{ id: string; title: string; icon: string; type: string; snippet: string }> }>(
      `/search?q=${encodeURIComponent(q)}`
    );
  }

  getNotifications() {
    return this.request<{ notifications: Notification[] }>('/notifications');
  }

  markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  createApiKey(name: string) {
    return this.request<{ id: string; key: string; prefix: string }>(
      '/auth/api-keys', { method: 'POST', body: JSON.stringify({ name }) }
    );
  }

  syncOperations(operations: Array<{ id: string; operation: string; entityType: string; entityId: string; payload: unknown }>) {
    return this.request<{ results: Array<{ id: string; status: string }> }>(
      '/sync', { method: 'POST', body: JSON.stringify({ operations }) }
    );
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}/uploads`, { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json() as Promise<{ url: string; filename: string; contentType: string; size: number }>;
  }

  duplicatePage(pageId: string) {
    return this.request<{ page: Page }>(`/pages/${pageId}/duplicate`, { method: 'POST' });
  }

  bulkPages(action: 'delete' | 'move', pageIds: string[], parentId?: string | null) {
    return this.request<{ results: Array<{ id: string; status: string }> }>(
      '/bulk', { method: 'POST', body: JSON.stringify({ action, pageIds, parentId }) }
    );
  }

  importFromUrl(url: string, signal?: AbortSignal) {
    return this.request<{ title: string; markdown: string }>(
      '/fetch-url', { method: 'POST', body: JSON.stringify({ url }), signal }
    );
  }

  importFromUrlAsPage(url: string, workspaceId: string, parentId?: string) {
    return this.request<{ page: Page }>(
      '/import-url', { method: 'POST', body: JSON.stringify({ url, workspaceId, parentId }) }
    );
  }

  getFavorites() {
    return this.request<{ pages: Page[] }>('/favorites');
  }

  getRecent() {
    return this.request<{ pages: Page[] }>('/recent');
  }

  recordPageView(pageId: string) {
    return this.request(`/pages/${pageId}/view`, { method: 'POST' });
  }

  favoritePage(pageId: string) {
    return this.request(`/pages/${pageId}/favorite`, { method: 'POST' });
  }

  unfavoritePage(pageId: string) {
    return this.request(`/pages/${pageId}/favorite`, { method: 'DELETE' });
  }

  isFavorited(pageId: string) {
    return this.request<{ favorited: boolean }>(`/pages/${pageId}/favorite`);
  }

  getTags(workspaceId: string) {
    return this.request<{ tags: Tag[] }>(`/workspaces/${workspaceId}/tags`);
  }

  createTag(workspaceId: string, name: string, color?: string) {
    return this.request<{ tag: Tag }>(
      `/workspaces/${workspaceId}/tags`, { method: 'POST', body: JSON.stringify({ name, color }) }
    );
  }

  getPageTags(pageId: string) {
    return this.request<{ tags: Tag[] }>(`/pages/${pageId}/tags`);
  }

  addPageTag(pageId: string, data: { tagId?: string; name?: string; color?: string }) {
    return this.request<{ tag: Tag }>(
      `/pages/${pageId}/tags`, { method: 'POST', body: JSON.stringify(data) }
    );
  }

  removePageTag(pageId: string, tagId: string) {
    return this.request(`/pages/${pageId}/tags/${tagId}`, { method: 'DELETE' });
  }

  getPreferences() {
    return this.request<{ preferences: { theme: Theme } }>('/auth/preferences');
  }

  updatePreferences(theme: Theme) {
    return this.request<{ preferences: { theme: Theme } }>(
      '/auth/preferences', { method: 'PATCH', body: JSON.stringify({ theme }) }
    );
  }

  seedKnowledgeBase() {
    return this.request<{
      alreadySeeded: boolean;
      migrated?: boolean;
      workspaceName: string;
      dailyNoteTitle: string;
      pageIds: { projectId: string; learningFolderId: string; weeklyReviewId: string; dailyNoteId: string };
      message: string;
    }>('/seed/knowledge-base', { method: 'POST' });
  }

  migrateKnowledgeBase() {
    return this.request<{
      migrated: boolean;
      projectId?: string;
      movedCount: number;
      message: string;
    }>('/seed/migrate-knowledge-base', { method: 'POST' });
  }
}

export const api = new ApiClient();
