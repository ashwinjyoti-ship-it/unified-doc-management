import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { useCollab } from '../hooks/useCollab';
import BlockEditor, { tiptapJsonToBlocks, blocksToTiptapHtml } from './BlockEditor';
import DatabaseView from './DatabaseView';
import FolderView from './FolderView';
import NamePromptModal from './NamePromptModal';
import Tooltip from './Tooltip';
import ImportOptionsModal, { type ImportMode } from './ImportOptionsModal';
import OperationBanner from './OperationBanner';
import { applyImportContent } from '../lib/importContent';
import type { Block, Comment, Tag } from '../types';
import { jsPDF } from 'jspdf';
import {
  History, MessageSquare, FileCode, Link2, Send, RotateCcw,
  Download, Upload, X, Trash2, Star, Copy, FileText, Tag as TagIcon, Plus, Save, Check, MoreHorizontal,
} from 'lucide-react';
import { cachePage, getCachedPage, queueOperation } from '../lib/offline';

type SidePanel = 'comments' | 'history' | null;

export default function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { user, markdownMode, setMarkdownMode, online, loadPages, loadFavorites, loadRecent, loadTags, workspace, pages, createPage } = useStore();

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pageType, setPageType] = useState<string>('page');
  const [visibility, setVisibility] = useState('private');
  const [backlinks, setBacklinks] = useState<Array<{ id: string; title: string; icon: string }>>([]);
  const [editorContent, setEditorContent] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [versions, setVersions] = useState<Array<{ id: string; title: string; created_at: number; author_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [operationLabel, setOperationLabel] = useState<string | null>(null);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [importModal, setImportModal] = useState<{
    sourceLabel: string;
    sourceType: 'file' | 'url';
    content: string;
    suggestedTitle?: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const operationCancelledRef = useRef(false);
  const [pageTags, setPageTags] = useState<Tag[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [folderChildModal, setFolderChildModal] = useState<'page' | 'folder' | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const editorJsonRef = useRef<object | null>(null);
  const editorHtmlRef = useRef<string>('');

  const { presence, lastUpdate } = useCollab(pageId, user?.id || '', user?.name || '');

  useEffect(() => {
    if (lastUpdate?.type === 'blocks_updated' && !dirty) {
      loadPage();
    }
    if (lastUpdate?.type === 'comment_added') {
      loadComments();
    }
  }, [lastUpdate, dirty]);

  const loadPage = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    try {
      if (online) {
        const data = await api.getPage(pageId);
        setTitle(data.page.title);
        setPageType(data.page.type);
        setVisibility(data.page.visibility);
        setBlocks(data.blocks);
        setBacklinks(data.backlinks);
        setEditorContent(blocksToTiptapHtml(data.blocks));
        await cachePage(pageId, data);
        setDirty(false);
        setLastSaved(new Date());
      } else {
        const cached = await getCachedPage(pageId) as { page: { title: string; type: string; visibility: string }; blocks: Block[] } | undefined;
        if (cached) {
          setTitle(cached.page.title);
          setPageType(cached.page.type);
          setVisibility(cached.page.visibility);
          setBlocks(cached.blocks);
          setEditorContent(blocksToTiptapHtml(cached.blocks));
        }
      }
    } catch (err) {
      console.error(err);
      const remaining = useStore.getState().pages.filter((p) => p.id !== pageId);
      if (remaining.length > 0) {
        navigate(`/page/${remaining[0].id}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [pageId, online]);

  const loadComments = async () => {
    if (!pageId) return;
    try {
      const { comments: c } = await api.getComments(pageId);
      setComments(c);
    } catch { /* offline */ }
  };

  const loadVersionHistory = async () => {
    if (!pageId) return;
    try {
      const { versions: v } = await api.getVersions(pageId);
      setVersions(v);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPageTags = async () => {
    if (!pageId) return;
    try {
      const { tags } = await api.getPageTags(pageId);
      setPageTags(tags);
    } catch { /* offline */ }
  };

  const loadFavoriteStatus = async () => {
    if (!pageId) return;
    try {
      const { favorited: fav } = await api.isFavorited(pageId);
      setFavorited(fav);
    } catch { /* offline */ }
  };

  useEffect(() => {
    loadPage();
    loadComments();
    loadVersionHistory();
    loadPageTags();
    loadFavoriteStatus();
    if (pageId && online) {
      api.recordPageView(pageId).then(() => loadRecent()).catch(() => {});
    }
  }, [loadPage]);

  const saveTitle = useCallback(async (newTitle: string) => {
    if (!pageId) return;
    if (online) {
      await api.updatePage(pageId, { title: newTitle });
      loadPages();
    }
  }, [pageId, online, loadPages]);

  useEffect(() => {
    if (!pageId || !dirty || !title.trim()) return;
    const timer = setTimeout(() => {
      void saveTitle(title);
    }, 800);
    return () => clearTimeout(timer);
  }, [title, dirty, pageId, saveTitle]);

  const persistBlocks = useCallback(async (html: string, json: object) => {
    if (!pageId) return;
    const blockData = tiptapJsonToBlocks(json as Record<string, unknown>).map((b, i) => ({
      ...b,
      id: blocks[i]?.id,
      orderIndex: i,
    }));

    if (online) {
      setSaving(true);
      try {
        const { blocks: saved } = await api.saveBlocks(pageId, blockData);
        setBlocks(saved);
        setEditorContent(html);
        setDirty(false);
        setLastSaved(new Date());
        loadVersionHistory();
      } finally {
        setSaving(false);
      }
    } else {
      await queueOperation({
        operation: 'update_blocks',
        entityType: 'page',
        entityId: pageId,
        payload: { pageId, blocks: blockData },
      });
      setDirty(false);
      setLastSaved(new Date());
    }
  }, [pageId, blocks, online]);

  const handleEditorChange = useCallback((html: string, json: object) => {
    editorHtmlRef.current = html;
    editorJsonRef.current = json;
    setDirty(true);
  }, []);

  const saveNow = useCallback(async () => {
    if (!pageId || saving) return;
    await saveTitle(title);
    if (markdownMode) {
      setSaving(true);
      try {
        await api.saveMarkdown(pageId, markdown);
        setDirty(false);
        setLastSaved(new Date());
        await loadPage();
        loadVersionHistory();
      } finally {
        setSaving(false);
      }
    } else if (editorJsonRef.current) {
      await persistBlocks(editorHtmlRef.current, editorJsonRef.current);
    }
  }, [pageId, saving, title, markdownMode, markdown, persistBlocks]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);

  const toggleMarkdown = async () => {
    if (!pageId) return;
    if (dirty) await saveNow();
    if (!markdownMode) {
      const { markdown: md } = await api.getMarkdown(pageId);
      setMarkdown(md);
    } else if (markdown) {
      await api.saveMarkdown(pageId, markdown);
      await loadPage();
      loadVersionHistory();
    }
    setMarkdownMode(!markdownMode);
  };

  const cancelOperation = () => {
    abortRef.current?.abort();
    operationCancelledRef.current = true;
    setOperationLabel(null);
    setImporting(false);
    setExporting(false);
    setImportModal(null);
  };

  const startOperation = (label: string) => {
    abortRef.current = new AbortController();
    operationCancelledRef.current = false;
    setOperationLabel(label);
  };

  const runImport = async (mode: ImportMode) => {
    if (!importModal || !workspace) return;
    const modal = importModal;
    setImportModal(null);
    setImporting(true);
    startOperation('Importing...');
    try {
      const targetId = await applyImportContent({
        content: modal.content,
        mode,
        pageId,
        workspaceId: workspace.id,
        suggestedTitle: modal.suggestedTitle,
        signal: abortRef.current?.signal,
      });
      if (mode === 'new' || targetId !== pageId) {
        navigate(`/page/${targetId}`);
      } else {
        await loadPage();
        loadVersionHistory();
        if (markdownMode) {
          const { markdown: md } = await api.getMarkdown(pageId!);
          setMarkdown(md);
        }
      }
      await loadPages();
      await loadRecent();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      setOperationLabel(null);
      abortRef.current = null;
    }
  };

  const exportPage = async () => {
    if (!pageId) return;
    setShowExportMenu(false);
    setExporting(true);
    startOperation('Exporting Markdown...');
    try {
      const { markdown: md, title: pageTitle } = await api.getMarkdown(pageId);
      if (operationCancelledRef.current) return;
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pageTitle || 'untitled'}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setOperationLabel(null);
      abortRef.current = null;
    }
  };

  const exportPdf = async () => {
    if (!pageId) return;
    setShowExportMenu(false);
    setExporting(true);
    startOperation('Generating PDF...');
    try {
      const { markdown: md, title: pageTitle } = await api.getMarkdown(pageId);
      if (operationCancelledRef.current) return;
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(pageTitle || 'Untitled', 10, 15);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(md, 180);
      let y = 25;
      for (const line of lines) {
        if (operationCancelledRef.current) return;
        if (y > 280) { doc.addPage(); y = 15; }
        doc.text(line, 10, y);
        y += 5;
      }
      if (!operationCancelledRef.current) {
        doc.save(`${pageTitle || 'untitled'}.pdf`);
      }
    } finally {
      setExporting(false);
      setOperationLabel(null);
      abortRef.current = null;
    }
  };

  const duplicatePage = async () => {
    if (!pageId) return;
    const { page } = await api.duplicatePage(pageId);
    await loadPages();
    navigate(`/page/${page.id}`);
  };

  const toggleFavorite = async () => {
    if (!pageId) return;
    if (favorited) {
      await api.unfavoritePage(pageId);
      setFavorited(false);
    } else {
      await api.favoritePage(pageId);
      setFavorited(true);
    }
    loadFavorites();
  };

  const addTag = async () => {
    if (!pageId || !newTag.trim()) return;
    const { tag } = await api.addPageTag(pageId, { name: newTag.trim() });
    setPageTags((prev) => prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]);
    setNewTag('');
    loadTags();
  };

  const removeTag = async (tagId: string) => {
    if (!pageId) return;
    await api.removePageTag(pageId, tagId);
    setPageTags((prev) => prev.filter((t) => t.id !== tagId));
  };

  const importFromUrl = async () => {
    const url = window.prompt('Enter URL to import:');
    if (!url) return;
    setImporting(true);
    startOperation('Fetching URL...');
    try {
      const { title, markdown: md } = await api.importFromUrl(url, abortRef.current?.signal);
      if (operationCancelledRef.current) return;
      setImportModal({
        sourceLabel: url,
        sourceType: 'url',
        content: md,
        suggestedTitle: title,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      setOperationLabel(null);
      abortRef.current = null;
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setImportModal({
        sourceLabel: file.name,
        sourceType: 'file',
        content: text,
        suggestedTitle: file.name.replace(/\.(md|markdown|txt)$/i, '') || 'Imported',
      });
    } catch {
      alert('Could not read file');
    }
  };

  const restoreVersion = async (versionId: string) => {
    if (!pageId) return;
    const { blocks: restored } = await api.restoreVersion(pageId, versionId);
    setBlocks(restored);
    setEditorContent(blocksToTiptapHtml(restored));
    loadVersionHistory();
  };

  const submitComment = async () => {
    if (!pageId || !newComment.trim()) return;
    await api.addComment(pageId, newComment);
    setNewComment('');
    loadComments();
  };

  const togglePanel = (panel: SidePanel) => {
    setSidePanel((current) => (current === panel ? null : panel));
  };

  const deletePage = async () => {
    if (!pageId) return;
    const confirmed = window.confirm(`Delete "${title || 'Untitled'}"? This cannot be undone.`);
    if (!confirmed) return;
    const remaining = useStore.getState().pages.filter((p) => p.id !== pageId);
    await api.deletePage(pageId);
    await loadPages();
    await loadFavorites();
    await loadRecent();
    if (remaining.length > 0) {
      navigate(`/page/${remaining[0].id}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-mid-gray">Loading...</div>;
  }

  return (
    <div className="min-h-full flex flex-col">
      <input
        ref={importInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={handleImport}
      />

      <header className="flex flex-col gap-2 px-4 py-3 border-b border-green-mist bg-warm-white/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            onBlur={(e) => saveTitle(e.target.value)}
            className="flex-1 min-w-0 text-base md:text-xl font-semibold bg-transparent border-none outline-none text-charcoal page-title-input"
            placeholder="Untitled"
          />

          {/* Save + status + delete — always visible, never scrolled away */}
          <div className="flex items-center gap-1.5 shrink-0">
            {saving ? (
              <span className="text-xs text-mid-gray whitespace-nowrap">Saving...</span>
            ) : dirty ? (
              <span className="text-xs text-amber-600 whitespace-nowrap">Unsaved</span>
            ) : lastSaved ? (
              <span className="text-xs text-sage whitespace-nowrap inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Saved</span>
              </span>
            ) : null}

            <Tooltip text="Save page (Ctrl+S) — saves title and content">
              <button
                onClick={saveNow}
                disabled={saving}
                className={`p-2 rounded-lg flex items-center gap-1 text-sm font-medium ${
                  dirty ? 'bg-forest text-white hover:bg-dark-teal' : 'hover:bg-linen text-charcoal'
                }`}
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save</span>
              </button>
            </Tooltip>

            <Tooltip text="Permanently delete this page">
              <button onClick={deletePage} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          {presence.length > 0 && (
            <div className="flex items-center gap-1.5 mr-1">
              <div className="flex -space-x-2">
                {presence.slice(0, 3).map((u) => (
                  <div
                    key={u.userId}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-medium border-2 border-white"
                    style={{ backgroundColor: u.color }}
                    title={u.userName}
                  >
                    {u.userName[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
              {presence.length > 3 && (
                <span className="text-xs text-mid-gray">+{presence.length - 3}</span>
              )}
            </div>
          )}

          {importing && <span className="text-xs text-mid-gray shrink-0">Importing...</span>}
          {exporting && <span className="text-xs text-mid-gray shrink-0">Exporting...</span>}

          <Tooltip text="Who can see this page: Private, Shared, or Public">
            <select
              value={visibility}
              onChange={(e) => { setVisibility(e.target.value); api.updatePage(pageId!, { visibility: e.target.value }); }}
              className="text-xs bg-linen rounded-lg px-2 py-1 border-none outline-none"
            >
              <option value="private">🔒 Private</option>
              <option value="shared">👥 Shared</option>
              <option value="public">🌐 Public</option>
            </select>
          </Tooltip>

          <Tooltip text={favorited ? 'Remove from favorites' : 'Pin to favorites for quick access'}>
            <button
              onClick={toggleFavorite}
              className={`p-2 rounded-lg ${favorited ? 'text-amber-500 bg-amber-50' : 'hover:bg-linen'}`}
            >
              <Star className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
            </button>
          </Tooltip>

          <Tooltip text="Create a copy of this page with all its content">
            <button onClick={duplicatePage} className="p-2 rounded-lg hover:bg-linen">
              <Copy className="w-4 h-4" />
            </button>
          </Tooltip>

          <div className="relative">
            <Tooltip text="Download this page as Markdown or PDF">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!!operationLabel}
                className="p-2 rounded-lg hover:bg-linen flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </Tooltip>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-warm-white border border-green-mist rounded-xl shadow-lg z-20 py-1 min-w-[140px]">
                <button onClick={exportPage} className="w-full px-4 py-2 text-sm text-left hover:bg-linen flex items-center gap-2">
                  <FileCode className="w-4 h-4" /> Markdown (.md)
                </button>
                <button onClick={exportPdf} className="w-full px-4 py-2 text-sm text-left hover:bg-linen flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PDF (.pdf)
                </button>
              </div>
            )}
          </div>

          <Tooltip text="Import a file or URL — choose to append, overwrite, or create new page">
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={!!operationLabel}
              className="p-2 rounded-lg hover:bg-linen flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
          </Tooltip>

          <Tooltip text="Fetch a web page URL — choose to append, overwrite, or create new page">
            <button onClick={importFromUrl} disabled={!!operationLabel} className="p-2 rounded-lg hover:bg-linen disabled:opacity-50">
              <Link2 className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip text={markdownMode ? 'Switch back to visual editor' : 'Edit raw Markdown source directly'}>
            <button onClick={toggleMarkdown} className={`p-2 rounded-lg ${markdownMode ? 'bg-sage/30' : 'hover:bg-linen'}`}>
              <FileCode className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip text="View and restore previous versions of this page">
            <button
              onClick={() => togglePanel('history')}
              className={`p-2 rounded-lg flex items-center gap-1.5 text-sm ${sidePanel === 'history' ? 'bg-sage/30' : 'hover:bg-linen'}`}
            >
              <History className="w-4 h-4" />
              {versions.length > 0 && (
                <span className="text-xs bg-forest text-white rounded-full px-1.5 min-w-[18px] text-center">
                  {versions.length}
                </span>
              )}
            </button>
          </Tooltip>

          <Tooltip text="Add and read comments on this page">
            <button
              onClick={() => togglePanel('comments')}
              className={`p-2 rounded-lg ${sidePanel === 'comments' ? 'bg-sage/30' : 'hover:bg-linen'}`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Mobile: compact action row + overflow menu */}
        <div className="flex md:hidden items-center gap-1 pb-0.5">
          {importing && <span className="text-xs text-mid-gray shrink-0">Importing...</span>}
          {exporting && <span className="text-xs text-mid-gray shrink-0">Exporting...</span>}

          <Tooltip text={favorited ? 'Remove from favorites' : 'Pin to favorites'}>
            <button
              onClick={toggleFavorite}
              className={`p-2 rounded-lg ${favorited ? 'text-amber-500 bg-amber-50' : 'hover:bg-linen'}`}
            >
              <Star className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
            </button>
          </Tooltip>

          <Tooltip text="Version history">
            <button
              onClick={() => togglePanel('history')}
              className={`p-2 rounded-lg flex items-center gap-1 ${sidePanel === 'history' ? 'bg-sage/30' : 'hover:bg-linen'}`}
            >
              <History className="w-4 h-4" />
              {versions.length > 0 && (
                <span className="text-xs bg-forest text-white rounded-full px-1.5 min-w-[18px] text-center">
                  {versions.length}
                </span>
              )}
            </button>
          </Tooltip>

          <Tooltip text="Comments">
            <button
              onClick={() => togglePanel('comments')}
              className={`p-2 rounded-lg ${sidePanel === 'comments' ? 'bg-sage/30' : 'hover:bg-linen'}`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </Tooltip>

          <div className="relative ml-auto">
            <Tooltip text="More actions">
              <button
                onClick={() => setShowMobileMore((v) => !v)}
                className={`p-2 rounded-lg ${showMobileMore ? 'bg-sage/30' : 'hover:bg-linen'}`}
                aria-expanded={showMobileMore}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </Tooltip>
            {showMobileMore && (
              <>
                <div className="fixed inset-0 z-20" aria-hidden onClick={() => setShowMobileMore(false)} />
                <div className="absolute right-0 top-full mt-1 z-30 bg-warm-white border border-green-mist rounded-xl shadow-lg py-1 min-w-[200px]">
                  <label className="block px-4 py-2 text-xs text-mid-gray">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => { setVisibility(e.target.value); api.updatePage(pageId!, { visibility: e.target.value }); }}
                    className="w-[calc(100%-2rem)] mx-4 mb-2 text-xs bg-linen rounded-lg px-2 py-1.5 border-none outline-none"
                  >
                    <option value="private">🔒 Private</option>
                    <option value="shared">👥 Shared</option>
                    <option value="public">🌐 Public</option>
                  </select>
                  <button onClick={() => { duplicatePage(); setShowMobileMore(false); }} className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen flex items-center gap-2">
                    <Copy className="w-4 h-4" /> Duplicate
                  </button>
                  <button onClick={() => { exportPage(); setShowMobileMore(false); }} className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen flex items-center gap-2">
                    <FileCode className="w-4 h-4" /> Export Markdown
                  </button>
                  <button onClick={() => { exportPdf(); setShowMobileMore(false); }} className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Export PDF
                  </button>
                  <button onClick={() => { importInputRef.current?.click(); setShowMobileMore(false); }} disabled={!!operationLabel} className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen flex items-center gap-2 disabled:opacity-50">
                    <Upload className="w-4 h-4" /> Import file
                  </button>
                  <button onClick={() => { importFromUrl(); setShowMobileMore(false); }} disabled={!!operationLabel} className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen flex items-center gap-2 disabled:opacity-50">
                    <Link2 className="w-4 h-4" /> Import URL
                  </button>
                  <button onClick={() => { toggleMarkdown(); setShowMobileMore(false); }} className="w-full px-4 py-2.5 text-sm text-left hover:bg-linen flex items-center gap-2">
                    <FileCode className="w-4 h-4" /> {markdownMode ? 'Visual editor' : 'Markdown source'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {pageTags.length > 0 || pageType === 'page' ? (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-green-mist bg-warm-white/50 flex-wrap">
          <Tooltip text="Labels to organize and find pages">
            <TagIcon className="w-3.5 h-3.5 text-mid-gray shrink-0" />
          </Tooltip>
          {pageTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-charcoal"
              style={{ backgroundColor: `${tag.color}40` }}
            >
              {tag.name}
              <button type="button" onClick={() => removeTag(tag.id)} className="hover:text-red-600 ml-0.5">×</button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="Add tag..."
              className="text-xs bg-transparent border-none outline-none w-20 placeholder:text-mid-gray"
            />
            <Tooltip text="Add a label to this page">
              <button type="button" onClick={addTag} className="p-0.5 hover:bg-linen rounded">
                <Plus className="w-3 h-3 text-mid-gray" />
              </button>
            </Tooltip>
          </div>
        </div>
      ) : null}

      <div className="flex">
        <div className="flex-1 min-w-0 w-full">
          <div className="p-6 md:p-10 max-w-4xl mx-auto w-full">
          {pageType === 'database' ? (
            <DatabaseView pageId={pageId!} />
          ) : pageType === 'folder' ? (
            <FolderView
              folderId={pageId!}
              folderTitle={title}
              pages={pages}
              onNewPage={async () => {
                if (!pageId) return;
                const page = await createPage({ parentId: pageId, type: 'page' });
                await loadPages();
                navigate(`/page/${page.id}`);
              }}
              onNewFolder={() => setFolderChildModal('folder')}
            />
          ) : markdownMode ? (
            <textarea
              value={markdown}
              onChange={(e) => { setMarkdown(e.target.value); setDirty(true); }}
              className="w-full min-h-[400px] font-mono text-sm bg-linen/50 rounded-xl p-4 border-none outline-none resize-none"
              placeholder="Write markdown here..."
            />
          ) : (
            <BlockEditor content={editorContent} onChange={handleEditorChange} pageId={pageId} />
          )}

          {backlinks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-green-mist">
              <h3 className="text-sm font-medium text-mid-gray mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Backlinks
              </h3>
              <div className="space-y-1">
                {backlinks.map((bl) => (
                  <button
                    key={bl.id}
                    onClick={() => navigate(`/page/${bl.id}`)}
                    className="block text-sm text-link text-left w-full"
                  >
                    {bl.icon} {bl.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>

        {sidePanel && (
          <>
            <div
              className="md:hidden fixed inset-0 bg-black/30 z-30"
              onClick={() => setSidePanel(null)}
              aria-hidden
            />
            <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-sm flex flex-col border-l border-green-mist bg-warm-white overflow-hidden md:relative md:inset-auto md:z-auto md:w-80 md:shrink-0 md:sticky md:top-0 md:self-start md:max-h-[100dvh]">
            <div className="flex border-b border-green-mist">
              <button
                onClick={() => setSidePanel('comments')}
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                  sidePanel === 'comments' ? 'text-forest border-b-2 border-forest' : 'text-mid-gray hover:text-charcoal'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> Comments
              </button>
              <button
                onClick={() => setSidePanel('history')}
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                  sidePanel === 'history' ? 'text-forest border-b-2 border-forest' : 'text-mid-gray hover:text-charcoal'
                }`}
              >
                <History className="w-4 h-4" /> History
                {versions.length > 0 && (
                  <span className="text-xs bg-linen rounded-full px-1.5">{versions.length}</span>
                )}
              </button>
              <button onClick={() => setSidePanel(null)} className="px-3 text-mid-gray hover:text-charcoal">
                <X className="w-4 h-4" />
              </button>
            </div>

            {sidePanel === 'comments' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-mid-gray text-center py-8">No comments yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="text-sm">
                        <div className="font-medium text-charcoal">{c.author_name}</div>
                        <div className="text-warm-gray mt-1">{c.content}</div>
                        <div className="text-xs text-mid-gray mt-1">
                          {new Date(c.created_at * 1000).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-green-mist flex gap-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 rounded-lg bg-linen text-sm border-none outline-none"
                  />
                  <button onClick={submitComment} className="btn-primary p-2">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}

            {sidePanel === 'history' && (
              <div className="flex-1 overflow-y-auto p-4">
                {versions.length === 0 ? (
                  <p className="text-sm text-mid-gray text-center py-8">
                    No versions yet. Versions are saved automatically when you edit.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {versions.map((v, index) => (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-linen border border-transparent hover:border-green-mist">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {index === 0 ? 'Current save' : v.title || 'Untitled'}
                          </div>
                          <div className="text-xs text-mid-gray">
                            {v.author_name} · {new Date(v.created_at * 1000).toLocaleString()}
                          </div>
                        </div>
                        {index > 0 && (
                          <button
                            onClick={() => restoreVersion(v.id)}
                            className="btn-secondary text-xs flex items-center gap-1 ml-2 shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
          </>
        )}
      </div>

      {importModal && (
        <ImportOptionsModal
          open
          sourceLabel={importModal.sourceLabel}
          sourceType={importModal.sourceType}
          onClose={() => setImportModal(null)}
          onConfirm={runImport}
        />
      )}
      {operationLabel && (
        <OperationBanner label={operationLabel} onCancel={cancelOperation} />
      )}
      {folderChildModal === 'folder' && pageId && (
        <NamePromptModal
          open
          title="New Folder"
          label="Folder name"
          placeholder="e.g. API Documentation"
          confirmLabel="Create Folder"
          showIcon
          defaultIcon="📁"
          onClose={() => setFolderChildModal(null)}
          onConfirm={async (name, icon) => {
            const page = await createPage({
              type: 'folder',
              title: name,
              parentId: pageId,
              icon: icon || '📁',
            });
            await loadPages();
            setFolderChildModal(null);
            navigate(`/page/${page.id}`);
          }}
        />
      )}
    </div>
  );
}
