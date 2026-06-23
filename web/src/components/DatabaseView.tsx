import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { DatabaseProperty, DatabaseRow } from '../types';
import { Plus, Table, LayoutGrid, Calendar, List, Trash2 } from 'lucide-react';

type ViewType = 'table' | 'board' | 'calendar' | 'list';

interface DatabaseViewProps {
  pageId: string;
}

export default function DatabaseView({ pageId }: DatabaseViewProps) {
  const [properties, setProperties] = useState<DatabaseProperty[]>([]);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [view, setView] = useState<ViewType>('table');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatabase();
  }, [pageId]);

  const loadDatabase = async () => {
    setLoading(true);
    try {
      const data = await api.getDatabase(pageId);
      setProperties(data.properties);
      setRows(data.rows);
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

  const getPropValue = (row: DatabaseRow, propId: string) => {
    const props = JSON.parse(row.properties || '{}');
    return props[propId] ?? '';
  };

  const statusProp = properties.find((p) => p.type === 'select');
  const dateProp = properties.find((p) => p.type === 'date');

  const views = [
    { id: 'table' as const, icon: Table, label: 'Table' },
    { id: 'board' as const, icon: LayoutGrid, label: 'Board' },
    { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
    { id: 'list' as const, icon: List, label: 'List' },
  ];

  if (loading) return <div className="p-8 text-mid-gray">Loading database...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-linen rounded-xl p-1">
          {views.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                view === id ? 'bg-white shadow-sm text-forest font-medium' : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <button onClick={addRow} className="btn-primary text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> New Row
        </button>
      </div>

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
                    <td key={prop.id} className="p-2">
                      {prop.type === 'select' ? (
                        <select
                          value={getPropValue(row, prop.id) as string}
                          onChange={(e) => updateCell(row.id, prop.id, e.target.value)}
                          className="w-full bg-transparent border-none outline-none"
                        >
                          <option value="">—</option>
                          {JSON.parse(prop.options || '[]').map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : prop.type === 'date' ? (
                        <input
                          type="date"
                          value={getPropValue(row, prop.id) as string}
                          onChange={(e) => updateCell(row.id, prop.id, e.target.value)}
                          className="w-full bg-transparent border-none outline-none"
                        />
                      ) : (
                        <input
                          type={prop.type === 'number' ? 'number' : 'text'}
                          value={getPropValue(row, prop.id) as string}
                          onChange={(e) => updateCell(row.id, prop.id, e.target.value)}
                          className="w-full bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-linen focus:bg-linen"
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2">
                    <button onClick={() => deleteRow(row.id)} className="text-red-400 hover:text-red-600">
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
                      {getPropValue(row, nameProp.id) || 'Untitled'}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'calendar' && dateProp && (
        <div className="card-surface p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-mid-gray mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => {
              const day = i - 2;
              const dateStr = day > 0 && day <= 30 ? `2026-06-${String(day).padStart(2, '0')}` : '';
              const dayRows = rows.filter((r) => getPropValue(r, dateProp.id) === dateStr);
              return (
                <div key={i} className="min-h-16 p-1 border border-green-mist/30 rounded-lg text-xs">
                  {day > 0 && day <= 30 && <span className="text-mid-gray">{day}</span>}
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

      {view === 'list' && (
        <div className="space-y-2">
          {rows.map((row) => {
            const nameProp = properties[0];
            return (
              <div key={row.id} className="card-surface p-4 flex items-center justify-between">
                <span className="font-medium">{getPropValue(row, nameProp.id) || 'Untitled'}</span>
                <div className="flex gap-4 text-sm text-warm-gray">
                  {properties.slice(1).map((prop) => (
                    <span key={prop.id}>{getPropValue(row, prop.id) || '—'}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <div className="text-center py-12 text-mid-gray">
          <p>No rows yet. Click "New Row" to get started.</p>
        </div>
      )}
    </div>
  );
}
