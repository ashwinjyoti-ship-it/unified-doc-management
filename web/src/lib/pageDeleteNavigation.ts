import type { Page } from '../types';
import {
  buildChildrenIndex,
  getInboxPages,
  getRootProjects,
  isSidebarHiddenPage,
} from './pageTree';

/** Flat sidebar display order: favorites → recent → project tree → inbox. */
export function getSidebarPageOrder(
  pages: Page[],
  favorites: Page[],
  recent: Page[],
): Page[] {
  const seen = new Set<string>();
  const ordered: Page[] = [];

  const add = (page: Page) => {
    if (isSidebarHiddenPage(page, pages) || seen.has(page.id)) return;
    seen.add(page.id);
    ordered.push(page);
  };

  for (const page of favorites) add(page);

  const favoriteIds = new Set(favorites.map((p) => p.id));
  for (const page of recent) {
    if (!favoriteIds.has(page.id)) add(page);
  }

  const childrenIndex = buildChildrenIndex(pages);

  const walkTree = (page: Page) => {
    add(page);
    for (const child of childrenIndex.get(page.id) ?? []) {
      walkTree(child);
    }
  };

  for (const project of getRootProjects(pages)) {
    walkTree(project);
  }
  for (const page of getInboxPages(pages)) {
    add(page);
  }

  return ordered;
}

/** Pick the next sidebar item after deleting one or more pages. */
export function resolvePageAfterDelete(
  order: Page[],
  deletedIds: Set<string>,
  currentPageId: string | null,
): string | null {
  const remaining = order.filter((p) => !deletedIds.has(p.id));
  if (remaining.length === 0) return null;

  if (!currentPageId || !deletedIds.has(currentPageId)) {
    return remaining[0].id;
  }

  const idx = order.findIndex((p) => p.id === currentPageId);
  if (idx === -1) return remaining[0].id;

  for (let i = idx + 1; i < order.length; i++) {
    if (!deletedIds.has(order[i].id)) return order[i].id;
  }
  for (let i = idx - 1; i >= 0; i--) {
    if (!deletedIds.has(order[i].id)) return order[i].id;
  }

  return remaining[0].id;
}
