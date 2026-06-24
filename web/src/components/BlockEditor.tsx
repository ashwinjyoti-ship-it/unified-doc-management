import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, ImageIcon, Link2, Upload, Slash,
} from 'lucide-react';
import { SlashCommands } from './SlashCommands';
import { slashCommands } from './SlashCommandList';
import { api } from '../lib/api';
import Tooltip from './Tooltip';

const lowlight = createLowlight(common);

interface BlockEditorProps {
  content: string;
  onChange: (html: string, json: object) => void;
  editable?: boolean;
}

export default function BlockEditor({ content, onChange, editable = true }: BlockEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [insertOpen, setInsertOpen] = useState(false);

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

  const runSlashCommand = useCallback((index: number) => {
    if (!editor) return;
    const item = slashCommands[index];
    if (!item) return;
    const { from, to } = editor.state.selection;
    item.command({ editor, range: { from, to } });
    setInsertOpen(false);
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, tooltip, children }: { onClick: () => void; active?: boolean; tooltip: string; children: React.ReactNode }) => (
    <Tooltip text={tooltip}>
      <button
        type="button"
        onClick={onClick}
        className={`p-1.5 rounded-md transition-colors ${active ? 'bg-sage/40 text-forest' : 'hover:bg-linen text-charcoal'}`}
      >
        {children}
      </button>
    </Tooltip>
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
          <Tooltip text="Insert block — headings, lists, images (mobile-friendly)">
            <button
              type="button"
              onClick={() => setInsertOpen(true)}
              className="md:hidden p-2 rounded-md bg-forest text-white hover:bg-dark-teal flex items-center gap-1 text-xs font-medium"
            >
              <Slash className="w-4 h-4" />
              Insert
            </button>
          </Tooltip>
          <ToolbarButton tooltip="Bold (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Italic (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Inline code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px bg-green-mist mx-1" />
          <ToolbarButton tooltip="Heading 1 — large section title" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Heading 2 — medium section title" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Heading 3 — small section title" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px bg-green-mist mx-1" />
          <ToolbarButton tooltip="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="To-do checklist" onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')}>
            <CheckSquare className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Block quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Horizontal divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Code block with syntax highlighting" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px bg-green-mist mx-1" />
          <ToolbarButton tooltip="Insert image from file or URL" onClick={addImage} active={editor.isActive('image')}>
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Upload a file (image, PDF, document)" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton tooltip="Insert a hyperlink" onClick={addLink} active={editor.isActive('link')}>
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

      {insertOpen && (
        <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-label="Insert block">
          <div className="absolute inset-0 bg-black/40" onClick={() => setInsertOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-warm-white rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-green-mist shrink-0">
              <h3 className="font-semibold text-sm">Insert block</h3>
              <button type="button" onClick={() => setInsertOpen(false)} className="text-mid-gray text-sm px-2 py-1">
                Close
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain p-2">
              {slashCommands.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => runSlashCommand(index)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl hover:bg-linen active:bg-sage/30"
                >
                  <span className="text-mid-gray shrink-0">{item.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{item.title}</div>
                    <div className="text-xs text-mid-gray">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
