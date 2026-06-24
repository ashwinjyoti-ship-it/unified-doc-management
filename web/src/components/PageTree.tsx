import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ChevronRight, ChevronDown, CheckSquare, Square, GripVertical,
} from 'lucide-react';
import type { Page } from '../types';
import { api } from '../lib/api';
import { canNestUnder, getChildren, pageIcon } from '../lib/pageTree';
import { pageTreeRowClass } from '../lib/pageSelection';

interface PageTreeProps {
  pages: Page[];
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onPagesChange: () => Promise<void>;
  onMoveRequest?: (pageIds: string[]) => void;
}

function TreeRow({
  page,
  pages,
  depth,
  bulkMode,
  selected,
  onToggleSelect,
  activeDragId,
  overDropId,
}: {
  page: Page;
  pages: Page[];
  depth: number;
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  activeDragId: string | null;
  overDropId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const { pageId } = useParams();
  const children = getChildren(pages, page.id);
  const isActive = pageId === page.id;
  const isSelected = selected?.has(page.id);
  const dropId = `nest-${page.id}`;
  const isDropTarget = overDropId === dropId && activeDragId !== page.id;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: page.id,
    disabled: bulkMode,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId });

  const setRefs = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const highlight = isDropTarget || (isOver && activeDragId && activeDragId !== page.id);

  return (
    <div className={isDragging ? 'opacity-40' : ''}>
      <div
        ref={setRefs}
        className={`${pageTreeRowClass(isActive)} ${highlight ? 'ring-2 ring-forest/50 bg-sage/20' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {!bulkMode && (
          <button
            type="button"
            className="p-0.5 shrink-0 cursor-grab active:cursor-grabbing text-mid-gray hover:text-charcoal touch-none"
            {...listeners}
            {...attributes}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        {bulkMode && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(page.id); }}
            className="p-1 shrink-0"
          >
            {isSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-forest" />
            ) : (
              <Square className="w-3.5 h-3.5 text-mid-gray" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/page/${page.id}`)}
          className="flex-1 flex items-center gap-2 px-1 py-1.5 min-w-0"
        >
          {children.length > 0 ? (
            <span
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="cursor-pointer shrink-0"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className="shrink-0">{pageIcon(page)}</span>
          <span className="truncate flex-1 text-left">{page.title}</span>
        </button>
      </div>
      {expanded && children.map((child) => (
        <TreeRow
          key={child.id}
          page={child}
          pages={pages}
          depth={depth + 1}
          bulkMode={bulkMode}
          selected={selected}
          onToggleSelect={onToggleSelect}
          activeDragId={activeDragId}
          overDropId={overDropId}
        />
      ))}
    </div>
  );
}

function RootDropZone({ activeDragId, overDropId }: { activeDragId: string | null; overDropId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'nest-root' });
  const highlight = overDropId === 'nest-root' || isOver;

  if (!activeDragId) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mx-2 mb-2 px-3 py-2 rounded-lg border-2 border-dashed text-xs text-center transition-colors ${
        highlight
          ? 'border-forest bg-sage/20 text-forest font-medium'
          : 'border-green-mist text-mid-gray'
      }`}
    >
      Drop here for top level
    </div>
  );
}

export default function PageTree({
  pages,
  bulkMode,
  selected,
  onToggleSelect,
  onPagesChange,
}: PageTreeProps) {
  const rootPages = getChildren(pages, null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragOver = useCallback((event: { over: { id: string | number } | null }) => {
    setOverDropId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setOverDropId(null);
    if (!over) return;

    const draggedId = String(active.id);
    let newParentId: string | null = null;

    const overId = String(over.id);
    if (overId === 'nest-root') {
      newParentId = null;
    } else if (overId.startsWith('nest-')) {
      newParentId = overId.slice('nest-'.length);
    } else {
      return;
    }

    if (!canNestUnder(pages, draggedId, newParentId)) return;

    const dragged = pages.find((p) => p.id === draggedId);
    if (!dragged || dragged.parent_id === newParentId) return;

    try {
      await api.updatePage(draggedId, { parentId: newParentId });
      await onPagesChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not move page');
    }
  };

  const draggedPage = activeDragId ? pages.find((p) => p.id === activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveDragId(null); setOverDropId(null); }}
    >
      <RootDropZone activeDragId={activeDragId} overDropId={overDropId} />
      {rootPages.map((page) => (
        <TreeRow
          key={page.id}
          page={page}
          pages={pages}
          depth={0}
          bulkMode={bulkMode}
          selected={selected}
          onToggleSelect={onToggleSelect}
          activeDragId={activeDragId}
          overDropId={overDropId}
        />
      ))}
      <DragOverlay>
        {draggedPage ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-warm-white border border-forest rounded-lg shadow-lg text-sm font-medium">
            <span>{pageIcon(draggedPage)}</span>
            <span>{draggedPage.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
