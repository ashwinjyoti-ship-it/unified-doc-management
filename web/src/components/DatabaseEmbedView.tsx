import { useEffect, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { ExternalLink } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import DatabaseView from './DatabaseView';

export default function DatabaseEmbedView({ node, editor, getPos }: NodeViewProps) {
  const navigate = useNavigate();
  const { pageId: hostPageId } = useParams<{ pageId: string }>();
  const loadPages = useStore((s) => s.loadPages);
  const databaseId = node.attrs.databaseId as string | null;
  const title = (node.attrs.title as string) || 'Database';

  const [resolvedDatabaseId, setResolvedDatabaseId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

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
          <button
            type="button"
            onClick={() => navigate(`/page/${resolvedDatabaseId}`)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-forest hover:underline"
          >
            Open full page
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        <div className="p-2 md:p-4 max-h-[min(70vh,640px)] overflow-auto">
          <DatabaseView pageId={resolvedDatabaseId} embedded hostPageId={hostPageId} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
