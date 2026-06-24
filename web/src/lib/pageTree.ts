import type { Page } from '../types';

export function getChildren(pages: Page[], parentId: string | null): Page[] {
  return pages.filter((p) => p.parent_id === parentId);
}

/** Top-level folders — treated as projects in the sidebar */
export function getRootProjects(pages: Page[]): Page[] {
  return getChildren(pages, null).filter((p) => p.type === 'folder');
}

/** Root pages and databases kept outside projects (daily notes, quick captures, etc.) */
export function getInboxPages(pages: Page[]): Page[] {
  return getChildren(pages, null).filter((p) => p.type !== 'folder');
}

export function isProject(page: Page): boolean {
  return page.type === 'folder' && page.parent_id === null;
}

export function isDescendant(pages: Page[], ancestorId: string, nodeId: string): boolean {
  let current = pages.find((p) => p.id === nodeId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = pages.find((p) => p.id === current!.parent_id);
  }
  return false;
}

export function canNestUnder(
  pages: Page[],
  draggedId: string,
  targetParentId: string | null,
  excludeIds: Set<string> = new Set(),
): boolean {
  if (draggedId === targetParentId) return false;
  if (targetParentId && excludeIds.has(targetParentId)) return false;
  if (targetParentId && isDescendant(pages, draggedId, targetParentId)) return false;
  for (const id of excludeIds) {
    if (id !== draggedId && targetParentId && isDescendant(pages, id, targetParentId)) return false;
  }
  return true;
}

export function pageIcon(page: Page): string {
  return page.icon || (page.type === 'folder' ? '📁' : page.type === 'database' ? '🗃️' : '📄');
}

export function collectDescendantIds(pages: Page[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  const walk = (parentId: string) => {
    for (const child of getChildren(pages, parentId)) {
      ids.add(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return ids;
}
