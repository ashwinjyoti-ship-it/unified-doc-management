import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Minus, Code, ImageIcon, FileText,
} from 'lucide-react';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: import('@tiptap/react').Editor; range: { from: number; to: number } }) => void;
}

export function createPageLinkCommand(
  onRequest: (props: { editor: import('@tiptap/react').Editor; range: { from: number; to: number } }) => void,
): SlashCommandItem {
  return {
    title: 'Page Link',
    description: 'Link to another page ([[Page Title]])',
    icon: <FileText className="w-4 h-4" />,
    command: onRequest,
  };
}

export const slashCommands: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: <List className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: <ListOrdered className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'To-do List',
    description: 'Task list with checkboxes',
    icon: <CheckSquare className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Quote',
    description: 'Block quote',
    icon: <Quote className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: <Minus className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: <Code className="w-4 h-4" />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Image',
    description: 'Insert image from URL or upload',
    icon: <ImageIcon className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const url = window.prompt('Image URL:');
      if (url) editor.chain().focus().setImage({ src: url }).run();
    },
  },
];

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
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
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => command(item)}
            className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-left text-sm transition-colors ${
              index === selectedIndex ? 'bg-sage/30 text-forest' : 'hover:bg-linen active:bg-sage/20 text-charcoal'
            }`}
          >
            <span className="text-mid-gray">{item.icon}</span>
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-mid-gray">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

SlashCommandList.displayName = 'SlashCommandList';
export default SlashCommandList;
