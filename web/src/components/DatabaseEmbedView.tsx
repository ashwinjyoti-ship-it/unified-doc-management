import { useEffect, useState, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import DatabaseView from './DatabaseView';
import ConfirmDialog from './ConfirmDialog';
import AlertDialog from './AlertDialog';

export default function DatabaseEmbedView({ node, editor, getPos }: NodeViewProps) {
  const navigate = useNavigate();
  const { pageId: hostPageId } = useParams<{ pageId: string }>();
  const loadPages = useStore((s) => s.loadPages);
  const removePageFromStore = useStore((s) => s.removePageFromStore);
  const databaseId = node.attrs.databaseId as string | null;
  const title = (node.attrs.title as string) || 'Database';

  const [resolvedDatabaseId, setResolvedDatabaseId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hostPageId) {
      setResolvedDatabaseId(databaseId);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setResolveError(null);

    void (async () => {
      try {
        const resolved = await api.resolveEmbeddedDatabase(hostPageId, databaseId || undefined);
        if (cancelled) return;
        setResolvedDatabaseId(resolved.databaseId);

        if (resolved.repaired || resolved.databaseId !== databaseId) {
          const pos = getPos();
          if (editor && typeof pos === 'number') {
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                databaseId: resolved.databaseId,
                title: resolved.title || title,
              }),
            );
          }
          await loadPages();
        }
      } catch (err) {
        if (cancelled) return;
        setResolvedDatabaseId(null);
        setResolveError(err instanceof Error ? err.message : 'Database not found');
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hostPageId, databaseId, editor, getPos, loadPages, node.attrs, title]);

  const removeEmbedFromEditor = useCallback(() => {
    if (!editor) return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  }, [editor, getPos, node.nodeSize]);

  const deleteInlineDatabase = useCallback(async () => {
    if (!resolvedDatabaseId || deleting) return;
    setDeleting(true);
    try {
      await api.deletePage(resolvedDatabaseId);
      removePageFromStore(resolvedDatabaseId);
      removeEmbedFromEditor();
      await loadPages();
      setConfirmDeleteOpen(false);
    } catch (err) {
      setAlertMessage(err instanceof Error ? err.message : 'Could not delete database');
    } finally {
      setDeleting(false);
    }
  }, [resolvedDatabaseId, deleting, removePageFromStore, removeEmbedFromEditor, loadPages]);

  if (resolving) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="rounded-xl border border-green-mist bg-linen/50 px-4 py-6 text-sm text-mid-gray text-center">
          Loading database…
        </div>
      </NodeViewWrapper>
    );
  }

  if (!resolvedDatabaseId || resolveError) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 text-center">
          {resolveError || 'Database embed is missing an id.'}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="database-embed my-6" data-drag-handle>
      <div
        className="rounded-xl border border-green-mist overflow-hidden bg-warm-white shadow-sm"
        contentEditable={false}
        suppressContentEditableWarning
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-green-mist bg-linen/40">
          <span className="text-sm font-medium text-charcoal truncate">🗃️ {title}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
              title="Remove database from page"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/page/${resolvedDatabaseId}`)}
              className="inline-flex items-center gap-1 text-xs text-forest hover:underline"
            >
              Open full page
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="p-2 md:p-4 max-h-[min(70vh,640px)] overflow-auto">
          <DatabaseView pageId={resolvedDatabaseId} embedded hostPageId={hostPageId} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete database"
        message={`Remove "${title}" from this page and delete all of its rows and columns?\n\nThis cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        destructive
        onConfirm={() => { void deleteInlineDatabase(); }}
        onCancel={() => { if (!deleting) setConfirmDeleteOpen(false); }}
      />

      <AlertDialog
        open={alertMessage != null}
        message={alertMessage ?? ''}
        onClose={() => setAlertMessage(null)}
      />
    </NodeViewWrapper>
  );
}
