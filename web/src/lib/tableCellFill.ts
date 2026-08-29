/**
 * Apply / clear table cell fill colours, and select whole rows or columns.
 * Works with CellSelection, multi-cell text selections, or a caret inside a cell.
 */
import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { CellSelection, isInTable, selectionCell } from '@tiptap/pm/tables';
import { TextSelection } from '@tiptap/pm/state';

const CELL_TYPES = new Set(['tableCell', 'tableHeader']);

function normalizeFill(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  // Accept hex; rgb() from DOM parse is kept as-is for round-trip via data-background-color
  return trimmed;
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

  if (selection instanceof CellSelection) {
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

/** Apply (or clear) fill on every cell covered by the current selection. */
export function applyCellFill(editor: Editor, color: string): boolean {
  const value = normalizeFill(color);
  const { state } = editor;
  const { selection } = state;

  if (selection instanceof CellSelection) {
    return editor.chain().focus().setCellAttribute('backgroundColor', value).run();
  }

  const { from, to, empty } = selection;
  let targets = !empty && from !== to
    ? collectCellsInRange(state.doc, from, to)
    : [];

  if (targets.length === 0) {
    const cell = cellAtCursor(editor);
    if (cell) targets = [cell];
  }

  if (targets.length === 0) return false;

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      let changed = false;
      for (const { pos, node } of targets) {
        if (node.attrs.backgroundColor === value) continue;
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          backgroundColor: value,
        });
        changed = true;
      }
      if (changed && dispatch) dispatch(tr);
      return changed;
    })
    .run();
}

/** Select the entire table row containing the caret / selection. */
export function selectTableRow(editor: Editor): boolean {
  if (!isInTable(editor.state)) return false;
  try {
    const $cell = selectionCell(editor.state);
    const rowSel = CellSelection.rowSelection($cell);
    return editor
      .chain()
      .focus()
      .command(({ tr, dispatch }) => {
        if (dispatch) tr.setSelection(rowSel);
        return true;
      })
      .run();
  } catch {
    return false;
  }
}

/** Select the entire table column containing the caret / selection. */
export function selectTableColumn(editor: Editor): boolean {
  if (!isInTable(editor.state)) return false;
  try {
    const $cell = selectionCell(editor.state);
    const colSel = CellSelection.colSelection($cell);
    return editor
      .chain()
      .focus()
      .command(({ tr, dispatch }) => {
        if (dispatch) tr.setSelection(colSel);
        return true;
      })
      .run();
  } catch {
    return false;
  }
}
