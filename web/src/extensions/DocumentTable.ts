/**
 * Document-friendly TipTap table: keeps resize + Tab navigation, but does NOT
 * capture mouse drags as CellSelection. That lets users select continuously
 * through a table and content below it (quotes, invoices, etc.).
 */
import Table from '@tiptap/extension-table';
import { columnResizing, fixTables, goToNextCell, handlePaste } from '@tiptap/pm/tables';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { keymap } from '@tiptap/pm/keymap';

export const DocumentTable = Table.extend({
  addProseMirrorPlugins() {
    const plugins: Plugin[] = [];
    const isResizable = this.options.resizable && this.editor.isEditable;

    if (isResizable) {
      plugins.push(
        columnResizing({
          handleWidth: this.options.handleWidth,
          cellMinWidth: this.options.cellMinWidth,
          defaultCellMinWidth: this.options.cellMinWidth,
          View: this.options.View,
          lastColumnResizable: this.options.lastColumnResizable,
        }),
      );
    }

    // Intentionally skip stock `tableEditing()` — its mousedown handler and
    // `normalizeSelection` trap selection inside cells so drag-select cannot
    // include headings/lists below the table.
    plugins.push(
      new Plugin({
        key: new PluginKey('documentTableEditing'),
        appendTransaction(_transactions, oldState, state) {
          return fixTables(state, oldState) || null;
        },
        props: {
          handlePaste,
        },
      }),
    );

    plugins.push(
      keymap({
        Tab: goToNextCell(1),
        'Shift-Tab': goToNextCell(-1),
      }),
    );

    return plugins;
  },
});
