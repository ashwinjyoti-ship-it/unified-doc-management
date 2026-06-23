export interface Env {
  DB: D1Database;
  COLLAB_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface Page {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  type: 'page' | 'folder' | 'database';
  visibility: 'private' | 'shared' | 'public';
  content_md: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface Block {
  id: string;
  page_id: string;
  parent_id: string | null;
  type: string;
  content: string;
  order_index: number;
  created_at: number;
  updated_at: number;
}

export interface DatabaseProperty {
  id: string;
  database_id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'relation';
  options: string;
  order_index: number;
}

export interface DatabaseRow {
  id: string;
  database_id: string;
  page_id: string | null;
  properties: string;
  order_index: number;
  created_at: number;
  updated_at: number;
}

export interface Comment {
  id: string;
  page_id: string;
  block_id: string | null;
  user_id: string;
  content: string;
  mentions: string;
  created_at: number;
  updated_at: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read: number;
  page_id: string | null;
  created_at: number;
}

export type AuthContext = {
  user: User;
  sessionId: string;
};
