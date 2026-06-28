import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { useCollab } from '../hooks/useCollab';
import { useDatabaseColumnResize } from '../hooks/useDatabaseColumnResize';
import { loadColumnOrder, saveColumnOrder } from '../lib/databaseColumnOrder';
import type { DatabaseProperty, DatabaseRow, SavedDatabaseView } from '../types';
import {
  applyFilters,
  applySort,
  getPropValue,
  getRowTitle,
  parseRelationOptions,
  parseRelationValue,
  parseMultiSelectValue,
  parseCheckboxValue,
  parseRollupOptions,
  ROLLUP_AGGREGATIONS,
  type DatabaseFilter,
  type DatabaseSort,
  type FilterOperator,
  type RelatedSchemaProperty,
  type RollupAggregation,
  type ViewType,
} from '../lib/databaseFilters';
import {
  Plus, Table, LayoutGrid, Calendar, List, Trash2, Images,
  Filter, Save, ExternalLink, X, MoreHorizontal, GripVertical,
} from 'lucide-react';
import DatabaseTextCell from './DatabaseTextCell';
import RelationPicker from './RelationPicker';
import DatabaseRowPanel from './DatabaseRowPanel';
import Tooltip from './Tooltip';
import AlertDialog from './AlertDialog';
import ConfirmDialog from './ConfirmDialog';

interface SortableColumnHeaderProps {
  prop: DatabaseProperty;
  rollupHeaderHint: (prop: DatabaseProperty) => string;
  columnMenuId: string | null;
  setColumnMenuId: (id: string | null) => void;
  setEditingColumnId: (id: string | null) => void;
  setNewPropName: (name: string) => void;
  setNewPropType: (type: string) => void;
  setAddingColumn: (v: boolean) => void;
  onDeleteProperty: (id: string) => void;
  startResize: (id: string, name: string, clientX: number) => void;
}

function SortableColumnHeader({
  prop,
  rollupHeaderHint,
  columnMenuId,
  setColumnMenuId,
  setEditingColumnId,
  setNewPropName,
  setNewPropType,
  setAddingColumn,
  onDeleteProperty,
  startResize,
}: SortableColumnHeaderProps) {
  const { setNodeRef, transform, transition, isDragging, listeners, attributes } = useSortable({ id: prop.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="text-left px-3 py-2.5 font-medium text-charcoal relative group db-th"
    >
      <div className="flex items-center gap-1 min-w-0 pr-2">
        <button
          {...listeners}
          {...attributes}
          type="button"
          className="shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-80 cursor-grab active:cursor-grabbing touch-none p-0.5 rounded"
          aria-label={`Drag to reorder ${prop.name} column`}
          title="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <span className="truncate" title={prop.type === 'rollup' ? rollupHeaderHint(prop) : prop.name}>{prop.name}</span>
        <button
          type="button"
          onClick={() => setColumnMenuId(columnMenuId === prop.id ? null : prop.id)}
          className="p-0.5 rounded shrink-0 opacity-30 group-hover:opacity-100 hover:bg-linen focus-visible:opacity-100"
          aria-label="Column options"
          title="Column options — rename, change type, or delete"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        type="button"
        aria-label={`Resize ${prop.name} column`}
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 hover:bg-forest/10 focus-visible:opacity-100"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startResize(prop.id, prop.name, e.clientX);
        }}
      />
      {columnMenuId === prop.id && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setColumnMenuId(null)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-green-mist bg-warm-white shadow-lg py-1 text-sm">
            <button
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-linen"
              onClick={() => {
                setEditingColumnId(prop.id);
                setNewPropName(prop.name);
                setNewPropType(prop.type);
                setColumnMenuId(null);
                setAddingColumn(true);
              }}
            >
              Rename / change type
            </button>
            {prop.name.toLowerCase() !== 'name' && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
                onClick={() => onDeleteProperty(prop.id)}
              >
                Delete column
              </button>
            )}
          </div>
        </>
      )}
    </th>
  );
}

const FILTER_OPS: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'empty', label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
];

interface DatabaseViewProps {
  pageId: string;
  embedded?: boolean;
  hostPageId?: string;
}

