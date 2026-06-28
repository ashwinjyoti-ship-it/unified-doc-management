const STORAGE_PREFIX = 'udm-db-col-order:';

export function loadColumnOrder(pageId: string): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pageId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function saveColumnOrder(pageId: string, order: string[]) {
  localStorage.setItem(`${STORAGE_PREFIX}${pageId}`, JSON.stringify(order));
}
