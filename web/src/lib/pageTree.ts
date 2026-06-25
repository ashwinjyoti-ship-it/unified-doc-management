import type { Page } from '../types';

/** Children for sidebar tree — excludes hidden database row backing pages */
export function getChildren(pages: Page[], parentId: string | null): Page[] {
  return pages.filter((p) => p.parent_id === parentId && !p.is_row_page);
}

export function buildChildrenIndex(pages: Page[]): Map<string | null, Page[]> {
  const index = new Map<string | null, Page[]>();
  for (const page of pages) {
    if (page.is_row_page) continue;
    const key = page.parent_id;
    const list = index.get(key) ?? [];
    list.push(page);
    index.set(key, list);
  }
  for (const list of index.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return index;
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
