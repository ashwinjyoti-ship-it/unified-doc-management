/**
 * Apply / clear table cell fill colours, and select whole rows or columns.
 * Works with CellSelection, multi-cell text selections, or a caret inside a cell.
 */
import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Selection, Transaction } from '@tiptap/pm/state';
import { CellSelection, isInTable, selectionCell } from '@tiptap/pm/tables';

const CELL_TYPES = new Set(['tableCell', 'tableHeader']);

function normalizeFill(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** Duck-type CellSelection — avoids fragile instanceof across package copies. */
function isCellSelection(sel: Selection): sel is CellSelection {
  return (
    typeof (sel as CellSelection).forEachCell === 'function'
    && !!(sel as CellSelection).$anchorCell
  );
}

/** Collect table cell positions intersecting [from, to]. */
export function collectCellsInRange(
  doc: PMNode,
  from: number,
  to: number,
): Array<{ pos: number; node: PMNode }> {
  const cells: Array<{ pos: number; node: PMNode }> = [];
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);

  doc.nodesBetween(lo, hi, (node, pos) => {
    if (CELL_TYPES.has(node.type.name)) {
      cells.push({ pos, node });
      return false;
    }
    return true;
  });

  return cells;
}

function cellAtCursor(editor: Editor): { pos: number; node: PMNode } | null {
  if (!isInTable(editor.state)) return null;
  try {
    const $cell = selectionCell(editor.state);
    const node = $cell.nodeAfter;
    if (!node || !CELL_TYPES.has(node.type.name)) return null;
    return { pos: $cell.pos, node };
  } catch {
    return null;
  }
}

function collectFillTargets(editor: Editor): Array<{ pos: number; node: PMNode }> {
  const { state } = editor;
  const { selection } = state;

  if (isCellSelection(selection)) {
    const cells: Array<{ pos: number; node: PMNode }> = [];
    selection.forEachCell((node, pos) => {
      cells.push({ pos, node });
    });
    return cells;
  }

  const { from, to, empty } = selection;
  if (!empty && from !== to) {
    const ranged = collectCellsInRange(state.doc, from, to);
    if (ranged.length > 0) return ranged;
  }

  const cell = cellAtCursor(editor);
  return cell ? [cell] : [];
}

function applyFillToTargets(
  tr: Transaction,
  targets: Array<{ pos: number; node: PMNode }>,
  value: string | null,
): boolean {
  let changed = false;
  for (const { pos } of targets) {
    const current = tr.doc.nodeAt(pos);
    if (!current || !CELL_TYPES.has(current.type.name)) continue;
    if (current.attrs.backgroundColor === value) continue;
    tr.setNodeMarkup(pos, undefined, {
      ...current.attrs,
      backgroundColor: value,
    });
    changed = true;
  }
  return changed;
}

/** True when the selection is inside (or is) a table. */
export function selectionInTable(editor: Editor): boolean {
  return isInTable(editor.state) || editor.isActive('table');
}

/**
 * Active fill colour for the toolbar swatch highlight.
 * Empty string means no fill / mixed → show "None" as inactive unless all clear.
 */
export function getActiveCellFill(editor: Editor): string {
  const { state } = editor;
  const { selection } = state;

  if (isCellSelection(selection)) {
    let shared: string | null | undefined;
    let first = true;
    selection.forEachCell((node) => {
      const bg = (node.attrs.backgroundColor as string | null) || null;
      if (first) {
        shared = bg;
        first = false;
      } else if (shared !== bg) {
        shared = undefined;
      }
    });
    return shared || '';
  }

  const { from, to, empty } = selection;
  if (!empty && from !== to) {
    const cells = collectCellsInRange(state.doc, from, to);
    if (cells.length > 0) {
      const firstBg = (cells[0].node.attrs.backgroundColor as string | null) || null;
      const allSame = cells.every(
        (c) => ((c.node.attrs.backgroundColor as string | null) || null) === firstBg,
      );
      return allSame ? firstBg || '' : '';
    }
  }

  const cell = cellAtCursor(editor);
  if (cell) return (cell.node.attrs.backgroundColor as string | null) || '';
  return '';
}

/**
 * Apply (or clear) fill on every cell covered by the current selection.
 * Captures targets before any focus/dispatch so CellSelection is not lost.
 */
export function applyCellFill(editor: Editor, color: string): boolean {
  const value = normalizeFill(color);
  const targets = collectFillTargets(editor);
  if (targets.length === 0) return false;

  const { state } = editor;
  const hadCellSelection = isCellSelection(state.selection);
  const tr = state.tr;
  if (!applyFillToTargets(tr, targets, value)) return false;

  // Keep row/column CellSelection so the bubble toolbar stays useful.
  if (hadCellSelection) {
    try {
      tr.setSelection(state.selection.map(tr.doc, tr.mapping));
    } catch {
      /* selection map can fail after structural edits — attrs-only is fine */
    }
  }

  editor.view.dispatch(tr);
  return true;
}

/** Select the entire table row containing the caret / selection. */
export function selectTableRow(editor: Editor): boolean {
  if (!isInTable(editor.state)) return false;
  return editor
    .chain()
    .command(({ state, tr, dispatch }) => {
      try {
        const $cell = selectionCell(state);
        const rowSel = CellSelection.rowSelection($cell);
        if (dispatch) tr.setSelection(rowSel);
        return true;
      } catch {
        return false;
      }
    })
    .run();
}

/** Select the entire table column containing the caret / selection. */
export function selectTableColumn(editor: Editor): boolean {
  if (!isInTable(editor.state)) return false;
  return editor
    .chain()
    .command(({ state, tr, dispatch }) => {
      try {
        const $cell = selectionCell(state);
        const colSel = CellSelection.colSelection($cell);
        if (dispatch) tr.setSelection(colSel);
        return true;
      } catch {
        return false;
      }
    })
    .run();
}
