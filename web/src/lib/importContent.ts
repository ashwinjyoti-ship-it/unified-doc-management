import { api } from './api';
import type { ImportMode } from '../components/ImportOptionsModal';

export async function applyImportContent(opts: {
  content: string;
  mode: ImportMode;
  pageId?: string;
  workspaceId: string;
  suggestedTitle?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { content, mode, pageId, workspaceId, suggestedTitle, signal } = opts;

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  if (mode === 'new') {
    const { page } = await api.createPage(workspaceId, {
      title: suggestedTitle || 'Imported',
      icon: '🔗',
    });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await api.saveMarkdown(page.id, content);
    return page.id;
  }

  if (!pageId) throw new Error('No page selected for import');

  let finalContent = content;
  if (mode === 'append') {
    const { markdown: current } = await api.getMarkdown(pageId);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    finalContent = current.trim() ? `${current.trim()}\n\n---\n\n${content}` : content;
  }

  await api.saveMarkdown(pageId, finalContent);
  return pageId;
}
