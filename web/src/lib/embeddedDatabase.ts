import type { Page } from '../types';

/** Resolve the database page id for an inline embed (handles stale/wrong ids). */
export function resolveEmbeddedDatabaseId(
  databaseId: string | null | undefined,
  hostPageId: string | undefined,
  pages: Page[],
): string | null {
  if (!databaseId) return null;

  const direct = pages.find((p) => p.id === databaseId);
  if (direct?.type === 'database') return databaseId;

  if (!hostPageId) return databaseId;

  const inlineDatabases = pages.filter(
    (p) => p.type === 'database' && p.parent_id === hostPageId,
  );
  if (inlineDatabases.length === 0) return databaseId;

  // Prefer the id stored on the embed when it matches a sibling inline database.
  const sibling = inlineDatabases.find((p) => p.id === databaseId);
  if (sibling) return sibling.id;

  // Common bug: embed stored the host page id instead of the child database id.
  if (databaseId === hostPageId) {
    return inlineDatabases[inlineDatabases.length - 1]!.id;
  }

  // Unknown id — use the most recently created inline database on this page.
  return inlineDatabases[inlineDatabases.length - 1]!.id;
}
