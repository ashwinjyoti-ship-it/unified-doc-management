import { useEffect, useMemo } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { ExternalLink } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { resolveEmbeddedDatabaseId } from '../lib/embeddedDatabase';
import DatabaseView from './DatabaseView';

export default function DatabaseEmbedView({ node, editor, getPos }: NodeViewProps) {
  const navigate = useNavigate();
  const { pageId: hostPageId } = useParams<{ pageId: string }>();
  const pages = useStore((s) => s.pages);
  const databaseId = node.attrs.databaseId as string | null;
  const title = (node.attrs.title as string) || 'Database';

  const resolvedDatabaseId = useMemo(
    () => resolveEmbeddedDatabaseId(databaseId, hostPageId, pages),
    [databaseId, hostPageId, pages],
  );

  useEffect(() => {
    if (!editor || !resolvedDatabaseId || resolvedDatabaseId === databaseId) return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        databaseId: resolvedDatabaseId,
      }),
    );
  }, [editor, getPos, node.attrs, databaseId, resolvedDatabaseId]);

  if (!resolvedDatabaseId) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="rounded-xl border border-green-mist bg-linen/50 px-4 py-6 text-sm text-mid-gray text-center">
          Database embed is missing an id.
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
          <DatabaseView pageId={resolvedDatabaseId} embedded />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
