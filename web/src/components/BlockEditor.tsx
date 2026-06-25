import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, ImageIcon, Link2, Upload, Slash, MessageSquarePlus,
} from 'lucide-react';
import { SlashCommands } from './SlashCommands';
import { slashCommands, type SlashCommandItem } from './SlashCommandList';
import PageLinkModal from './PageLinkModal';
import NamePromptModal from './NamePromptModal';
import InsertPlacementModal from './InsertPlacementModal';
import { useStore } from '../lib/store';
import type { Page } from '../types';
import { api } from '../lib/api';
import AgentCommentPopover from './AgentCommentPopover';
import Tooltip from './Tooltip';
import { consumeEditorSeed } from '../lib/editorSeed';
import {
  applyNewPageSeed,
  defaultIconFor,
  defaultTitleFor,
  resolveInsertParentId,
  runInlineFunctional,
  seedBlocksFor,
  type FunctionalSlashKey,
} from '../lib/slashInsert';

const lowlight = createLowlight(common);

interface BlockEditorProps {
  content: string;
  onChange: (html: string, json: object) => void;
  editable?: boolean;
  pageId?: string;
}

export default function BlockEditor({ content, onChange, editable = true, pageId }: BlockEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [pageLinkOpen, setPageLinkOpen] = useState(false);
  const [newPagePromptOpen, setNewPagePromptOpen] = useState(false);
  const [placementModal, setPlacementModal] = useState<{
    item: SlashCommandItem;
    range: { from: number; to: number };
  } | null>(null);
  const [agentComment, setAgentComment] = useState<{ quote: string; from: number; to: number; blockType?: string } | null>(null);
  const selectionRef = useRef<{ quote: string; from: number; to: number; blockType?: string } | null>(null);
  const pageLinkRangeRef = useRef<{ from: number; to: number } | null>(null);
  const newPageRangeRef = useRef<{ from: number; to: number } | null>(null);
  const navigate = useNavigate();
  const { pages, createPage, loadPages } = useStore();

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const result = await api.uploadFile(file);
    return result.url;
  }, []);

  const handleSlashItemSelected = useCallback(({ editor: ed, range, item }: {
    editor: import('@tiptap/react').Editor;
    range: { from: number; to: number };
    item: SlashCommandItem;
  }) => {
    if (item.placement === 'format' && item.command) {
      item.command({ editor: ed, range });
      setInsertOpen(false);
      return;
    }
    if (item.placement === 'functional' && item.key) {
      // Remove typed "/" query so the slash popup closes before the placement sheet opens
      const insertAt = range.from;
      if (range.from !== range.to) {
        ed.chain().focus().deleteRange(range).run();
      }
      setPlacementModal({ item, range: { from: insertAt, to: insertAt } });
      setInsertOpen(false);
    }
  }, []);

  const insertItems = slashCommands;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Type / for commands, or start writing...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      CodeBlockLowlight.configure({ lowlight }),
      SlashCommands.configure({
        onImageUpload: uploadImage,
        onSlashItemSelected: handleSlashItemSelected,
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML(), ed.getJSON());
    },
  });

  const captureEditorSelection = useCallback((ed: NonNullable<typeof editor>) => {
    const { from, to, empty } = ed.state.selection;
    if (empty || from === to) return null;
    const quote = ed.state.doc.textBetween(from, to, ' ');
    if (!quote.trim()) return null;
    let blockType: string | undefined;
    const $from = ed.state.selection.$from;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.isBlock) {
        blockType = node.type.name;
        break;
      }
    }
    return { quote: quote.trim(), from, to, blockType };
  }, []);

  useEffect(() => {
    if (!editor) return;
    const updateSelection = () => {
      const captured = captureEditorSelection(editor);
      if (captured) selectionRef.current = captured;
    };
    editor.on('selectionUpdate', updateSelection);
    return () => {
      editor.off('selectionUpdate', updateSelection);
    };
  }, [editor, captureEditorSelection]);

  const openAgentComment = useCallback((ed: NonNullable<typeof editor>) => {
    const captured = captureEditorSelection(ed) || selectionRef.current;
    if (!captured?.quote.trim()) return;
    selectionRef.current = captured;
    setAgentComment(captured);
  }, [captureEditorSelection]);

  const dismissAgentComment = useCallback(() => {
    setAgentComment(null);
    if (editor) {
      const pos = editor.state.selection.from;
      editor.chain().setTextSelection(pos).blur().run();
    }
  }, [editor]);

  const createDatabaseAndLink = useCallback(async (range: { from: number; to: number }, navigateToDb = false) => {
    if (!editor) return;
    const parentId = resolveInsertParentId(pageId, pages);
    const title = defaultTitleFor('database');
    const page = await createPage({ type: 'database', title, parentId, icon: defaultIconFor('database') });
    await loadPages();
    if (navigateToDb) {
      editor.chain().focus().deleteRange(range).run();
      navigate(`/page/${page.id}`);
      return;
    }
    editor.chain().focus().deleteRange(range).insertContent(`[[${page.title}]] `).run();
  }, [editor, pageId, pages, createPage, loadPages, navigate]);

  const openNewPageInProject = useCallback(async (key: FunctionalSlashKey, range: { from: number; to: number }, title?: string) => {
    if (!editor) return;
    const parentId = resolveInsertParentId(pageId, pages);
    const pageTitle = title || defaultTitleFor(key);

    if (key === 'database') {
      await createDatabaseAndLink(range, true);
      return;
    }

    const page = await createPage({
      type: 'page',
      title: pageTitle,
      parentId,
      icon: defaultIconFor(key),
    });
    await api.saveBlocks(page.id, seedBlocksFor(key));
    applyNewPageSeed(key, page.id);
    await loadPages();
    editor.chain().focus().deleteRange(range).run();
    if (key === 'image') {
      sessionStorage.setItem(`pickImageFor:${page.id}`, '1');
    }
    navigate(`/page/${page.id}`);
  }, [editor, pageId, pages, createPage, loadPages, navigate, createDatabaseAndLink]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor || !pageId) return;
    const seed = consumeEditorSeed(pageId);
    if (seed) {
      editor.commands.setContent(seed);
      onChange(editor.getHTML(), editor.getJSON());
    }
    if (sessionStorage.getItem(`pickImageFor:${pageId}`)) {
      sessionStorage.removeItem(`pickImageFor:${pageId}`);
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  }, [editor, pageId, onChange]);

  const insertPageLink = useCallback((page: Page) => {
    if (!editor || !pageLinkRangeRef.current) return;
    const { from, to } = pageLinkRangeRef.current;
    editor.chain().focus().deleteRange({ from, to }).insertContent(`[[${page.title}]] `).run();
    pageLinkRangeRef.current = null;
    setPageLinkOpen(false);
  }, [editor]);

  const confirmNewPageAndNavigate = useCallback(async (title: string) => {
    if (!editor || !newPageRangeRef.current) return;
    const range = newPageRangeRef.current;
    await openNewPageInProject('page-link', range, title);
    newPageRangeRef.current = null;
    setNewPagePromptOpen(false);
  }, [editor, openNewPageInProject]);

  const handleSamePage = useCallback(() => {
    if (!editor || !placementModal?.item.key) return;
    const { item, range } = placementModal;
    const key = item.key!;
    setPlacementModal(null);

    if (key === 'page-link') {
      pageLinkRangeRef.current = range;
      setPageLinkOpen(true);
      return;
    }

    runInlineFunctional(key, editor, range, {
      openPageLinkPicker: () => {
        pageLinkRangeRef.current = range;
        setPageLinkOpen(true);
      },
      openImagePicker: () => fileInputRef.current?.click(),
      onDatabaseLink: () => { void createDatabaseAndLink(range, false); },
    });
  }, [editor, placementModal, createDatabaseAndLink]);

  const handleNewPage = useCallback(() => {
    if (!editor || !placementModal?.item.key) return;
    const { item, range } = placementModal;
    const key = item.key!;
    setPlacementModal(null);

    if (key === 'page-link') {
      newPageRangeRef.current = range;
      setNewPagePromptOpen(true);
      return;
    }

    void openNewPageInProject(key, range);
  }, [editor, placementModal, openNewPageInProject]);

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
    const item = insertItems[index];
    if (!item) return;
    const { from, to } = editor.state.selection;
    handleSlashItemSelected({ editor, range: { from, to }, item });
  }, [editor, insertItems, handleSlashItemSelected]);

  if (!editor) {
    return <div className="text-mid-gray text-sm py-8">Loading editor...</div>;
  }

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

  const BubbleButton = ({ onMouseDown, active, title, children }: {
    onMouseDown: (e: React.MouseEvent) => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      className={`p-1.5 rounded-md transition-colors ${active ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-tooltip-fg'}`}
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
        <div className="mb-4 p-2 bg-linen/50 rounded-xl md:sticky md:top-0 md:z-10">
          {/* Mobile: slim toolbar — Insert sheet + basic formatting */}
          <div className="flex gap-1 md:hidden">
            <Tooltip text="Insert block — headings, lists, images">
              <button
                type="button"
                onClick={() => setInsertOpen(true)}
                className="p-2 rounded-md bg-forest text-white hover:bg-dark-teal flex items-center gap-1 text-xs font-medium"
              >
                <Slash className="w-4 h-4" />
                Insert
              </button>
            </Tooltip>
            <ToolbarButton tooltip="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
              <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton tooltip="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
              <Italic className="w-4 h-4" />
            </ToolbarButton>
          </div>
          {/* Desktop: full toolbar */}
          <div className="hidden md:flex flex-wrap gap-1">
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
          <ToolbarButton
            tooltip="Block quote"
            onClick={() => {
              if (editor.isActive('blockquote')) {
                editor.chain().focus().lift('blockquote').run();
              } else {
                editor.chain().focus().setBlockquote().run();
              }
            }}
            active={editor.isActive('blockquote')}
          >
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
        </div>
      )}

      {editable && !agentComment && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex gap-1 bg-tooltip-bg rounded-lg p-1 shadow-lg items-center">
            <BubbleButton
              title="Make selected text bold"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
              active={editor.isActive('bold')}
            >
              <Bold className="w-4 h-4 text-tooltip-fg" />
            </BubbleButton>
            <BubbleButton
              title="Make selected text italic"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
              active={editor.isActive('italic')}
            >
              <Italic className="w-4 h-4 text-tooltip-fg" />
            </BubbleButton>
            <BubbleButton
              title="Strike through selected text"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
              active={editor.isActive('strike')}
            >
              <Strikethrough className="w-4 h-4 text-tooltip-fg" />
            </BubbleButton>
            {pageId && (
              <>
                <span className="w-px h-5 bg-white/20 mx-0.5" />
                <BubbleButton
                  title="Comment for AI agent — instruction applies to selected text"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openAgentComment(editor);
                  }}
                >
                  <MessageSquarePlus className="w-4 h-4 text-amber-300" />
                </BubbleButton>
              </>
            )}
          </div>
        </BubbleMenu>
      )}

      {agentComment && pageId && (
        <AgentCommentPopover
          quote={agentComment.quote}
          onCancel={dismissAgentComment}
          onSubmit={(instruction) => {
            const payload = agentComment;
            setAgentComment(null);
            if (editor) {
              editor.chain().setTextSelection(payload.from).blur().run();
            }
            void api.addComment(pageId, instruction, undefined, {
              commentType: 'agent_instruction',
              selectionQuote: payload.quote,
              selectionMeta: { from: payload.from, to: payload.to, blockType: payload.blockType },
            }).catch((err) => {
              console.error(err);
              alert(err instanceof Error ? err.message : 'Could not save agent instruction');
            });
          }}
        />
      )}

      <EditorContent editor={editor} className="prose-forest max-w-none" />

      {insertOpen && !placementModal && (
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
              {insertItems.map((item, index) => (
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

      <InsertPlacementModal
        open={!!placementModal}
        itemTitle={placementModal?.item.title ?? ''}
        onClose={() => setPlacementModal(null)}
        onSamePage={handleSamePage}
        onNewPage={handleNewPage}
      />

      <PageLinkModal
        open={pageLinkOpen}
        pages={pages}
        currentPageId={pageId}
        onClose={() => { setPageLinkOpen(false); pageLinkRangeRef.current = null; }}
        onSelect={insertPageLink}
      />

      <NamePromptModal
        open={newPagePromptOpen}
        title="New page"
        label="Page title"
        placeholder="e.g. Meeting notes"
        confirmLabel="Create & open"
        onClose={() => { setNewPagePromptOpen(false); newPageRangeRef.current = null; }}
        onConfirm={(name) => void confirmNewPageAndNavigate(name)}
      />
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
