import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { useCollab } from '../hooks/useCollab';
import BlockEditor, { tiptapJsonToBlocks, blocksToTiptapHtml } from './BlockEditor';
import DatabaseView from './DatabaseView';
import type { Block, Comment } from '../types';
import {
  Menu, History, MessageSquare, FileCode, Link2, Send, RotateCcw,
  Download, Upload, X, Trash2,
} from 'lucide-react';
import { cachePage, getCachedPage, queueOperation } from '../lib/offline';

type SidePanel = 'comments' | 'history' | null;

export default function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { user, setSidebarOpen, markdownMode, setMarkdownMode, online, loadPages } = useStore();

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
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { presence, lastUpdate } = useCollab(pageId, user?.id || '', user?.name || '');

  useEffect(() => {
    if (lastUpdate?.type === 'blocks_updated') {
      loadPage();
    }
    if (lastUpdate?.type === 'comment_added') {
      loadComments();
    }
  }, [lastUpdate]);

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

  useEffect(() => {
    loadPage();
    loadComments();
    loadVersionHistory();
  }, [loadPage]);

  const saveTitle = async (newTitle: string) => {
    if (!pageId) return;
    setTitle(newTitle);
    if (online) {
      await api.updatePage(pageId, { title: newTitle });
      loadPages();
    }
  };

  const saveBlocks = useCallback(async (html: string, json: object) => {
    if (!pageId) return;
    setEditorContent(html);
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
    }
  }, [pageId, blocks, online]);

  const toggleMarkdown = async () => {
    if (!pageId) return;
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

  const exportPage = async () => {
    if (!pageId) return;
    const { markdown: md, title: pageTitle } = await api.getMarkdown(pageId);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pageTitle || 'untitled'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pageId) return;
    setImporting(true);
    try {
      const text = await file.text();
      await api.saveMarkdown(pageId, text);
      await loadPage();
      loadVersionHistory();
      if (markdownMode) {
        const { markdown: md } = await api.getMarkdown(pageId);
        setMarkdown(md);
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed. Please check the file format.');
    } finally {
      setImporting(false);
      e.target.value = '';
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
    await api.deletePage(pageId);
    await loadPages();
    navigate('/');
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-mid-gray">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <input
        ref={importInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={handleImport}
      />

      <header className="flex items-center gap-3 px-4 py-3 border-b border-green-mist bg-warm-white/80 backdrop-blur sticky top-0 z-10">
        <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1">
          <Menu className="w-5 h-5" />
        </button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={(e) => saveTitle(e.target.value)}
          className="flex-1 text-xl font-semibold bg-transparent border-none outline-none text-charcoal"
          placeholder="Untitled"
        />

        <div className="flex items-center gap-2">
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

          {saving && <span className="text-xs text-mid-gray">Saving...</span>}
          {importing && <span className="text-xs text-mid-gray">Importing...</span>}

          <select
            value={visibility}
            onChange={(e) => { setVisibility(e.target.value); api.updatePage(pageId!, { visibility: e.target.value }); }}
            className="text-xs bg-linen rounded-lg px-2 py-1 border-none outline-none"
          >
            <option value="private">🔒 Private</option>
            <option value="shared">👥 Shared</option>
            <option value="public">🌐 Public</option>
          </select>

          <button
            onClick={exportPage}
            className="p-2 rounded-lg hover:bg-linen flex items-center gap-1.5 text-sm"
            title="Export as Markdown"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-linen flex items-center gap-1.5 text-sm"
            title="Import Markdown file"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button onClick={toggleMarkdown} className={`p-2 rounded-lg ${markdownMode ? 'bg-sage/30' : 'hover:bg-linen'}`} title="Markdown mode">
            <FileCode className="w-4 h-4" />
          </button>
          <button
            onClick={() => togglePanel('history')}
            className={`p-2 rounded-lg flex items-center gap-1.5 text-sm ${sidePanel === 'history' ? 'bg-sage/30' : 'hover:bg-linen'}`}
            title="Version history"
          >
            <History className="w-4 h-4" />
            {versions.length > 0 && (
              <span className="text-xs bg-forest text-white rounded-full px-1.5 min-w-[18px] text-center">
                {versions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => togglePanel('comments')}
            className={`p-2 rounded-lg ${sidePanel === 'comments' ? 'bg-sage/30' : 'hover:bg-linen'}`}
            title="Comments"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={deletePage}
            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
            title="Delete page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
          {pageType === 'database' ? (
            <DatabaseView pageId={pageId!} />
          ) : markdownMode ? (
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              onBlur={() => api.saveMarkdown(pageId!, markdown).then(() => { loadPage(); loadVersionHistory(); })}
              className="w-full min-h-[400px] font-mono text-sm bg-linen/50 rounded-xl p-4 border-none outline-none resize-none"
              placeholder="Write markdown here..."
            />
          ) : (
            <BlockEditor content={editorContent} onChange={saveBlocks} />
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
                    className="block text-sm text-forest hover:underline"
                  >
                    {bl.icon} {bl.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        {sidePanel && (
          <aside className="w-80 border-l border-green-mist bg-warm-white flex flex-col">
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
        )}
      </div>
    </div>
  );
}
