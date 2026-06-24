import type { Page } from '../types';
import { collectDescendantIds, getChildren, isProject } from './pageTree';

/** Nearest root project folder containing this page, if any. */
export function getContainingProject(pages: Page[], page: Page): Page | null {
  if (isProject(page)) return page;
  let current = page;
  while (current.parent_id) {
    const parent = pages.find((p) => p.id === current.parent_id);
    if (!parent) break;
    if (isProject(parent)) return parent;
    current = parent;
  }
  return null;
}

export function isInsideProject(pages: Page[], page: Page): boolean {
  if (isProject(page)) return false;
  return getContainingProject(pages, page) !== null;
}

/** Delete children before parents so FK orphans are avoided. */
export function getDeleteOrder(pages: Page[], pageId: string): string[] {
  const order: string[] = [];
  const walk = (id: string) => {
    for (const child of getChildren(pages, id)) {
      walk(child.id);
    }
    order.push(id);
  };
  walk(pageId);
  return order;
}

export function buildDeleteConfirmMessage(pages: Page[], page: Page): string {
  const title = page.title || 'Untitled';
  const descendants = collectDescendantIds(pages, page.id);
  const childCount = descendants.size - 1;
  const project = getContainingProject(pages, page);

  if (isProject(page)) {
    if (childCount > 0) {
      return `Delete project "${title}" and all ${childCount} item${childCount === 1 ? '' : 's'} inside?\n\nThis cannot be undone.`;
    }
    return `Delete project "${title}"? This cannot be undone.`;
  }

  if (page.type === 'folder' && childCount > 0) {
    const projectName = project?.title ?? 'this project';
    return `Delete folder "${title}" and ${childCount} nested item${childCount === 1 ? '' : 's'} inside ${projectName}?\n\nThis cannot be undone.`;
  }

  if (project) {
    return `Delete "${title}"?\n\nThis page is part of the "${project.title}" project and will be permanently removed.`;
  }

  return `Delete "${title}"? This cannot be undone.`;
}
