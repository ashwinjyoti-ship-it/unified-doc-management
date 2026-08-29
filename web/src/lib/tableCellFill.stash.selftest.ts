/**
 * Stash survives CellSelection collapse after Select row/column.
 * Run: npx tsx web/src/lib/tableCellFill.stash.selftest.ts
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { JSDOM } from 'jsdom';
import {
  applyCellFill,
  selectTableColumn,
  selectTableRow,
  clearStashedFillTargets,
} from './tableCellFill';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const dom = new JSDOM('<!DOCTYPE html><div id="ed"></div>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DocumentFragment: dom.window.DocumentFragment,
  Node: dom.window.Node,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
});

const bgAttr = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: () => null,
    renderHTML: (attrs: { backgroundColor?: string | null }) => (
      attrs.backgroundColor
        ? { style: `background-color: ${attrs.backgroundColor}` }
        : {}
    ),
  },
};
const TableCellWithFill = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...bgAttr };
  },
});
const TableHeaderWithFill = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...bgAttr };
  },
});

const editor = new Editor({
  element: document.querySelector('#ed')!,
  extensions: [StarterKit, Table, TableRow, TableHeaderWithFill, TableCellWithFill],
  content: `<table><tbody>
    <tr><th><p>Item</p></th><th><p>Qty</p></th></tr>
    <tr><td><p>A</p></td><td><p>1</p></td></tr>
    <tr><td><p>B</p></td><td><p>2</p></td></tr>
  </tbody></table>`,
});

function findPos(text: string): number {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if ((node.type.name === 'tableCell' || node.type.name === 'tableHeader') && node.textContent === text) {
      found = pos;
    }
  });
  if (found == null) throw new Error(`cell ${text} not found`);
  return found;
}

function bgOf(text: string): string | null {
  let bg: string | null = null;
  editor.state.doc.descendants((node) => {
    if ((node.type.name === 'tableCell' || node.type.name === 'tableHeader') && node.textContent === text) {
      bg = node.attrs.backgroundColor as string | null;
    }
  });
  return bg;
}

clearStashedFillTargets();
editor.commands.setTextSelection(findPos('1') + 2);
assert(selectTableColumn(editor as never), 'select column');
// Collapse selection (simulates toolbar focus race)
editor.commands.setTextSelection(findPos('1') + 2);
assert(applyCellFill(editor as never, '#E8DAEF'), 'fill after collapse');
assert(bgOf('Qty') === '#E8DAEF', `Qty fill: ${bgOf('Qty')}`);
assert(bgOf('1') === '#E8DAEF', `1 fill: ${bgOf('1')}`);
assert(bgOf('2') === '#E8DAEF', `2 fill: ${bgOf('2')}`);
assert(bgOf('A') == null, 'A not filled');

clearStashedFillTargets();
editor.commands.setTextSelection(findPos('A') + 2);
assert(selectTableRow(editor as never), 'select row');
editor.commands.setTextSelection(findPos('A') + 2);
assert(applyCellFill(editor as never, '#F7F0C8'), 'row fill after collapse');
assert(bgOf('A') === '#F7F0C8', 'A row fill');
assert(bgOf('1') === '#F7F0C8', '1 row fill (overwrote col)');

editor.destroy();
console.log('tableCellFill.stash.selftest: all passed');
