const STORAGE_PREFIX = 'udm-db-col-widths:';
export const DEFAULT_COLUMN_WIDTH = 160;
export const DEFAULT_NAME_COLUMN_WIDTH = 220;
export const MIN_COLUMN_WIDTH = 72;

export function loadColumnWidths(pageId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pageId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const widths: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        widths[id] = Math.max(MIN_COLUMN_WIDTH, value);
      }
    }
    return widths;
  } catch {
    return {};
  }
}

export function saveColumnWidths(pageId: string, widths: Record<string, number>) {
  localStorage.setItem(`${STORAGE_PREFIX}${pageId}`, JSON.stringify(widths));
}

export function defaultWidthForProperty(name: string): number {
  return name.toLowerCase() === 'name' ? DEFAULT_NAME_COLUMN_WIDTH : DEFAULT_COLUMN_WIDTH;
}
