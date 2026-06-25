import type { Page } from '../types';
import { setEditorSeed } from './editorSeed';

export type FunctionalSlashKey =
  | 'todo-item'
  | 'todo-list'
  | 'table'
  | 'message'
  | 'image'
  | 'database'
  | 'page-link';

/** Parent folder for new pages — same project as the current page. */
export function resolveInsertParentId(pageId: string | undefined, pages: Page[]): string | undefined {
  if (!pageId) return undefined;
  const current = pages.find((p) => p.id === pageId);
  if (!current) return undefined;
  if (current.type === 'folder') return current.id;
  return current.parent_id ?? undefined;
}

export function defaultTitleFor(key: FunctionalSlashKey): string {
  const titles: Record<FunctionalSlashKey, string> = {
    'todo-item': 'To-do',
    'todo-list': 'Tasks',
    table: 'Table',
    message: 'Message',
    image: 'Image note',
    database: 'New Database',
    'page-link': 'Untitled',
  };
  return titles[key];
}

export function defaultIconFor(key: FunctionalSlashKey): string {
  const icons: Record<FunctionalSlashKey, string> = {
    'todo-item': '✅',
    'todo-list': '✅',
    table: '📊',
    message: '💬',
    image: '🖼️',
    database: '🗃️',
    'page-link': '📄',
  };
  return icons[key];
}

export function seedBlocksFor(key: FunctionalSlashKey): Array<{ type: string; content: object; orderIndex: number }> {
  switch (key) {
    case 'todo-item':
    case 'todo-list':
      return [{ type: 'todo', content: { text: '', checked: false }, orderIndex: 0 }];
    case 'message':
      return [{ type: 'quote', content: { text: '💬 ' }, orderIndex: 0 }];
    case 'table':
      return [{ type: 'paragraph', content: { text: '' }, orderIndex: 0 }];
    case 'image':
      return [{ type: 'paragraph', content: { text: '' }, orderIndex: 0 }];
    case 'page-link':
      return [{ type: 'paragraph', content: { text: '' }, orderIndex: 0 }];
    default:
      return [{ type: 'paragraph', content: { text: '' }, orderIndex: 0 }];
  }
}

const TABLE_SEED_HTML = `
<table>
  <tbody>
    <tr><th></th><th></th><th></th></tr>
    <tr><td></td><td></td><td></td></tr>
    <tr><td></td><td></td><td></td></tr>
  </tbody>
</table>
<p></p>
`.trim();

export function applyNewPageSeed(key: FunctionalSlashKey, pageId: string) {
  if (key === 'table') {
    setEditorSeed(pageId, TABLE_SEED_HTML);
  }
}

type Editor = import('@tiptap/react').Editor;

export function runInlineFunctional(
  key: FunctionalSlashKey,
  editor: Editor,
  range: { from: number; to: number },
  handlers: {
    openPageLinkPicker: () => void;
    openImagePicker: () => void;
    onDatabaseLink: (title: string) => void;
  },
) {
  switch (key) {
    case 'todo-item':
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'taskList',
          content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
        })
        .run();
      break;
    case 'todo-list':
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
      break;
    case 'table':
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
    case 'message':
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '💬 ' }] }],
        })
        .run();
      break;
    case 'image':
      editor.chain().focus().deleteRange(range).run();
      handlers.openImagePicker();
      break;
    case 'database':
      handlers.onDatabaseLink('New Database');
      break;
    case 'page-link':
      editor.chain().focus().deleteRange(range).run();
      handlers.openPageLinkPicker();
      break;
  }
}
