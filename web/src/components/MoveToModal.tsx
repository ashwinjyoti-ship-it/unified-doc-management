import { useState } from 'react';
import { ChevronRight, ChevronDown, FolderRoot } from 'lucide-react';
import type { Page } from '../types';
import { canNestUnder, getChildren, getRootProjects, pageIcon } from '../lib/pageTree';

interface MoveToModalProps {
  open: boolean;
  pages: Page[];
  excludeIds: string[];
  title?: string;
  onClose: () => void;
  onConfirm: (parentId: string | null) => void;
}

function MoveTreeNode({
  page,
  pages,
  depth,
  excludeIds,
  selectedId,
  onSelect,
}: {
  page: Page;
  pages: Page[];
  depth: number;
  excludeIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = getChildren(pages, page.id).filter((c) => !excludeIds.has(c.id));
  const disabled = excludeIds.has(page.id);

  if (disabled) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(page.id)}
        className={`w-full flex items-center gap-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
          selectedId === page.id ? 'bg-forest/15 text-forest font-medium' : 'hover:bg-linen'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {children.length > 0 ? (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="shrink-0 cursor-pointer"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0">{pageIcon(page)}</span>
        <span className="truncate">{page.title}</span>
      </button>
      {expanded && children.map((child) => (
        <MoveTreeNode
          key={child.id}
          page={child}
          pages={pages}
          depth={depth + 1}
          excludeIds={excludeIds}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default function MoveToModal({
  open,
  pages,
  excludeIds,
  title = 'Move to',
  onClose,
  onConfirm,
}: MoveToModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const excludeSet = new Set(excludeIds);

  if (!open) return null;

  const canMove =
    excludeIds.length === 0 ||
    excludeIds.every((id) => canNestUnder(pages, id, selectedId, excludeSet));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-surface w-full max-w-md p-6 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-sm text-mid-gray mb-4">
          Move to inbox, a project, or a folder inside a project.
        </p>

        <div className="flex-1 overflow-y-auto border border-green-mist rounded-xl p-2 mb-4 min-h-[120px] max-h-[320px]">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
              selectedId === null ? 'bg-forest/15 text-forest font-medium' : 'hover:bg-linen'
            }`}
          >
            <FolderRoot className="w-4 h-4 shrink-0" />
            <span>Inbox (unfiled pages)</span>
          </button>
          {getRootProjects(pages)
            .filter((p) => !excludeSet.has(p.id))
            .map((page) => (
              <MoveTreeNode
                key={page.id}
                page={page}
                pages={pages}
                depth={0}
                excludeIds={excludeSet}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
        </div>

        {!canMove && (
          <p className="text-xs text-red-600 mb-3">Cannot move a folder into itself or its descendants.</p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedId)}
            disabled={!canMove}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}
