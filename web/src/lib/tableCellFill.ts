/**
 * Apply / clear table cell fill colours, and select whole rows or columns.
 * Works with CellSelection, multi-cell text selections, or a caret inside a cell.
 *
 * Select row/column stashes target positions so Fill still works if the
 * CellSelection is collapsed by focus/toolbar interaction before the swatch click.
 */
import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Selection, Transaction } from '@tiptap/pm/state';
import { CellSelection, isInTable, selectionCell } from '@tiptap/pm/tables';

const CELL_TYPES = new Set(['tableCell', 'tableHeader']);

/** Positions from the last Select row / Select column (survives selection collapse). */
let stashedFillPositions: number[] | null = null;

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

function cellsFromCellSelection(selection: CellSelection): Array<{ pos: number; node: PMNode }> {
  const cells: Array<{ pos: number; node: PMNode }> = [];
  selection.forEachCell((node, pos) => {
    cells.push({ pos, node });
  });
  return cells;
}

function resolveStashedTargets(doc: PMNode): Array<{ pos: number; node: PMNode }> {
  if (!stashedFillPositions?.length) return [];
  const cells: Array<{ pos: number; node: PMNode }> = [];
  for (const pos of stashedFillPositions) {
    const node = doc.nodeAt(pos);
    if (node && CELL_TYPES.has(node.type.name)) cells.push({ pos, node });
  }
  return cells;
}

function collectFillTargets(editor: Editor): Array<{ pos: number; node: PMNode }> {
  const { state } = editor;
  const { selection } = state;

  if (isCellSelection(selection)) {
    return cellsFromCellSelection(selection);
  }

  const { from, to, empty } = selection;
  if (!empty && from !== to) {
    const ranged = collectCellsInRange(state.doc, from, to);
    if (ranged.length > 0) return ranged;
  }

  // Prefer a prior Select row/column stash over a collapsed single-cell caret.
  const stashed = resolveStashedTargets(state.doc);
  if (stashed.length > 1) return stashed;

  const cell = cellAtCursor(editor);
  if (cell) return [cell];
  return stashed;
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

function stashFromCellSelection(selection: CellSelection) {
  const positions: number[] = [];
  selection.forEachCell((_node, pos) => {
    positions.push(pos);
  });
  stashedFillPositions = positions.length ? positions : null;
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
  const targets = collectFillTargets(editor);
  if (targets.length === 0) return '';
  const firstBg = (targets[0].node.attrs.backgroundColor as string | null) || null;
  const allSame = targets.every(
    (c) => ((c.node.attrs.backgroundColor as string | null) || null) === firstBg,
  );
  return allSame ? firstBg || '' : '';
}

/**
 * Apply (or clear) fill on every cell covered by the current selection
 * (or the last Select row / Select column stash).
 */
export function applyCellFill(editor: Editor, color: string): boolean {
  const value = normalizeFill(color);
  const targets = collectFillTargets(editor);
  if (targets.length === 0) return false;

  const { state } = editor;
  const hadCellSelection = isCellSelection(state.selection);
  const tr = state.tr;
  if (!applyFillToTargets(tr, targets, value)) {
    stashedFillPositions = null;
    return false;
  }

  if (hadCellSelection) {
    try {
      tr.setSelection(state.selection.map(tr.doc, tr.mapping));
    } catch {
      /* attrs-only edits keep positions stable */
    }
  }

  editor.view.dispatch(tr);
  stashedFillPositions = null;
  return true;
}

/** Select the entire table row containing the caret / selection. */
export function selectTableRow(editor: Editor): boolean {
  if (!isInTable(editor.state)) return false;
  try {
    const $cell = selectionCell(editor.state);
    const rowSel = CellSelection.rowSelection($cell);
    stashFromCellSelection(rowSel);
    editor.view.dispatch(editor.state.tr.setSelection(rowSel));
    return true;
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
    stashFromCellSelection(colSel);
    editor.view.dispatch(editor.state.tr.setSelection(colSel));
    return true;
  } catch {
    return false;
  }
}

/** Test helper — clear stashed row/column targets. */
export function clearStashedFillTargets() {
  stashedFillPositions = null;
}
