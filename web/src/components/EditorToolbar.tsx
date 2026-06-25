import { memo } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, ImageIcon, Link2, Upload, Slash,
} from 'lucide-react';

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${active ? 'bg-sage/40 text-forest' : 'hover:bg-linen text-charcoal'}`}
    >
      {children}
    </button>
  );
}

interface EditorToolbarProps {
  editor: Editor;
  onInsertOpen: () => void;
  onAddImage: () => void;
  onUploadClick: () => void;
  onAddLink: () => void;
}

function EditorToolbar({
  editor,
  onInsertOpen,
  onAddImage,
  onUploadClick,
  onAddLink,
}: EditorToolbarProps) {
  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive('bold'),
      italic: ed.isActive('italic'),
      strike: ed.isActive('strike'),
      code: ed.isActive('code'),
      h1: ed.isActive('heading', { level: 1 }),
      h2: ed.isActive('heading', { level: 2 }),
      h3: ed.isActive('heading', { level: 3 }),
      bulletList: ed.isActive('bulletList'),
      orderedList: ed.isActive('orderedList'),
      taskList: ed.isActive('taskList'),
      blockquote: ed.isActive('blockquote'),
      codeBlock: ed.isActive('codeBlock'),
      link: ed.isActive('link'),
      image: ed.isActive('image'),
    }),
  });

  const run = (command: () => boolean) => {
    command();
  };

  return (
    <div className="mb-4 p-2 bg-linen/50 rounded-xl md:sticky md:top-0 md:z-10">
      <div className="flex gap-1 md:hidden">
        <button
          type="button"
          title="Insert block — headings, lists, images"
          onClick={onInsertOpen}
          className="p-2 rounded-md bg-forest text-white hover:bg-dark-teal flex items-center gap-1 text-xs font-medium"
        >
          <Slash className="w-4 h-4" />
          Insert
        </button>
        <ToolbarButton title="Bold" active={active.bold} onClick={() => run(() => editor.chain().focus().toggleBold().run())}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={active.italic} onClick={() => run(() => editor.chain().focus().toggleItalic().run())}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <div className="hidden md:flex flex-wrap gap-1">
        <ToolbarButton title="Bold (Ctrl+B)" active={active.bold} onClick={() => run(() => editor.chain().focus().toggleBold().run())}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Italic (Ctrl+I)" active={active.italic} onClick={() => run(() => editor.chain().focus().toggleItalic().run())}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={active.strike} onClick={() => run(() => editor.chain().focus().toggleStrike().run())}>
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Inline code" active={active.code} onClick={() => run(() => editor.chain().focus().toggleCode().run())}>
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px bg-green-mist mx-1" />
        <ToolbarButton title="Heading 1" active={active.h1} onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}>
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Heading 2" active={active.h2} onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}>
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" active={active.h3} onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}>
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px bg-green-mist mx-1" />
        <ToolbarButton title="Bullet list" active={active.bulletList} onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}>
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={active.orderedList} onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}>
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="To-do checklist" active={active.taskList} onClick={() => run(() => editor.chain().focus().toggleTaskList().run())}>
          <CheckSquare className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Block quote"
          active={active.blockquote}
          onClick={() => run(() => (
            active.blockquote
              ? editor.chain().focus().lift('blockquote').run()
              : editor.chain().focus().setBlockquote().run()
          ))}
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Horizontal divider" onClick={() => run(() => editor.chain().focus().setHorizontalRule().run())}>
          <Minus className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Code block" active={active.codeBlock} onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())}>
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px bg-green-mist mx-1" />
        <ToolbarButton title="Insert image" active={active.image} onClick={onAddImage}>
          <ImageIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Upload file" onClick={onUploadClick}>
          <Upload className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Insert hyperlink" active={active.link} onClick={onAddLink}>
          <Link2 className="w-4 h-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

export default memo(EditorToolbar);
