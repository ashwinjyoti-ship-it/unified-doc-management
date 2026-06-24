import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  ChevronRight, ChevronDown, CheckSquare, Square, GripVertical,
} from 'lucide-react';
import type { Page } from '../types';
import { api } from '../lib/api';
import { canNestUnder, getChildren, getInboxPages, getRootProjects, pageIcon } from '../lib/pageTree';
import { pageTreeRowClass } from '../lib/pageSelection';

interface PageTreeProps {
  pages: Page[];
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onPagesChange: () => Promise<void>;
  onNavigate: (pageId: string) => void;
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
  onNavigate,
  isProjectRoot = false,
}: {
  page: Page;
  pages: Page[];
  depth: number;
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  activeDragId: string | null;
  overDropId: string | null;
  onNavigate: (pageId: string) => void;
  isProjectRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
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
        className={`${pageTreeRowClass(isActive)} ${highlight && !isActive ? 'ring-2 ring-forest/50 bg-sage/20' : ''} ${isProjectRoot ? 'font-semibold' : ''}`}
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
          onClick={() => onNavigate(page.id)}
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
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function RootDropZone({
  id,
  label,
  activeDragId,
  overDropId,
  draggedPage,
}: {
  id: string;
  label: string;
  activeDragId: string | null;
  overDropId: string | null;
  draggedPage: Page | null | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const highlight = overDropId === id || isOver;

  if (!activeDragId || !draggedPage) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mx-2 mb-2 px-3 py-2 rounded-lg border-2 border-dashed text-xs text-center transition-colors ${
        highlight
          ? 'border-forest bg-sage/20 text-forest font-medium'
          : 'border-green-mist text-mid-gray'
      }`}
    >
      {label}
    </div>
  );
}

function canDropOnRootZone(zoneId: string, page: Page): boolean {
  if (zoneId === 'nest-project-root') return page.type === 'folder';
  if (zoneId === 'nest-inbox-root') return page.type !== 'folder';
  if (zoneId === 'nest-root') return true;
  return false;
}

export default function PageTree({
  pages,
  bulkMode,
  selected,
  onToggleSelect,
  onPagesChange,
  onNavigate,
}: PageTreeProps) {
  const projects = getRootProjects(pages);
  const inboxPages = getInboxPages(pages);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverDropId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setOverDropId(null);
    if (!over) return;

    const draggedId = String(active.id);
    const dragged = pages.find((p) => p.id === draggedId);
    if (!dragged) return;

    let newParentId: string | null = null;

    const overId = String(over.id);
    if (overId === 'nest-root' || overId === 'nest-project-root' || overId === 'nest-inbox-root') {
      if (!canDropOnRootZone(overId, dragged)) return;
      newParentId = null;
    } else if (overId.startsWith('nest-')) {
      newParentId = overId.slice('nest-'.length);
    } else {
      return;
    }

    if (!canNestUnder(pages, draggedId, newParentId)) return;
    if (dragged.parent_id === newParentId) return;

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
      <div className="mb-3">
        <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-mid-gray uppercase tracking-wide mb-1">
          Projects
        </div>
        <RootDropZone
          id="nest-project-root"
          label="Drop folder here for a new top-level project"
          activeDragId={activeDragId}
          overDropId={overDropId}
          draggedPage={draggedPage}
        />
        {projects.length === 0 && !activeDragId && (
          <p className="px-3 py-2 text-xs text-mid-gray">No projects yet — use New → New Project</p>
        )}
        {projects.map((page) => (
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
            onNavigate={onNavigate}
            isProjectRoot
          />
        ))}
      </div>

      <div>
        <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-mid-gray uppercase tracking-wide mb-1">
          Inbox
        </div>
        <RootDropZone
          id="nest-inbox-root"
          label="Drop here for inbox (daily notes, quick pages)"
          activeDragId={activeDragId}
          overDropId={overDropId}
          draggedPage={draggedPage}
        />
        {inboxPages.length === 0 && !activeDragId && (
          <p className="px-3 py-2 text-xs text-mid-gray">Unfiled pages and daily notes appear here</p>
        )}
        {inboxPages.map((page) => (
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
            onNavigate={onNavigate}
          />
        ))}
      </div>

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
