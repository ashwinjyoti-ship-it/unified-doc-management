import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DatabaseView from './DatabaseView';

export default function DatabaseEmbedView({ node }: NodeViewProps) {
  const navigate = useNavigate();
  const databaseId = node.attrs.databaseId as string | null;
  const title = (node.attrs.title as string) || 'Database';

  if (!databaseId) {
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
            onClick={() => navigate(`/page/${databaseId}`)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-forest hover:underline"
          >
            Open full page
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        <div className="p-2 md:p-4 max-h-[min(70vh,640px)] overflow-auto">
          <DatabaseView pageId={databaseId} embedded />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