export default function DatabaseView({ pageId, embedded = false }: DatabaseViewProps) {
  const addPageToStore = useStore((s) => s.addPageToStore);
  const removePageFromStore = useStore((s) => s.removePageFromStore);
  const user = useStore((s) => s.user);
  // Timestamp of the most recent local mutation. Used to ignore the realtime
  // echo of our own writes so a live-reload never clobbers in-progress typing.
  const lastLocalEditRef = useRef(0);
  const [properties, setProperties] = useState<DatabaseProperty[]>([]);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [savedViews, setSavedViews] = useState<SavedDatabaseView[]>([]);
  const [relationData, setRelationData] = useState<Record<string, Array<{ id: string; page_id: string | null; title: string }>>>({});
  const [relatedSchemas, setRelatedSchemas] = useState<Record<string, RelatedSchemaProperty[]>>({});
  const [rollupValues, setRollupValues] = useState<Record<string, Record<string, string | number>>>({});
  const [workspaceDatabases, setWorkspaceDatabases] = useState<Array<{ id: string; title: string; icon: string | null }>>([]);
  const [view, setView] = useState<ViewType>('table');
  const [filters, setFilters] = useState<DatabaseFilter[]>([]);
  const [sorts, setSorts] = useState<DatabaseSort[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<DatabaseRow | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnMenuId, setColumnMenuId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [showSaveView, setShowSaveView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('text');
  const [newPropOptions, setNewPropOptions] = useState('');
  const [newRelationDbId, setNewRelationDbId] = useState('');
  const [newRollupRelationPropId, setNewRollupRelationPropId] = useState('');
  const [newRollupTargetPropId, setNewRollupTargetPropId] = useState('');
  const [newRollupAggregation, setNewRollupAggregation] = useState<RollupAggregation>('count');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);

  const showAlert = useCallback((message: string) => {
    setAlertMessage(message);
  }, []);

  const { lastUpdate } = useCollab(pageId, user?.id || '', user?.name || '');

  useEffect(() => {
    void loadDatabase();
  }, [pageId]);

  // Live-reload when another client (e.g. an AI agent) changes this database,
  // unless we just made a local edit — that echo would clobber current typing.
  useEffect(() => {
    if (lastUpdate?.type !== 'database_updated') return;
    if (Date.now() - lastLocalEditRef.current < 2500) return;
    void loadDatabase({ silent: true });
  }, [lastUpdate]);

  const loadDatabase = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getDatabase(pageId);
      setProperties(data.properties);
      setRows(data.rows);
      setSavedViews(data.views || []);
      setRelationData(data.relationData || {});
      setRelatedSchemas(data.relatedSchemas || {});
      setRollupValues(data.rollupValues || {});
      setWorkspaceDatabases(data.databases || []);
    } catch (err) {
      setProperties([]);
      setRows([]);
      setLoadError(err instanceof Error ? err.message : 'Could not load database');
    } finally {
      setLoading(false);
    }
  };

  const applySavedView = (sv: SavedDatabaseView) => {
    setActiveViewId(sv.id);
    setView(sv.view_type as ViewType);
    try {
      setFilters(JSON.parse(sv.filters || '[]'));
      setSorts(JSON.parse(sv.sort_config || '[]'));
    } catch {
      setFilters([]);
      setSorts([]);
    }
  };

  const clearSavedView = () => {
    setActiveViewId(null);
    setFilters([]);
    setSorts([]);
  };

  const addRow = async () => {
    lastLocalEditRef.current = Date.now();
    try {
      const { row } = await api.createDatabaseRow(pageId);
      setRows((prev) => [...prev, row]);
      if (row.page_id) {
        addPageToStore({
          id: row.page_id,
          workspace_id: '',
          parent_id: pageId,
          title: row.page_title || 'Untitled',
          icon: '📄',
          type: 'page',
          visibility: 'private',
          content_md: '',
          is_row_page: 1,
          created_by: '',
          created_at: 0,
          updated_at: 0,
        });
      }
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'Could not add row');
    }
  };

  const refreshRollups = useCallback(async () => {
    const data = await api.getDatabase(pageId);
    setRollupValues(data.rollupValues || {});
    setRelationData(data.relationData || {});
  }, [pageId]);

  const patchRowLocal = useCallback((rowId: string, propId: string, value: unknown) => {
    lastLocalEditRef.current = Date.now();
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const props = { ...JSON.parse(r.properties || '{}'), [propId]: value };
        return { ...r, properties: JSON.stringify(props) };
      }),
    );
  }, []);

  const flushSave = useCallback(async (rowId: string, propId: string, value: unknown) => {
    patchRowLocal(rowId, propId, value);
    try {
      const { row: updated } = await api.updateDatabaseRow(pageId, rowId, {
        properties: { [propId]: value },
      });
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const currentProps = JSON.parse(r.properties || '{}') as Record<string, unknown>;
          if (currentProps[propId] !== value) return r;
          return updated;
        }),
      );
    } catch {
      await loadDatabase();
    }
  }, [pageId, patchRowLocal]);

  const persistCell = useCallback((rowId: string, propId: string, value: unknown) => {
    patchRowLocal(rowId, propId, value);
    void flushSave(rowId, propId, value);
  }, [patchRowLocal, flushSave]);

  const updateCellImmediate = useCallback((rowId: string, propId: string, value: unknown) => {
    patchRowLocal(rowId, propId, value);
    void flushSave(rowId, propId, value);
  }, [patchRowLocal, flushSave]);

  const deleteRow = async (rowId: string) => {
    lastLocalEditRef.current = Date.now();
    const row = rows.find((r) => r.id === rowId);
    await api.deleteDatabaseRow(pageId, rowId);
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    if (row?.page_id) removePageFromStore(row.page_id);
    if (selectedRow?.id === rowId) setSelectedRow(null);
  };

  const openRowPanel = (row: DatabaseRow) => setSelectedRow(row);

  const addProperty = async () => {
    if (!newPropName.trim()) {
      showAlert('Enter a property name');
      return;
    }
    let options: string[] | { relatedDatabaseId?: string; relationPropertyId?: string; targetPropertyId?: string; aggregation?: string } | undefined;
    if (newPropType === 'select' || newPropType === 'multi_select') {
      options = newPropOptions.split(',').map((s) => s.trim()).filter(Boolean);
      if (options.length === 0) {
        showAlert('Enter at least one option (comma-separated)');
        return;
      }
    } else if (newPropType === 'relation') {
      if (!newRelationDbId) {
        showAlert('Select a database to link to');
        return;
      }
      options = { relatedDatabaseId: newRelationDbId };
    } else if (newPropType === 'rollup') {
      if (!newRollupRelationPropId || !newRollupTargetPropId) {
        showAlert('Select a relation property and target property for the rollup');
        return;
      }
      options = {
        relationPropertyId: newRollupRelationPropId,
        targetPropertyId: newRollupTargetPropId,
        aggregation: newRollupAggregation,
      };
    }
    try {
      const { property } = await api.createDatabaseProperty(pageId, {
        name: newPropName.trim(),
        type: newPropType,
        options,
      });
      setProperties([...properties, property]);
      setNewPropName('');
      setNewPropOptions('');
      setNewRelationDbId('');
      setNewRollupRelationPropId('');
      setNewRollupTargetPropId('');
      setNewRollupAggregation('count');
      setAddingColumn(false);
      setEditingColumnId(null);
      await loadDatabase();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'Could not add property');
    }
  };

  const updateProperty = async (propId: string, data: {
    name?: string;
    type?: string;
    options?: string[] | Record<string, unknown>;
  }) => {
    const { property } = await api.updateDatabaseProperty(pageId, propId, data);
    setProperties((prev) => prev.map((p) => (p.id === propId ? property : p)));
    setEditingColumnId(null);
    setColumnMenuId(null);
    await loadDatabase();
  };

  const deleteProperty = (propId: string) => {
    setColumnMenuId(null);
    setDeleteColumnId(propId);
  };

  const confirmDeleteProperty = async () => {
    const propId = deleteColumnId;
    if (!propId) return;
    try {
      await api.deleteDatabaseProperty(pageId, propId);
      setProperties((prev) => prev.filter((p) => p.id !== propId));
      await loadDatabase();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'Could not delete column');
    } finally {
      setDeleteColumnId(null);
    }
  };

  const rollupHeaderHint = (prop: DatabaseProperty) => {
    const opts = parseRollupOptions(prop.options);
    if (!opts.relationPropertyId) return 'Computed rollup';
    const rel = properties.find((p) => p.id === opts.relationPropertyId);
    const agg = ROLLUP_AGGREGATIONS.find((a) => a.value === opts.aggregation)?.label || opts.aggregation;
    return `Shows ${agg} via relation "${rel?.name || '?'}"`;
  };

  const saveCurrentView = async () => {
    if (!newViewName.trim()) return;
    const { view: created } = await api.createDatabaseView(pageId, {
      name: newViewName.trim(),
      viewType: view,
      filters,
      sortConfig: sorts,
    });
    setSavedViews([...savedViews, created]);
    setActiveViewId(created.id);
    setNewViewName('');
    setShowSaveView(false);
  };

  const updateActiveView = async () => {
    if (!activeViewId) return;
    const { view: updated } = await api.updateDatabaseView(pageId, activeViewId, {
      viewType: view,
      filters,
      sortConfig: sorts,
    });
    setSavedViews(savedViews.map((v) => (v.id === activeViewId ? updated : v)));
  };

  const addFilter = () => {
    const firstProp = properties[0];
    if (!firstProp) return;
    setFilters([...filters, { propertyId: firstProp.id, operator: 'contains', value: '' }]);
    setActiveViewId(null);
  };

  const statusProp = properties.find((p) => p.type === 'select' && p.name.toLowerCase().includes('status'))
    || properties.find((p) => p.type === 'select');
  const dateProp = properties.find((p) => p.type === 'date');
  const nameProp = properties.find((p) => p.name.toLowerCase() === 'name') || properties[0];
  const relationProperties = properties.filter((p) => p.type === 'relation');
  const { getWidth, startResize, tableWidth } = useDatabaseColumnResize(pageId, properties);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => loadColumnOrder(pageId));

  useEffect(() => {
    setColumnOrder((prev) => {
      const existingIds = new Set(properties.map((p) => p.id));
      const filtered = prev.filter((id) => existingIds.has(id));
      const newIds = properties.map((p) => p.id).filter((id) => !filtered.includes(id));
      const next = [...filtered, ...newIds];
      if (next.join(',') !== prev.join(',')) {
        saveColumnOrder(pageId, next);
        return next;
      }
      return prev;
    });
  }, [properties, pageId]);

  const orderedProperties = useMemo(() => {
    if (columnOrder.length === 0) return properties;
    const orderMap = new Map(columnOrder.map((id, i) => [id, i]));
    return [...properties].sort((a, b) => {
      const ia = orderMap.get(a.id) ?? properties.indexOf(a);
      const ib = orderMap.get(b.id) ?? properties.indexOf(b);
      return ia - ib;
    });
  }, [columnOrder, properties]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((prev) => {
      const ids = prev.length ? prev : properties.map((p) => p.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(ids, oldIndex, newIndex);
      saveColumnOrder(pageId, next);
      return next;
    });
  }, [properties, pageId]);

  const rollupTargetProperties = useMemo(() => {
    if (!newRollupRelationPropId) return [];
    const relProp = properties.find((p) => p.id === newRollupRelationPropId);
    if (!relProp) return [];
    const relatedDbId = parseRelationOptions(relProp.options).relatedDatabaseId;
    if (!relatedDbId) return [];
    return relatedSchemas[relatedDbId] || [];
  }, [newRollupRelationPropId, properties, relatedSchemas]);

  const cellValue = useCallback((row: DatabaseRow, propId: string): unknown => {
    if (rollupValues[row.id]?.[propId] !== undefined) {
      return rollupValues[row.id][propId];
    }
    return getPropValue(row, propId);
  }, [rollupValues]);

  const displayRows = useMemo(
    () => applySort(applyFilters(rows, filters, cellValue), sorts, properties, cellValue),
    [rows, filters, sorts, properties, cellValue],
  );

  const galleryCoverStyle = (status: string) => {
    const colors: Record<string, string> = {
      'To Do': 'from-slate-200 to-slate-300',
      'In Progress': 'from-amber-100 to-amber-200',
      'Done': 'from-sage/60 to-forest/30',
    };
    return colors[status] || 'from-linen to-green-mist';
  };

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: '' });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr });
    }
    return { cells, monthLabel: now.toLocaleString('default', { month: 'long', year: 'numeric' }) };
  }, []);

  const viewTabs = [
    { id: 'table' as const, icon: Table, label: 'Table' },
    { id: 'board' as const, icon: LayoutGrid, label: 'Kanban' },
    { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
    { id: 'gallery' as const, icon: Images, label: 'Gallery' },
    { id: 'list' as const, icon: List, label: 'List' },
  ];

  const renderRelationCell = (row: DatabaseRow, prop: DatabaseProperty) => {
    const options = relationData[prop.id] || [];
    const selected = parseRelationValue(getPropValue(row, prop.id));
    return (
      <RelationPicker
        options={options}
        selected={selected}
        onChange={(vals) => {
          updateCellImmediate(row.id, prop.id, vals);
          void refreshRollups();
        }}
      />
    );
  };

  const renderNameCell = (row: DatabaseRow, prop: DatabaseProperty) => (
      <div className="flex items-center gap-1 min-w-[120px]">
        <DatabaseTextCell
          rowId={row.id}
          propId={prop.id}
          // The row title lives in two places — the Name property and the linked
          // page's title. They can drift (e.g. a partial data restore), so fall
          // back to the page title rather than render a blank Name cell.
          value={String(getPropValue(row, prop.id) || row.page_title || '')}
          type="text"
          onPersist={persistCell}
          className="flex-1 bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-linen focus:bg-linen text-sm text-charcoal db-cell-input"
        />
        {row.page_id && (
          <button
            type="button"
            onClick={() => openRowPanel(row)}
            className="p-1 rounded hover:bg-linen text-forest shrink-0"
            title="Open row"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );

  const renderCell = (row: DatabaseRow, prop: DatabaseProperty) => {
    if (prop.type === 'rollup') {
      return (
        <span className="text-sm text-charcoal bg-linen/50 px-2 py-1 rounded">
          {String(cellValue(row, prop.id) ?? '—')}
        </span>
      );
    }
    if (prop.type === 'relation') return renderRelationCell(row, prop);
    if (nameProp && prop.id === nameProp.id) return renderNameCell(row, prop);

    if (prop.type === 'select') {
      return (
        <select
          value={getPropValue(row, prop.id) as string}
          onChange={(e) => updateCellImmediate(row.id, prop.id, e.target.value)}
          className="w-full bg-transparent border-none outline-none text-sm text-charcoal"
        >
          <option value="">—</option>
          {JSON.parse(prop.options || '[]').map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (prop.type === 'multi_select') {
      const options = JSON.parse(prop.options || '[]') as string[];
      const selected = new Set(parseMultiSelectValue(getPropValue(row, prop.id)));
      return (
        <div className="flex flex-wrap gap-1 min-w-[140px]">
          {options.map((opt) => {
            const on = selected.has(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = new Set(selected);
                  if (on) next.delete(opt);
                  else next.add(opt);
                  updateCellImmediate(row.id, prop.id, [...next]);
                }}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  on ? 'bg-forest text-white border-forest' : 'bg-linen text-warm-gray border-green-mist hover:border-forest'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }
    if (prop.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={parseCheckboxValue(getPropValue(row, prop.id))}
          onChange={(e) => updateCellImmediate(row.id, prop.id, e.target.checked)}
          className="w-4 h-4 accent-forest"
        />
      );
    }
    if (prop.type === 'date') {
      return (
        <input
          type="date"
          value={getPropValue(row, prop.id) as string}
          onChange={(e) => updateCellImmediate(row.id, prop.id, e.target.value)}
          className="w-full bg-transparent border-none outline-none text-sm text-charcoal"
        />
      );
    }
    if (prop.type === 'long_text') {
      return (
        <DatabaseTextCell
          rowId={row.id}
          propId={prop.id}
          value={String(getPropValue(row, prop.id) ?? '')}
          type="long_text"
          onPersist={persistCell}
          className="w-full bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-linen focus:bg-linen text-sm text-charcoal db-cell-input"
        />
      );
    }
    return (
      <DatabaseTextCell
        rowId={row.id}
        propId={prop.id}
        value={String(getPropValue(row, prop.id) ?? '')}
        type={prop.type === 'number' ? 'number' : 'text'}
        onPersist={persistCell}
        className="w-full bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-linen focus:bg-linen text-sm text-charcoal db-cell-input"
      />
    );
  };

  const formatRelationDisplay = (row: DatabaseRow, prop: DatabaseProperty) => {
    const selected = parseRelationValue(getPropValue(row, prop.id));
    const options = relationData[prop.id] || [];
    return selected
      .map((id) => options.find((o) => o.id === id)?.title || id)
      .join(', ') || '—';
  };

  const formatCellDisplay = (row: DatabaseRow, prop: DatabaseProperty) => {
    if (prop.type === 'relation') return formatRelationDisplay(row, prop);
    if (prop.type === 'multi_select') {
      const vals = parseMultiSelectValue(getPropValue(row, prop.id));
      return vals.length ? vals.join(', ') : '—';
    }
    if (prop.type === 'checkbox') {
      return parseCheckboxValue(getPropValue(row, prop.id)) ? 'Yes' : 'No';
    }
    return String(cellValue(row, prop.id) || '—');
  };

  const RowTitleButton = ({ row }: { row: DatabaseRow }) => (
    <button
      type="button"
      onClick={() => openRowPanel(row)}
      className="font-medium text-left text-forest hover:underline flex items-center gap-1"
    >
      {getRowTitle(row, nameProp)}
      <ExternalLink className="w-3 h-3 opacity-60" />
    </button>
  );

  if (loading) return <div className={`${embedded ? 'p-4' : 'p-8'} text-mid-gray`}>Loading database...</div>;

  if (loadError) {
    return (
      <div className={`${embedded ? 'p-4' : 'p-8'} text-sm text-red-600`}>
        {loadError}
      </div>
    );
  }

  return (
    <div
      className={embedded ? 'space-y-3' : 'space-y-4'}
      {...(embedded ? {
        contentEditable: false,
        suppressContentEditableWarning: true,
        onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
        onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
      } : {})}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 bg-linen rounded-xl p-1 flex-wrap">
          {viewTabs.map(({ id, icon: Icon, label }) => (
            <Tooltip key={id} text={`Switch to ${label.toLowerCase()} view`}>
              <button
                type="button"
                onClick={() => { setView(id); setActiveViewId(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  view === id ? 'bg-warm-white shadow-sm text-forest font-medium' : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tooltip text="Add a new row to this database">
            <button type="button" onClick={() => void addRow()} className="btn-primary text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> New Row
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Saved views */}
      <div className="flex flex-wrap items-center gap-2">
        {savedViews.length > 0 && (
          <select
            value={activeViewId || ''}
            onChange={(e) => {
              const sv = savedViews.find((v) => v.id === e.target.value);
              if (sv) applySavedView(sv);
              else clearSavedView();
            }}
            className="text-sm bg-linen rounded-lg px-3 py-1.5 border-none outline-none text-charcoal"
          >
            <option value="">All rows</option>
            {savedViews.map((sv) => (
              <option key={sv.id} value={sv.id}>{sv.name}</option>
            ))}
          </select>
        )}
        <Tooltip text="Save the current filters, sort, and view type">
          <button type="button" onClick={() => setShowSaveView(true)} className="btn-secondary text-xs flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> Save view
          </button>
        </Tooltip>
        {activeViewId && (
          <button type="button" onClick={() => void updateActiveView()} className="btn-secondary text-xs">
            Update view
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card-surface p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-charcoal flex items-center gap-1.5">
            <Filter className="w-4 h-4" /> Filters
          </span>
          <button type="button" onClick={addFilter} className="text-xs text-forest hover:underline">
            + Add filter
          </button>
        </div>
        {filters.length === 0 ? (
          <p className="text-xs text-mid-gray">No filters — showing all rows.</p>
        ) : (
          filters.map((f, i) => {
            const filterProp = properties.find((p) => p.id === f.propertyId);
            const propType = filterProp?.type ?? 'text';
            const updateFilter = (patch: Partial<DatabaseFilter>) => {
              const next = [...filters];
              next[i] = { ...f, ...patch };
              setFilters(next);
              setActiveViewId(null);
            };
            const relevantOps = propType === 'checkbox'
              ? FILTER_OPS.filter((op) => ['eq', 'neq'].includes(op.value))
              : propType === 'multi_select'
              ? FILTER_OPS.filter((op) => ['contains', 'empty', 'not_empty'].includes(op.value))
              : (propType === 'select' || propType === 'date' || propType === 'number')
              ? FILTER_OPS.filter((op) => ['eq', 'neq', 'empty', 'not_empty'].includes(op.value))
              : FILTER_OPS;
            const showValue = !['empty', 'not_empty'].includes(f.operator);
            let selectOptions: string[] = [];
            if (propType === 'select' || propType === 'multi_select') {
              try { selectOptions = JSON.parse(filterProp?.options || '[]') as string[]; } catch { /* */ }
            }
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={f.propertyId}
                  onChange={(e) => {
                    const newProp = properties.find((p) => p.id === e.target.value);
                    const newType = newProp?.type ?? 'text';
                    const defaultOp: FilterOperator = newType === 'checkbox' ? 'eq'
                      : newType === 'multi_select' ? 'contains'
                      : 'eq';
                    updateFilter({ propertyId: e.target.value, operator: defaultOp, value: '' });
                  }}
                  className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={f.operator}
                  onChange={(e) => updateFilter({ operator: e.target.value as FilterOperator })}
                  className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none"
                >
                  {relevantOps.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {showValue && propType === 'checkbox' && (
                  <select
                    value={f.value ?? 'true'}
                    onChange={(e) => updateFilter({ value: e.target.value })}
                    className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none"
                  >
                    <option value="true">Checked</option>
                    <option value="false">Unchecked</option>
                  </select>
                )}
                {showValue && (propType === 'select' || propType === 'multi_select') && (
                  <select
                    value={f.value ?? ''}
                    onChange={(e) => updateFilter({ value: e.target.value })}
                    className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none"
                  >
                    <option value="">Any</option>
                    {selectOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {showValue && propType === 'date' && (
                  <input
                    type="date"
                    value={f.value ?? ''}
                    onChange={(e) => updateFilter({ value: e.target.value })}
                    className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none"
                  />
                )}
                {showValue && propType === 'number' && (
                  <input
                    type="number"
                    value={f.value ?? ''}
                    onChange={(e) => updateFilter({ value: e.target.value })}
                    placeholder="Value"
                    className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none w-24"
                  />
                )}
                {showValue && !['checkbox', 'select', 'multi_select', 'date', 'number'].includes(propType) && (
                  <input
                    type="text"
                    value={f.value ?? ''}
                    onChange={(e) => updateFilter({ value: e.target.value })}
                    placeholder="Value"
                    className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none flex-1 min-w-[100px]"
                  />
                )}
                <button
                  type="button"
                  onClick={() => { setFilters(filters.filter((_, j) => j !== i)); setActiveViewId(null); }}
                  className="p-1 text-mid-gray hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
        <div className="flex items-center gap-2 pt-1 border-t border-green-mist/50">
          <span className="text-xs text-mid-gray">Sort by:</span>
          <select
            value={sorts[0]?.propertyId || ''}
            onChange={(e) => {
              if (!e.target.value) { setSorts([]); setActiveViewId(null); return; }
              setSorts([{ propertyId: e.target.value, direction: sorts[0]?.direction || 'asc' }]);
              setActiveViewId(null);
            }}
            className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none"
          >
            <option value="">Default order</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {sorts[0] && (
            <select
              value={sorts[0].direction}
              onChange={(e) => {
                setSorts([{ ...sorts[0], direction: e.target.value as 'asc' | 'desc' }]);
                setActiveViewId(null);
              }}
              className="text-sm bg-linen rounded-lg px-2 py-1 border-none outline-none"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          )}
        </div>
      </div>

      {view === 'table' && (
        <div className="overflow-x-auto rounded-lg db-table-shell">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
            <table
              className="text-sm border-collapse db-table"
              style={{ tableLayout: 'fixed', width: Math.max(tableWidth, 480) }}
            >
              <colgroup>
                {orderedProperties.map((prop) => (
                  <col key={prop.id} style={{ width: getWidth(prop.id, prop.name) }} />
                ))}
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <SortableContext items={orderedProperties.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
                    {orderedProperties.map((prop) => (
                      <SortableColumnHeader
                        key={prop.id}
                        prop={prop}
                        rollupHeaderHint={rollupHeaderHint}
                        columnMenuId={columnMenuId}
                        setColumnMenuId={setColumnMenuId}
                        setEditingColumnId={setEditingColumnId}
                        setNewPropName={setNewPropName}
                        setNewPropType={setNewPropType}
                        setAddingColumn={setAddingColumn}
                        onDeleteProperty={deleteProperty}
                        startResize={startResize}
                      />
                    ))}
                  </SortableContext>
                  <th className="p-2 db-th">
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setEditingColumnId(null);
                        setNewPropName('');
                        setNewPropType('text');
                        setNewPropOptions('');
                        setAddingColumn(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-linen text-forest"
                      title="Add a new column to this table"
                      aria-label="Add a new column to this table"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="db-th" />
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={row.id} className="hover:bg-linen/30">
                    {orderedProperties.map((prop) => (
                      <td key={prop.id} className="px-2 py-1.5 align-top db-td overflow-hidden">
                        {renderCell(row, prop)}
                      </td>
                    ))}
                    <td className="db-td" />
                    <td className="px-2 py-1.5 db-td">
                      <button
                        type="button"
                        onClick={() => void deleteRow(row.id)}
                        className="text-red-400 hover:text-red-600"
                        title="Delete this row"
                        aria-label="Delete this row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DndContext>
        </div>
      )}

      {view === 'board' && statusProp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {JSON.parse(statusProp.options || '[]').map((status: string) => (
            <div key={status} className="card-surface p-3">
              <h3 className="font-medium text-sm text-charcoal mb-3">{status}</h3>
              <div className="space-y-2">
                {displayRows.filter((r) => getPropValue(r, statusProp.id) === status).map((row) => (
                  <div key={row.id} className="bg-linen rounded-lg p-3 text-sm">
                    <RowTitleButton row={row} />
                    {properties.filter((p) => p.id !== nameProp?.id && p.id !== statusProp.id).map((p) => {
                      const val = formatCellDisplay(row, p);
                      if (!val || val === '—') return null;
                      return <div key={p.id} className="text-xs text-mid-gray mt-1">{p.name}: {String(val)}</div>;
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'board' && !statusProp && (
        <p className="text-sm text-mid-gray">Add a Status select property to use Kanban view.</p>
      )}

      {view === 'calendar' && dateProp && (
        <div className="card-surface p-4">
          <h3 className="font-medium text-sm mb-3">{calendarDays.monthLabel}</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-mid-gray mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.cells.map((cell, i) => {
              const dayRows = cell.dateStr
                ? displayRows.filter((r) => getPropValue(r, dateProp.id) === cell.dateStr)
                : [];
              return (
                <div key={i} className="min-h-16 p-1 border border-green-mist/30 rounded-lg text-xs">
                  {cell.day && <span className="text-mid-gray">{cell.day}</span>}
                  {dayRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openRowPanel(row)}
                      className="block w-full text-left bg-sage/30 rounded px-1 py-0.5 mt-0.5 truncate hover:bg-sage/50"
                    >
                      {getRowTitle(row, nameProp)}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'calendar' && !dateProp && (
        <p className="text-sm text-mid-gray">Add a Due Date property to use Calendar view.</p>
      )}

      {view === 'gallery' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayRows.map((row) => {
            const title = getRowTitle(row, nameProp);
            const status = statusProp ? String(getPropValue(row, statusProp.id) || '') : '';
            const due = dateProp ? String(getPropValue(row, dateProp.id) || '') : '';
            return (
              <div key={row.id} className="card-surface overflow-hidden group">
                <button
                  type="button"
                  onClick={() => openRowPanel(row)}
                  className={`w-full h-28 bg-gradient-to-br ${galleryCoverStyle(status)} flex items-center justify-center hover:opacity-90`}
                >
                  <span className="text-3xl opacity-80">{status === 'Done' ? '✅' : status === 'In Progress' ? '🔄' : '📄'}</span>
                </button>
                <div className="p-4">
                  <RowTitleButton row={row} />
                  {status && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-linen text-warm-gray">{status}</span>
                  )}
                  {due && <div className="text-xs text-mid-gray mt-2">Due {due}</div>}
                </div>
                <div className="px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => void deleteRow(row.id)} className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-2">
          {displayRows.map((row) => (
            <div key={row.id} className="card-surface p-4 flex flex-wrap items-center justify-between gap-2">
              <RowTitleButton row={row} />
              <div className="flex flex-wrap gap-4 text-sm text-warm-gray">
                {properties.filter((p) => p.id !== nameProp?.id).map((prop) => (
                  <span key={prop.id}>
                    <span className="text-mid-gray">{prop.name}:</span> {formatCellDisplay(row, prop)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {displayRows.length === 0 && (
        <div className="text-center py-12 text-mid-gray">
          <p>{rows.length === 0 ? 'No rows yet. Click "New Row" to get started.' : 'No rows match the current filters.'}</p>
        </div>
      )}

      {showSaveView && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowSaveView(false)}>
          <div className="card-surface w-full max-w-md p-6 rounded-t-2xl md:rounded-[14px] safe-bottom" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Save view</h3>
            <p className="text-sm text-mid-gray mb-3">Saves the current view type, filters, and sort order.</p>
            <input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g. Active tasks, Due this week"
              className="w-full px-3 py-2 rounded-lg border border-green-mist mb-4 outline-none focus:border-forest"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowSaveView(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="button" onClick={() => void saveCurrentView()} className="btn-primary flex-1 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {(addingColumn || editingColumnId) && (
        <div className="fixed inset-0 bg-black/40 z-[120] flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => { setAddingColumn(false); setEditingColumnId(null); }}>
          <div className="card-surface w-full max-w-md p-6 rounded-t-2xl md:rounded-[14px] safe-bottom" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">{editingColumnId ? 'Edit property' : 'Add property'}</h3>
            <label className="block text-sm text-mid-gray mb-1">Name</label>
            <input
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              placeholder="e.g. Priority, Project"
              className="w-full px-3 py-2 rounded-lg border border-green-mist mb-3 outline-none focus:border-forest"
            />
            <label className="block text-sm text-mid-gray mb-1">Type</label>
            <select
              value={newPropType}
              onChange={(e) => setNewPropType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-green-mist mb-3 outline-none"
            >
              <option value="text">Text</option>
              <option value="long_text">Long text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
              <option value="multi_select">Multi-select</option>
              <option value="checkbox">Checkbox</option>
              <option value="relation">Relation</option>
              <option value="rollup">Rollup</option>
            </select>
            {(newPropType === 'select' || newPropType === 'multi_select') && (
              <>
                <label className="block text-sm text-mid-gray mb-1">Options (comma-separated)</label>
                <input
                  value={newPropOptions}
                  onChange={(e) => setNewPropOptions(e.target.value)}
                  placeholder={newPropType === 'multi_select' ? 'Bug, Feature, Docs' : 'High, Medium, Low'}
                  className="w-full px-3 py-2 rounded-lg border border-green-mist mb-4 outline-none focus:border-forest"
                />
              </>
            )}
            {newPropType === 'relation' && (
              <>
                <label className="block text-sm text-mid-gray mb-1">Link to database</label>
                <select
                  value={newRelationDbId}
                  onChange={(e) => setNewRelationDbId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-green-mist mb-4 outline-none"
                >
                  <option value="">Select a database…</option>
                  {workspaceDatabases.map((db) => (
                    <option key={db.id} value={db.id}>{db.icon || '🗄️'} {db.title}</option>
                  ))}
                </select>
              </>
            )}
            {newPropType === 'rollup' && (
              <>
                {relationProperties.length === 0 ? (
                  <p className="text-sm text-mid-gray mb-4">Add a Relation property first, then create a rollup from it.</p>
                ) : (
                  <>
                    <label className="block text-sm text-mid-gray mb-1">Relation property</label>
                    <select
                      value={newRollupRelationPropId}
                      onChange={(e) => {
                        setNewRollupRelationPropId(e.target.value);
                        setNewRollupTargetPropId('');
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-green-mist mb-3 outline-none"
                    >
                      <option value="">Select relation…</option>
                      {relationProperties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <label className="block text-sm text-mid-gray mb-1">Property to roll up</label>
                    <select
                      value={newRollupTargetPropId}
                      onChange={(e) => setNewRollupTargetPropId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-green-mist mb-3 outline-none"
                      disabled={!newRollupRelationPropId}
                    >
                      <option value="">Select property…</option>
                      {rollupTargetProperties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                      ))}
                    </select>
                    <label className="block text-sm text-mid-gray mb-1">Calculate</label>
                    <select
                      value={newRollupAggregation}
                      onChange={(e) => setNewRollupAggregation(e.target.value as RollupAggregation)}
                      className="w-full px-3 py-2 rounded-lg border border-green-mist mb-4 outline-none"
                    >
                      {ROLLUP_AGGREGATIONS.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </>
                )}
              </>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setAddingColumn(false); setEditingColumnId(null); }} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  if (editingColumnId) {
                    let options: string[] | Record<string, unknown> | undefined;
                    if (newPropType === 'select' || newPropType === 'multi_select') {
                      options = newPropOptions.split(',').map((s) => s.trim()).filter(Boolean);
                    } else if (newPropType === 'relation' && newRelationDbId) {
                      options = { relatedDatabaseId: newRelationDbId };
                    } else if (newPropType === 'rollup' && newRollupRelationPropId && newRollupTargetPropId) {
                      options = {
                        relationPropertyId: newRollupRelationPropId,
                        targetPropertyId: newRollupTargetPropId,
                        aggregation: newRollupAggregation,
                      };
                    }
                    void updateProperty(editingColumnId, { name: newPropName.trim(), type: newPropType, options });
                  } else {
                    void addProperty();
                  }
                }}
                className="btn-primary flex-1 text-sm"
              >
                {editingColumnId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRow && (
        <DatabaseRowPanel
          pageId={pageId}
          row={rows.find((r) => r.id === selectedRow.id) || selectedRow}
          properties={properties}
          relationData={relationData}
          rollupValues={rollupValues[selectedRow.id] || {}}
          nameProp={nameProp}
          onClose={() => setSelectedRow(null)}
          onPersistCell={persistCell}
          onRowUpdated={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setSelectedRow(updated);
          }}
          onPropertiesChange={() => void loadDatabase()}
        />
      )}

      <ConfirmDialog
        open={deleteColumnId != null}
        title="Delete column"
        message="Delete this column? Values in all rows will be removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { void confirmDeleteProperty(); }}
        onCancel={() => setDeleteColumnId(null)}
      />

      <AlertDialog
        open={alertMessage != null}
        message={alertMessage ?? ''}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
