import type { CanvasComponent, CanvasToken } from './canvas-types';

const API_BASE = '/api';

function getToken(): string {
  return localStorage.getItem('token') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function getCanvas(pageId: string): Promise<{ components: CanvasComponent[]; tokens: CanvasToken[] }> {
  return request(`/pages/${pageId}/canvas`);
}

export async function resetCanvas(pageId: string): Promise<{ ok: boolean; deleted: number }> {
  return request(`/pages/${pageId}/canvas/reset?confirm=true`, { method: 'POST' });
}

export async function createComponent(
  pageId: string,
  component: Partial<CanvasComponent>,
): Promise<{ component: CanvasComponent }> {
  return request(`/pages/${pageId}/canvas/components`, {
    method: 'POST',
    body: JSON.stringify({ component }),
  });
}

export async function updateComponent(
  pageId: string,
  cid: string,
  patch: Partial<CanvasComponent>,
): Promise<{ component: CanvasComponent }> {
  return request(`/pages/${pageId}/canvas/components/${cid}`, {
    method: 'PATCH',
    body: JSON.stringify({ patch }),
  });
}

export async function deleteComponent(pageId: string, cid: string): Promise<{ ok: boolean }> {
  return request(`/pages/${pageId}/canvas/components/${cid}`, { method: 'DELETE' });
}

export async function duplicateComponent(pageId: string, cid: string): Promise<{ component: CanvasComponent }> {
  return request(`/pages/${pageId}/canvas/components/${cid}/duplicate`, { method: 'POST' });
}

export async function getTokens(pageId: string): Promise<{ tokens: CanvasToken[] }> {
  return request(`/pages/${pageId}/canvas/tokens`);
}

export async function createToken(pageId: string, token: Partial<CanvasToken>): Promise<{ token: CanvasToken }> {
  return request(`/pages/${pageId}/canvas/tokens`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function updateToken(
  pageId: string,
  tid: string,
  patch: Partial<CanvasToken>,
): Promise<{ token: CanvasToken }> {
  return request(`/pages/${pageId}/canvas/tokens/${tid}`, {
    method: 'PATCH',
    body: JSON.stringify({ patch }),
  });
}

export async function deleteToken(pageId: string, tid: string): Promise<{ ok: boolean }> {
  return request(`/pages/${pageId}/canvas/tokens/${tid}`, { method: 'DELETE' });
}

export async function createCanvasComment(
  pageId: string,
  payload: {
    content: string;
    anchor_kind: 'component';
    anchor_id: string;
    anchor_path: string;
    tags?: string[];
  },
): Promise<{ comment: unknown }> {
  return request(`/pages/${pageId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ ...payload, commentType: 'agent_instruction' }),
  });
}

export async function getAgentComments(pageId: string): Promise<{ comments: unknown[]; open_count: number }> {
  return request(`/pages/${pageId}/agent-comments?status=open`);
}
