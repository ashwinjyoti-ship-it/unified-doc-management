import { api } from './api';
import type { Page } from '../types';

/** Create a root-level project folder, optionally with one child page or database. */
export async function createProject(
  workspaceId: string,
  options: {
    projectTitle: string;
    projectIcon?: string;
    child?: { type: 'page' | 'database'; title: string; icon?: string };
  },
): Promise<Page> {
  const { page: project } = await api.createPage(workspaceId, {
    type: 'folder',
    title: options.projectTitle,
    icon: options.projectIcon ?? '🗂️',
  });

  if (options.child) {
    await api.createPage(workspaceId, {
      type: options.child.type,
      title: options.child.title,
      icon: options.child.icon,
      parentId: project.id,
    });
  }

  return project;
}
