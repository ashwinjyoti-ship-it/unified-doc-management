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

export type RollupAggregation = 'count' | 'count_values' | 'sum' | 'average' | 'min' | 'max' | 'show_unique';

export interface RollupOptions {
  relationPropertyId: string;
  targetPropertyId: string;
  aggregation: RollupAggregation;
}

export interface RelatedSchemaProperty {
  id: string;
  name: string;
  type: string;
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
  getValue: (row: DatabaseRow, propId: string) => unknown = getPropValue,
): boolean {
  const raw = getValue(row, filter.propertyId);
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

export function applyFilters(
  rows: DatabaseRow[],
  filters: DatabaseFilter[],
  getValue: (row: DatabaseRow, propId: string) => unknown = getPropValue,
): DatabaseRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) => filters.every((f) => matchFilter(row, f, getValue)));
}

export function applySort(
  rows: DatabaseRow[],
  sorts: DatabaseSort[],
  properties: DatabaseProperty[],
  getValue: (row: DatabaseRow, propId: string) => unknown = getPropValue,
): DatabaseRow[] {
  if (sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const prop = properties.find((p) => p.id === sort.propertyId);
      const av = String(getValue(a, sort.propertyId));
      const bv = String(getValue(b, sort.propertyId));
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

export function parseMultiSelectValue(raw: unknown): string[] {
  return parseRelationValue(raw);
}

export function parseCheckboxValue(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

export function parseRollupOptions(options: string): Partial<RollupOptions> {
  try {
    const parsed = JSON.parse(options || '{}');
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Partial<RollupOptions>;
    }
  } catch { /* ignore */ }
  return {};
}

export const ROLLUP_AGGREGATIONS: { value: RollupAggregation; label: string }[] = [
  { value: 'count', label: 'Count all' },
  { value: 'count_values', label: 'Count values' },
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'show_unique', label: 'Show unique' },
];

export function parseRelationOptions(options: string): { relatedDatabaseId?: string } {
  try {
    const parsed = JSON.parse(options || '{}');
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as { relatedDatabaseId?: string };
    }
  } catch { /* ignore */ }
  return {};
}
