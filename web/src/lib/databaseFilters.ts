import type { DatabaseProperty, DatabaseRow } from '../types';

export type FilterOperator = 'eq' | 'neq' | 'contains' | 'empty' | 'not_empty';

export interface DatabaseFilter {
  propertyId: string;
  operator: FilterOperator;
  value?: string;
}

export interface DatabaseSort {
  propertyId: string;
  direction: 'asc' | 'desc';
}

export type ViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'list';

export interface SavedDatabaseView {
  id: string;
  database_id: string;
  name: string;
  view_type: ViewType;
  filters: string;
  sort_config: string;
  order_index: number;
}

export interface RelationRowOption {
  id: string;
  page_id: string | null;
  title: string;
}

export function parseRowProperties(row: DatabaseRow): Record<string, unknown> {
  try {
    return JSON.parse(row.properties || '{}');
  } catch {
    return {};
  }
}

export function getPropValue(row: DatabaseRow, propId: string): unknown {
  return parseRowProperties(row)[propId] ?? '';
}

export function getRowTitle(
  row: DatabaseRow,
  nameProp: DatabaseProperty | undefined,
): string {
  if (row.page_title) return row.page_title;
  if (nameProp) return String(getPropValue(row, nameProp.id) || 'Untitled');
  return 'Untitled';
}

function matchFilter(
  row: DatabaseRow,
  filter: DatabaseFilter,
): boolean {
  const raw = getPropValue(row, filter.propertyId);
  const value = Array.isArray(raw) ? raw.join(',') : String(raw ?? '');

  switch (filter.operator) {
    case 'eq':
      return value === (filter.value ?? '');
    case 'neq':
      return value !== (filter.value ?? '');
    case 'contains':
      return value.toLowerCase().includes((filter.value ?? '').toLowerCase());
    case 'empty':
      return value === '' || (Array.isArray(raw) && raw.length === 0);
    case 'not_empty':
      return value !== '' && !(Array.isArray(raw) && raw.length === 0);
    default:
      return true;
  }
}

export function applyFilters(rows: DatabaseRow[], filters: DatabaseFilter[]): DatabaseRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) => filters.every((f) => matchFilter(row, f)));
}

export function applySort(
  rows: DatabaseRow[],
  sorts: DatabaseSort[],
  properties: DatabaseProperty[],
): DatabaseRow[] {
  if (sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const prop = properties.find((p) => p.id === sort.propertyId);
      const av = String(getPropValue(a, sort.propertyId));
      const bv = String(getPropValue(b, sort.propertyId));
      let cmp = av.localeCompare(bv, undefined, { numeric: true });
      if (prop?.name.toLowerCase() === 'priority') {
        const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
        cmp = (order[av] ?? 99) - (order[bv] ?? 99);
      }
      if (cmp !== 0) return sort.direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

export function parseRelationValue(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw) return [raw];
  return [];
}

export function parseRelationOptions(options: string): { relatedDatabaseId?: string } {
  try {
    const parsed = JSON.parse(options || '{}');
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as { relatedDatabaseId?: string };
    }
  } catch { /* ignore */ }
  return {};
}
