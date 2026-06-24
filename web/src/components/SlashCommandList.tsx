import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Minus, Code, ImageIcon, FileText, Table2, Database, MessageSquare, Square,
} from 'lucide-react';
import type { FunctionalSlashKey } from '../lib/slashInsert';

export type SlashCommandPlacement = 'format' | 'functional';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  placement: SlashCommandPlacement;
  /** Set for functional commands — handled via placement modal */
  key?: FunctionalSlashKey;
  command?: (props: {
    editor: import('@tiptap/react').Editor;
    range: { from: number; to: number };
  }) => void;
}

export function sortSlashCommands(items: SlashCommandItem[]): SlashCommandItem[] {
  return [
    ...items.filter((i) => i.placement === 'format'),
    ...items.filter((i) => i.placement === 'functional'),
  ];
}

export function groupSlashCommands(items: SlashCommandItem[]) {
  const sorted = sortSlashCommands(items);
  return {
    sorted,
    format: sorted.filter((i) => i.placement === 'format'),
    functional: sorted.filter((i) => i.placement === 'functional'),
  };
}

export const slashCommands: SlashCommandItem[] = [
  // —— Format ——
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: <List className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: <ListOrdered className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Block quote',
    icon: <Quote className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'blockquote',
          content: [{ type: 'paragraph' }],
        })
        .run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: <Minus className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: <Code className="w-4 h-4" />,
    placement: 'format',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  // —— Functional ——
  {
    title: 'To-do Item',
    description: 'Single checkbox task',
    icon: <Square className="w-4 h-4" />,
    placement: 'functional',
    key: 'todo-item',
  },
  {
    title: 'To-do List',
    description: 'Task list with checkboxes',
    icon: <CheckSquare className="w-4 h-4" />,
    placement: 'functional',
    key: 'todo-list',
  },
  {
    title: 'Table',
    description: 'Insert a 3×3 table',
    icon: <Table2 className="w-4 h-4" />,
    placement: 'functional',
    key: 'table',
  },
  {
    title: 'Message',
    description: 'Callout or note',
    icon: <MessageSquare className="w-4 h-4" />,
    placement: 'functional',
    key: 'message',
  },
  {
    title: 'Image',
    description: 'Insert image from URL or upload',
    icon: <ImageIcon className="w-4 h-4" />,
    placement: 'functional',
    key: 'image',
  },
  {
    title: 'New Database',
    description: 'Spreadsheet-style database',
    icon: <Database className="w-4 h-4" />,
    placement: 'functional',
    key: 'database',
  },
  {
    title: 'Page Link',
    description: 'Link to another page',
    icon: <FileText className="w-4 h-4" />,
    placement: 'functional',
    key: 'page-link',
  },
];

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

function SlashCommandRow({
  item,
  selected,
  onSelect,
}: {
  item: SlashCommandItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-left text-sm transition-colors ${
        selected ? 'bg-sage/30 text-forest' : 'hover:bg-linen active:bg-sage/20 text-charcoal'
      }`}
    >
      <span className="text-mid-gray">{item.icon}</span>
      <div>
        <div className="font-medium">{item.title}</div>
        <div className="text-xs text-mid-gray">{item.description}</div>
      </div>
    </button>
  );
}

function SlashCommandSectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold text-mid-gray uppercase tracking-wider bg-linen/60 border-b border-green-mist/50 sticky top-0 z-10">
      {label}
    </div>
  );
}

/** Grouped slash menu — used by popup and mobile Insert sheet */
export function SlashCommandMenu({
  items,
  selectedIndex,
  onSelect,
}: {
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
}) {
  const { format, functional } = groupSlashCommands(items);
  let index = 0;

  return (
    <>
      {format.length > 0 && (
        <>
          <SlashCommandSectionHeader label="Format" />
          {format.map((item) => {
            const rowIndex = index++;
            return (
              <SlashCommandRow
                key={item.title}
                item={item}
                selected={rowIndex === selectedIndex}
                onSelect={() => onSelect(item)}
              />
            );
          })}
        </>
      )}
      {functional.length > 0 && (
        <>
          <SlashCommandSectionHeader label="Functional" />
          {functional.map((item) => {
            const rowIndex = index++;
            return (
              <SlashCommandRow
                key={item.title}
                item={item}
                selected={rowIndex === selectedIndex}
                onSelect={() => onSelect(item)}
              />
            );
          })}
        </>
      )}
    </>
  );
}

const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-warm-white rounded-xl shadow-lg border border-green-mist p-3 text-sm text-mid-gray">
          No results
        </div>
      );
    }

    return (
      <div className="bg-warm-white rounded-xl shadow-lg border border-green-mist overflow-hidden min-w-[min(100vw-2rem,280px)] max-h-[min(50vh,360px)] overflow-y-auto overscroll-contain">
        <SlashCommandMenu
          items={items}
          selectedIndex={selectedIndex}
          onSelect={command}
        />
      </div>
    );
  },
);

SlashCommandList.displayName = 'SlashCommandList';
export default SlashCommandList;
