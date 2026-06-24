import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import type { DatabaseProperty, DatabaseRow } from '../types';
import { Plus, Table, LayoutGrid, Calendar, List, Trash2, Settings2 } from 'lucide-react';

type ViewType = 'table' | 'board' | 'calendar' | 'list';

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

interface DatabaseViewProps {
  pageId: string;
}

export default function DatabaseView({ pageId }: DatabaseViewProps) {
  const [properties, setProperties] = useState<DatabaseProperty[]>([]);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [view, setView] = useState<ViewType>('table');
  const [loading, setLoading] = useState(true);
  const [showAddProp, setShowAddProp] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('text');
  const [newPropOptions, setNewPropOptions] = useState('');
  const [listSortPropId, setListSortPropId] = useState<string | null>(null);

  useEffect(() => {
    loadDatabase();
  }, [pageId]);

  const loadDatabase = async () => {
    setLoading(true);
    try {
      const data = await api.getDatabase(pageId);
      setProperties(data.properties);
      setRows(data.rows);
      const priority = data.properties.find((p) => p.name.toLowerCase() === 'priority');
      if (priority && !listSortPropId) setListSortPropId(priority.id);
    } finally {
      setLoading(false);
    }
  };

  const addRow = async () => {
    const { row } = await api.createDatabaseRow(pageId, {});
    setRows([...rows, row]);
  };

  const updateCell = async (rowId: string, propId: string, value: unknown) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const props = { ...JSON.parse(row.properties), [propId]: value };
    const { row: updated } = await api.updateDatabaseRow(pageId, rowId, { properties: props });
    setRows(rows.map((r) => (r.id === rowId ? updated : r)));
  };

  const deleteRow = async (rowId: string) => {
    await api.deleteDatabaseRow(pageId, rowId);
    setRows(rows.filter((r) => r.id !== rowId));
  };

  const addProperty = async () => {
    if (!newPropName.trim()) return;
    const options = newPropType === 'select'
      ? newPropOptions.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const { property } = await api.createDatabaseProperty(pageId, {
      name: newPropName.trim(),
      type: newPropType,
      options,
    });
    setProperties([...properties, property]);
    setNewPropName('');
    setNewPropOptions('');
    setShowAddProp(false);
  };

  const getPropValue = (row: DatabaseRow, propId: string) => {
    const props = JSON.parse(row.properties || '{}');
    return props[propId] ?? '';
  };

  const statusProp = properties.find((p) => p.type === 'select' && p.name.toLowerCase().includes('status'))
    || properties.find((p) => p.type === 'select');
  const dateProp = properties.find((p) => p.type === 'date');

  const sortedListRows = useMemo(() => {
    if (!listSortPropId) return rows;
    const prop = properties.find((p) => p.id === listSortPropId);
    return [...rows].sort((a, b) => {
      const av = String(getPropValue(a, listSortPropId));
      const bv = String(getPropValue(b, listSortPropId));
      if (prop?.name.toLowerCase() === 'priority') {
        return (PRIORITY_ORDER[av] ?? 99) - (PRIORITY_ORDER[bv] ?? 99);
      }
      return av.localeCompare(bv);
    });
  }, [rows, listSortPropId, properties]);

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

  const views = [
    { id: 'table' as const, icon: Table, label: 'Table' },
    { id: 'board' as const, icon: LayoutGrid, label: 'Board' },
    { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
    { id: 'list' as const, icon: List, label: 'List' },
  ];

  const renderCell = (row: DatabaseRow, prop: DatabaseProperty) => {
    if (prop.type === 'select') {
      return (
        <select
          value={getPropValue(row, prop.id) as string}
          onChange={(e) => updateCell(row.id, prop.id, e.target.value)}
          className="w-full bg-transparent border-none outline-none text-sm text-charcoal"
        >
          <option value="">—</option>
          {JSON.parse(prop.options || '[]').map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (prop.type === 'date') {
      return (
        <input
          type="date"
          value={getPropValue(row, prop.id) as string}
          onChange={(e) => updateCell(row.id, prop.id, e.target.value)}
          className="w-full bg-transparent border-none outline-none text-sm text-charcoal"
        />
      );
    }
    return (
      <input
        type={prop.type === 'number' ? 'number' : 'text'}
        value={getPropValue(row, prop.id) as string}
        onChange={(e) => updateCell(row.id, prop.id, e.target.value)}
        className="w-full bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-linen focus:bg-linen text-sm text-charcoal"
      />
    );
  };

  if (loading) return <div className="p-8 text-mid-gray">Loading database...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 bg-linen rounded-xl p-1 flex-wrap">
          {views.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                view === id ? 'bg-warm-white shadow-sm text-forest font-medium' : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowAddProp(true)} className="btn-secondary text-sm flex items-center gap-1">
            <Settings2 className="w-4 h-4" /> Add Property
          </button>
          <button type="button" onClick={addRow} className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> New Row
          </button>
        </div>
      </div>

      {view === 'list' && properties.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-mid-gray">Sort by:</span>
          <select
            value={listSortPropId || ''}
            onChange={(e) => setListSortPropId(e.target.value || null)}
            className="bg-linen rounded-lg px-2 py-1 border-none outline-none text-sm text-charcoal"
          >
            <option value="">Default order</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {view === 'table' && (
        <div className="overflow-x-auto card-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-mist">
                {properties.map((prop) => (
                  <th key={prop.id} className="text-left p-3 font-medium text-charcoal">{prop.name}</th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-green-mist/50 hover:bg-linen/50">
                  {properties.map((prop) => (
                    <td key={prop.id} className="p-2">{renderCell(row, prop)}</td>
                  ))}
                  <td className="p-2">
                    <button type="button" onClick={() => deleteRow(row.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'board' && statusProp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {JSON.parse(statusProp.options || '[]').map((status: string) => (
            <div key={status} className="card-surface p-3">
              <h3 className="font-medium text-sm text-charcoal mb-3">{status}</h3>
              <div className="space-y-2">
                {rows.filter((r) => getPropValue(r, statusProp.id) === status).map((row) => {
                  const nameProp = properties[0];
                  return (
                    <div key={row.id} className="bg-linen rounded-lg p-3 text-sm">
                      <div className="font-medium">{getPropValue(row, nameProp.id) || 'Untitled'}</div>
                      {properties.slice(1).filter((p) => p.id !== statusProp.id).map((p) => {
                        const val = getPropValue(row, p.id);
                        if (!val) return null;
                        return <div key={p.id} className="text-xs text-mid-gray mt-1">{p.name}: {String(val)}</div>;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'board' && !statusProp && (
        <p className="text-sm text-mid-gray">Add a Status select property to use Board view.</p>
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
                ? rows.filter((r) => getPropValue(r, dateProp.id) === cell.dateStr)
                : [];
              return (
                <div key={i} className="min-h-16 p-1 border border-green-mist/30 rounded-lg text-xs">
                  {cell.day && <span className="text-mid-gray">{cell.day}</span>}
                  {dayRows.map((row) => {
                    const nameProp = properties[0];
                    return (
                      <div key={row.id} className="bg-sage/30 rounded px-1 py-0.5 mt-0.5 truncate">
                        {getPropValue(row, nameProp.id) || 'Item'}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'calendar' && !dateProp && (
        <p className="text-sm text-mid-gray">Add a Due Date property to use Calendar view.</p>
      )}

      {view === 'list' && (
        <div className="space-y-2">
          {sortedListRows.map((row) => {
            const nameProp = properties[0];
            return (
              <div key={row.id} className="card-surface p-4 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{getPropValue(row, nameProp.id) || 'Untitled'}</span>
                <div className="flex flex-wrap gap-4 text-sm text-warm-gray">
                  {properties.slice(1).map((prop) => (
                    <span key={prop.id}>
                      <span className="text-mid-gray">{prop.name}:</span> {String(getPropValue(row, prop.id) || '—')}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <div className="text-center py-12 text-mid-gray">
          <p>No rows yet. Click &ldquo;New Row&rdquo; to get started.</p>
        </div>
      )}

      {showAddProp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowAddProp(false)}>
          <div className="card-surface w-full max-w-md p-6 rounded-t-2xl md:rounded-[14px] safe-bottom" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Add property</h3>
            <label className="block text-sm text-mid-gray mb-1">Name</label>
            <input
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              placeholder="e.g. Priority, Assignee"
              className="w-full px-3 py-2 rounded-lg border border-green-mist mb-3 outline-none focus:border-forest"
            />
            <label className="block text-sm text-mid-gray mb-1">Type</label>
            <select
              value={newPropType}
              onChange={(e) => setNewPropType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-green-mist mb-3 outline-none"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
            </select>
            {newPropType === 'select' && (
              <>
                <label className="block text-sm text-mid-gray mb-1">Options (comma-separated)</label>
                <input
                  value={newPropOptions}
                  onChange={(e) => setNewPropOptions(e.target.value)}
                  placeholder="High, Medium, Low"
                  className="w-full px-3 py-2 rounded-lg border border-green-mist mb-4 outline-none focus:border-forest"
                />
              </>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddProp(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="button" onClick={() => void addProperty()} className="btn-primary flex-1 text-sm">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
