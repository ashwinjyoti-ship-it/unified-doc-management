import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useEffect, useCallback, useRef } from 'react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, ImageIcon, Link2, Upload,
} from 'lucide-react';
import { SlashCommands } from './SlashCommands';
import { api } from '../lib/api';

const lowlight = createLowlight(common);

interface BlockEditorProps {
  content: string;
  onChange: (html: string, json: object) => void;
  editable?: boolean;
}

export default function BlockEditor({ content, onChange, editable = true }: BlockEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const result = await api.uploadFile(file);
    return result.url;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Type / for commands, or start writing...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      CodeBlockLowlight.configure({ lowlight }),
      SlashCommands.configure({ onImageUpload: uploadImage }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const addImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      console.error('Upload failed:', err);
      const url = window.prompt('Upload failed. Enter image URL instead:');
      if (url) editor.chain().focus().setImage({ src: url }).run();
    }
    e.target.value = '';
  }, [editor, uploadImage]);

  const addLink = useCallback(() => {
    const url = window.prompt('Link URL:');
    if (url && editor) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${active ? 'bg-sage/40 text-forest' : 'hover:bg-linen text-charcoal'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt,.md"
        className="hidden"
        onChange={handleFileSelect}
      />
      {editable && (
        <div className="flex flex-wrap gap-1 mb-4 p-2 bg-linen/50 rounded-xl sticky top-0 z-10">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px bg-green-mist mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px bg-green-mist mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')}>
            <CheckSquare className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px bg-green-mist mx-1" />
          <ToolbarButton onClick={addImage} active={editor.isActive('image')}>
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Upload file">
            <Upload className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={addLink} active={editor.isActive('link')}>
            <Link2 className="w-4 h-4" />
          </ToolbarButton>
        </div>
      )}

      {editable && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex gap-1 bg-charcoal rounded-lg p-1 shadow-lg">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
              <Bold className="w-4 h-4 text-white" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
              <Italic className="w-4 h-4 text-white" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
              <Strikethrough className="w-4 h-4 text-white" />
            </ToolbarButton>
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="prose-forest max-w-none" />
    </div>
  );
}

export function tiptapJsonToBlocks(json: Record<string, unknown>): Array<{ type: string; content: object; orderIndex: number }> {
  const blocks: Array<{ type: string; content: object; orderIndex: number }> = [];
  const content = (json.content as Array<Record<string, unknown>>) || [];
  let index = 0;

  for (const node of content) {
    const type = mapNodeType(node.type as string);
    blocks.push({ type, content: extractContent(node), orderIndex: index++ });
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: { text: '' }, orderIndex: 0 });
  }

  return blocks;
}

function mapNodeType(type: string): string {
  const map: Record<string, string> = {
    paragraph: 'paragraph',
    heading: 'heading1',
    bulletList: 'bulletList',
    orderedList: 'numberedList',
    taskList: 'todo',
    blockquote: 'quote',
    codeBlock: 'code',
    horizontalRule: 'divider',
    image: 'image',
  };
  return map[type] || type;
}

function extractContent(node: Record<string, unknown>): object {
  const type = node.type as string;

  if (type === 'heading') {
    const level = (node.attrs as { level: number })?.level || 1;
    const text = getTextContent(node);
    return { text, level };
  }

  if (type === 'bulletList' || type === 'orderedList') {
    const items = ((node.content as Array<Record<string, unknown>>) || [])
      .map((item) => getTextContent(item));
    return { items };
  }

  if (type === 'taskList') {
    const tasks = ((node.content as Array<Record<string, unknown>>) || []).map((item) => ({
      text: getTextContent(item),
      checked: (item.attrs as { checked?: boolean })?.checked || false,
    }));
    return tasks[0] || { text: '', checked: false };
  }

  if (type === 'codeBlock') {
    return {
      language: (node.attrs as { language?: string })?.language || '',
      code: getTextContent(node),
    };
  }

  if (type === 'image') {
    return {
      url: (node.attrs as { src?: string })?.src || '',
      alt: (node.attrs as { alt?: string })?.alt || '',
    };
  }

  if (type === 'blockquote') {
    return { text: getTextContent(node) };
  }

  return { text: getTextContent(node) };
}

function getTextContent(node: Record<string, unknown>): string {
  if (!node.content) return '';
  return (node.content as Array<Record<string, unknown>>)
    .map((n) => {
      if (n.type === 'text') return (n.text as string) || '';
      return getTextContent(n);
    })
    .join('');
}

export function blocksToTiptapHtml(blocks: Array<{ type: string; content: string }>): string {
  const parts: string[] = [];

  for (const block of blocks) {
    const content = JSON.parse(block.content || '{}');
    switch (block.type) {
      case 'heading1':
        parts.push(`<h1>${escapeHtml(content.text || '')}</h1>`);
        break;
      case 'heading2':
        parts.push(`<h2>${escapeHtml(content.text || '')}</h2>`);
        break;
      case 'heading3':
        parts.push(`<h3>${escapeHtml(content.text || '')}</h3>`);
        break;
      case 'bulletList':
        parts.push(`<ul>${(content.items || []).map((i: string) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`);
        break;
      case 'numberedList':
        parts.push(`<ol>${(content.items || []).map((i: string) => `<li>${escapeHtml(i)}</li>`).join('')}</ol>`);
        break;
      case 'todo':
        parts.push(`<ul data-type="taskList"><li data-type="taskItem" data-checked="${content.checked}">${escapeHtml(content.text || '')}</li></ul>`);
        break;
      case 'code':
        parts.push(`<pre><code>${escapeHtml(content.code || '')}</code></pre>`);
        break;
      case 'quote':
        parts.push(`<blockquote><p>${escapeHtml(content.text || '')}</p></blockquote>`);
        break;
      case 'divider':
        parts.push('<hr>');
        break;
      case 'image':
        parts.push(`<img src="${content.url || ''}" alt="${content.alt || ''}" />`);
        break;
      default:
        parts.push(`<p>${escapeHtml(content.text || '')}</p>`);
    }
  }

  return parts.join('') || '<p></p>';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
