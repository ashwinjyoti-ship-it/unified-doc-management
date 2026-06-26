import { useCallback, useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { createPageIdResolver } from '../lib/pageLinks';
import { useStore } from '../lib/store';
import BlockEditor, { blocksToTiptapHtml, tiptapJsonToBlocks } from './BlockEditor';
import DatabaseTextCell from './DatabaseTextCell';
import RelationPicker from './RelationPicker';
import Tooltip from './Tooltip';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import type { DatabaseProperty, DatabaseRow } from '../types';
import {
  getPropValue,
  getRowTitle,
  parseCheckboxValue,
  parseMultiSelectValue,
  parseRelationValue,
} from '../lib/databaseFilters';

interface DatabaseRowPanelProps {
  pageId: string;
  row: DatabaseRow;
  properties: DatabaseProperty[];
  relationData: Record<string, Array<{ id: string; page_id: string | null; title: string }>>;
  rollupValues: Record<string, string | number>;
  nameProp: DatabaseProperty | undefined;
  onClose: () => void;
  onPersistCell: (rowId: string, propId: string, value: unknown) => void;
  onRowUpdated: (row: DatabaseRow) => void;
  onPropertiesChange: () => void;
}

export default function DatabaseRowPanel({
  pageId,
  row,
  properties,
  relationData,
  rollupValues,
  nameProp,
  onClose,
  onPersistCell,
  onRowUpdated,
  onPropertiesChange,
}: DatabaseRowPanelProps) {
  const pages = useStore((s) => s.pages);
  const [editorContent, setEditorContent] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [showAddProp, setShowAddProp] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('text');

  useEffect(() => {
    if (!row.page_id) return;
    setNotesLoading(true);
    api.getPage(row.page_id)
      .then((data) => setEditorContent(blocksToTiptapHtml(data.blocks, createPageIdResolver(pages))))
      .catch(() => setEditorContent(''))
      .finally(() => setNotesLoading(false));
  }, [row.page_id, pages]);

  const saveNotes = useCallback(async (_html: string, json: object) => {
    if (!row.page_id) return;
    const blockData = tiptapJsonToBlocks(json as Record<string, unknown>).map((b, i) => ({
      ...b,
      orderIndex: i,
    }));
    await api.saveBlocks(row.page_id, blockData);
  }, [row.page_id]);

  const debouncedSaveNotes = useDebouncedCallback(saveNotes, 500);

  const addProperty = async () => {
    if (!newPropName.trim()) return;
    await api.createDatabaseProperty(pageId, { name: newPropName.trim(), type: newPropType });
    setNewPropName('');
    setNewPropType('text');
    setShowAddProp(false);
    onPropertiesChange();
  };

  const renderField = (prop: DatabaseProperty) => {
    if (prop.type === 'rollup') {
      return (
        <span className="text-sm text-charcoal bg-linen/50 px-2 py-1 rounded">
          {String(rollupValues[prop.id] ?? '—')}
        </span>
      );
    }
    if (prop.type === 'relation') {
      return (
        <RelationPicker
          options={relationData[prop.id] || []}
          selected={parseRelationValue(getPropValue(row, prop.id))}
          onChange={(vals) => onPersistCell(row.id, prop.id, vals)}
        />
      );
    }
    if (prop.type === 'select') {
      return (
        <select
          value={String(getPropValue(row, prop.id) ?? '')}
          onChange={(e) => onPersistCell(row.id, prop.id, e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm text-charcoal"
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
        <div className="flex flex-wrap gap-1">
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
                  onPersistCell(row.id, prop.id, [...next]);
                }}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  on ? 'bg-forest text-white border-forest' : 'bg-linen text-warm-gray border-green-mist'
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
          onChange={(e) => onPersistCell(row.id, prop.id, e.target.checked)}
          className="w-4 h-4 accent-forest"
        />
      );
    }
    if (prop.type === 'date') {
      return (
        <input
          type="date"
          value={String(getPropValue(row, prop.id) ?? '')}
          onChange={(e) => onPersistCell(row.id, prop.id, e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm text-charcoal db-cell-input"
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
          onPersist={onPersistCell}
          className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm text-charcoal db-cell-input"
        />
      );
    }
    return (
      <DatabaseTextCell
        rowId={row.id}
        propId={prop.id}
        value={String(getPropValue(row, prop.id) ?? '')}
        type={prop.type === 'number' ? 'number' : 'text'}
        onPersist={onPersistCell}
        className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm text-charcoal db-cell-input"
      />
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[120]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[130] w-full max-w-lg bg-warm-white shadow-2xl flex flex-col safe-bottom md:rounded-l-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-mist shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-charcoal truncate">{getRowTitle(row, nameProp)}</h2>
            <p className="text-xs text-mid-gray truncate">Row ID: {row.id}</p>
          </div>
          <Tooltip text="Close row detail panel">
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-linen shrink-0">
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {properties.map((prop) => (
            <div key={prop.id}>
              <label className="block text-xs font-medium text-mid-gray mb-1">{prop.name}</label>
              {renderField(prop)}
            </div>
          ))}

          {showAddProp ? (
            <div className="card-surface p-3 space-y-2">
              <input
                value={newPropName}
                onChange={(e) => setNewPropName(e.target.value)}
                placeholder="Property name"
                className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm db-cell-input"
              />
              <select
                value={newPropType}
                onChange={(e) => setNewPropType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm"
              >
                <option value="text">Text</option>
                <option value="long_text">Long text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Select</option>
                <option value="multi_select">Multi-select</option>
                <option value="checkbox">Checkbox</option>
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddProp(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button type="button" onClick={() => void addProperty()} className="btn-primary flex-1 text-sm">Add</button>
              </div>
            </div>
          ) : (
            <Tooltip text="Add a new column to this database">
              <button type="button" onClick={() => setShowAddProp(true)} className="btn-secondary text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add property
              </button>
            </Tooltip>
          )}

          {row.page_id && (
            <div>
              <h3 className="text-sm font-medium text-charcoal mb-2">Notes</h3>
              {notesLoading ? (
                <p className="text-sm text-mid-gray">Loading notes…</p>
              ) : (
                <BlockEditor
                  key={row.page_id}
                  initialContent={editorContent}
                  onChange={debouncedSaveNotes}
                  pageId={row.page_id}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
