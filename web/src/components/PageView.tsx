import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { useCollab } from '../hooks/useCollab';
import BlockEditor, { tiptapJsonToBlocks, blocksToTiptapHtml } from './BlockEditor';
import DatabaseView from './DatabaseView';
import type { Block, Comment } from '../types';
import {
  Menu, History, MessageSquare, FileCode, Globe, Lock, Users,
  Link2, Send, RotateCcw,
} from 'lucide-react';
import { cachePage, getCachedPage, queueOperation } from '../lib/offline';

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
  const [showComments, setShowComments] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; title: string; created_at: number; author_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    loadPage();
    loadComments();
  }, [loadPage]);

  const loadComments = async () => {
    if (!pageId) return;
    try {
      const { comments: c } = await api.getComments(pageId);
      setComments(c);
    } catch { /* offline */ }
  };

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
    }
    setMarkdownMode(!markdownMode);
  };

  const loadVersionHistory = async () => {
    if (!pageId) return;
    const { versions: v } = await api.getVersions(pageId);
    setVersions(v);
    setShowVersions(true);
  };

  const restoreVersion = async (versionId: string) => {
    if (!pageId) return;
    const { blocks: restored } = await api.restoreVersion(pageId, versionId);
    setBlocks(restored);
    setEditorContent(blocksToTiptapHtml(restored));
    setShowVersions(false);
  };

  const submitComment = async () => {
    if (!pageId || !newComment.trim()) return;
    await api.addComment(pageId, newComment);
    setNewComment('');
    loadComments();
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-mid-gray">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
          )}

          {saving && <span className="text-xs text-mid-gray">Saving...</span>}

          <select
            value={visibility}
            onChange={(e) => { setVisibility(e.target.value); api.updatePage(pageId!, { visibility: e.target.value }); }}
            className="text-xs bg-linen rounded-lg px-2 py-1 border-none outline-none"
          >
            <option value="private">🔒 Private</option>
            <option value="shared">👥 Shared</option>
            <option value="public">🌐 Public</option>
          </select>

          <button onClick={toggleMarkdown} className={`p-2 rounded-lg ${markdownMode ? 'bg-sage/30' : 'hover:bg-linen'}`} title="Markdown mode">
            <FileCode className="w-4 h-4" />
          </button>
          <button onClick={loadVersionHistory} className="p-2 rounded-lg hover:bg-linen" title="Version history">
            <History className="w-4 h-4" />
          </button>
          <button onClick={() => setShowComments(!showComments)} className="p-2 rounded-lg hover:bg-linen" title="Comments">
            <MessageSquare className="w-4 h-4" />
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
              onBlur={() => api.saveMarkdown(pageId!, markdown).then(() => loadPage())}
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

        {showComments && (
          <aside className="w-80 border-l border-green-mist bg-warm-white flex flex-col">
            <div className="p-4 border-b border-green-mist font-medium text-sm">Comments</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="font-medium text-charcoal">{c.author_name}</div>
                  <div className="text-warm-gray mt-1">{c.content}</div>
                  <div className="text-xs text-mid-gray mt-1">
                    {new Date(c.created_at * 1000).toLocaleString()}
                  </div>
                </div>
              ))}
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
          </aside>
        )}
      </div>

      {showVersions && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowVersions(false)}>
          <div className="card-surface w-full max-w-md max-h-96 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5" /> Version History
            </h3>
            {versions.length === 0 ? (
              <p className="text-mid-gray text-sm">No versions yet.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-linen">
                    <div>
                      <div className="text-sm font-medium">{v.title || 'Untitled'}</div>
                      <div className="text-xs text-mid-gray">
                        {v.author_name} · {new Date(v.created_at * 1000).toLocaleString()}
                      </div>
                    </div>
                    <button onClick={() => restoreVersion(v.id)} className="btn-secondary text-xs flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
