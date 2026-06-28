import { memo } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Pilcrow, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, CheckSquare, Quote, Minus, ImageIcon, Link2, Upload,
} from 'lucide-react';

function ToolbarButton({
  onClick,
  active,
  title,
  children,
  bubble = false,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: ReactNode;
  bubble?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${
        bubble
          ? active
            ? 'bg-sage/40 text-forest'
            : 'hover:bg-linen text-charcoal'
          : active
            ? 'bg-sage/40 text-forest'
            : 'hover:bg-linen text-charcoal'
      }`}
    >
      {children}
    </button>
  );
}

interface EditorToolbarProps {
  editor: Editor;
  onAddImage: () => void;
  onUploadClick: () => void;
  onAddLink: () => void;
  /** Light floating bar shown on text selection */
  variant?: 'bubble';
}

function EditorToolbar({
  editor,
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
      h4: ed.isActive('heading', { level: 4 }),
      paragraph: ed.isActive('paragraph'),
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
    <div className="flex flex-wrap gap-0.5 items-center bg-warm-white rounded-xl shadow-lg border border-green-mist p-1.5 max-w-[min(100vw-2rem,640px)]">
      <ToolbarButton bubble title="Bold (Ctrl+B)" active={active.bold} onClick={() => run(() => editor.chain().focus().toggleBold().run())}>
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Italic (Ctrl+I)" active={active.italic} onClick={() => run(() => editor.chain().focus().toggleItalic().run())}>
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Strikethrough" active={active.strike} onClick={() => run(() => editor.chain().focus().toggleStrike().run())}>
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Inline code" active={active.code} onClick={() => run(() => editor.chain().focus().toggleCode().run())}>
        <Code className="w-4 h-4" />
      </ToolbarButton>
      <div className="w-px h-5 bg-green-mist/60 mx-0.5" />
      <ToolbarButton bubble title="Normal text — clears heading/quote formatting" active={active.paragraph} onClick={() => run(() => editor.chain().focus().setParagraph().run())}>
        <Pilcrow className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Heading 1" active={active.h1} onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}>
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Heading 2" active={active.h2} onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}>
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Heading 3" active={active.h3} onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}>
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Heading 4" active={active.h4} onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 4 }).run())}>
        <Heading4 className="w-4 h-4" />
      </ToolbarButton>
      <div className="w-px h-5 bg-green-mist/60 mx-0.5" />
      <ToolbarButton bubble title="Bullet list" active={active.bulletList} onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}>
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Numbered list" active={active.orderedList} onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}>
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="To-do checklist" active={active.taskList} onClick={() => run(() => editor.chain().focus().toggleTaskList().run())}>
        <CheckSquare className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        bubble
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
      <ToolbarButton bubble title="Horizontal divider" onClick={() => run(() => editor.chain().focus().setHorizontalRule().run())}>
        <Minus className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Code block" active={active.codeBlock} onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())}>
        <Code className="w-4 h-4" />
      </ToolbarButton>
      <div className="w-px h-5 bg-green-mist/60 mx-0.5" />
      <ToolbarButton bubble title="Insert image" active={active.image} onClick={onAddImage}>
        <ImageIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Upload file" onClick={onUploadClick}>
        <Upload className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton bubble title="Insert hyperlink" active={active.link} onClick={onAddLink}>
        <Link2 className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );
}

export default memo(EditorToolbar);
