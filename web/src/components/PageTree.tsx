import { useState, useCallback, useMemo, useRef } from 'react';
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
import { canNestUnder, buildChildrenIndex, getRootProjects, getStandalonePages, pageIcon } from '../lib/pageTree';
import { useStore } from '../lib/store';
import { pageTreeRowClass } from '../lib/pageSelection';
import CollapsibleSidebarSection from './CollapsibleSidebarSection';
import SidebarItemMenu from './SidebarItemMenu';
import Tooltip from './Tooltip';

interface PageTreeProps {
  pages: Page[];
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onPagesChange: () => Promise<void>;
  onNavigate: (pageId: string) => void;
  onRename: (page: Page) => void;
  onDelete: (page: Page) => void;
  activePageId: string | null;
}

function FlatPageRow({
  page,
  bulkMode,
  selected,
  onToggleSelect,
  onNavigate,
  onRename,
  onDelete,
  activePageId,
}: {
  page: Page;
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onNavigate: (pageId: string) => void;
  onRename: (page: Page) => void;
  onDelete: (page: Page) => void;
  activePageId: string | null;
}) {
  const isActive = activePageId === page.id;
  const isSelected = selected?.has(page.id);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: page.id,
    disabled: bulkMode,
  });

  return (
    <div className={isDragging ? 'opacity-40' : ''}>
      <div
        ref={setNodeRef}
        className={`group ${pageTreeRowClass(isActive)}`}
        style={{ paddingLeft: '12px' }}
      >
        {!bulkMode && (
          <Tooltip text="Drag to move this page">
            <button
              type="button"
              className="p-0.5 shrink-0 cursor-grab active:cursor-grabbing text-mid-gray hover:text-charcoal touch-none"
              {...listeners}
              {...attributes}
              aria-label="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
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
          aria-current={isActive ? 'page' : undefined}
          className="flex-1 flex items-center gap-2 px-1 py-1.5 min-w-0"
        >
          <span className="w-3 shrink-0" />
          <span className="shrink-0">{pageIcon(page)}</span>
          <span className="truncate flex-1 text-left">{page.title}</span>
        </button>
        <SidebarItemMenu
          label={page.title}
          onRename={() => onRename(page)}
          onDelete={() => onDelete(page)}
          disabled={bulkMode}
          light={isActive}
        />
      </div>
    </div>
  );
}

function TreeRow({
  page,
  childrenIndex,
  depth,
  bulkMode,
  selected,
  onToggleSelect,
  activeDragId,
  overDropId,
  onNavigate,
  onRename,
  onDelete,
  isProjectRoot = false,
  activePageId,
}: {
  page: Page;
  childrenIndex: Map<string | null, Page[]>;
  depth: number;
  bulkMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  activeDragId: string | null;
  overDropId: string | null;
  onNavigate: (pageId: string) => void;
  onRename: (page: Page) => void;
  onDelete: (page: Page) => void;
  isProjectRoot?: boolean;
  activePageId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childrenIndex.get(page.id) ?? [];
  const isActive = activePageId === page.id;
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
        className={`group ${pageTreeRowClass(isActive)} ${highlight && !isActive ? 'ring-2 ring-forest/50 bg-sage/20' : ''} ${isProjectRoot ? 'font-semibold' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {!bulkMode && (
          <Tooltip text="Drag to move this page into a folder or pages">
            <button
              type="button"
              className="p-0.5 shrink-0 cursor-grab active:cursor-grabbing text-mid-gray hover:text-charcoal touch-none"
              {...listeners}
              {...attributes}
              aria-label="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
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
          aria-current={isActive ? 'page' : undefined}
          className="flex-1 flex items-center gap-2 px-1 py-1.5 min-w-0"
        >
          {children.length > 0 ? (
            <Tooltip text={expanded ? 'Collapse nested pages' : 'Expand nested pages'}>
              <span
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="cursor-pointer shrink-0"
              >
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </span>
            </Tooltip>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className="shrink-0">{pageIcon(page)}</span>
          <span className="truncate flex-1 text-left">{page.title}</span>
        </button>
        <SidebarItemMenu
          label={page.title}
          onRename={() => onRename(page)}
          onDelete={() => onDelete(page)}
          disabled={bulkMode}
          light={isActive}
        />
      </div>
      {expanded && children.map((child) => (
        <TreeRow
          key={child.id}
          page={child}
          childrenIndex={childrenIndex}
          depth={depth + 1}
          bulkMode={bulkMode}
          selected={selected}
          onToggleSelect={onToggleSelect}
          activeDragId={activeDragId}
          overDropId={overDropId}
          onNavigate={onNavigate}
          onRename={onRename}
          onDelete={onDelete}
          activePageId={activePageId}
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
  if (zoneId === 'nest-pages-root') return page.type !== 'folder';
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
  onRename,
  onDelete,
  activePageId,
}: PageTreeProps) {
  const patchPageInStore = useStore((s) => s.patchPageInStore);
  const childrenIndex = useMemo(() => buildChildrenIndex(pages), [pages]);
  const projects = getRootProjects(pages);
  const standalonePages = getStandalonePages(pages);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);
  const overDropRaf = useRef<number | null>(null);
  const pendingOverId = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const next = event.over ? String(event.over.id) : null;
    pendingOverId.current = next;
    if (overDropRaf.current != null) return;
    overDropRaf.current = requestAnimationFrame(() => {
      overDropRaf.current = null;
      setOverDropId(pendingOverId.current);
    });
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
    if (overId === 'nest-root' || overId === 'nest-project-root' || overId === 'nest-pages-root') {
      if (!canDropOnRootZone(overId, dragged)) return;
      newParentId = null;
    } else if (overId.startsWith('nest-')) {
      newParentId = overId.slice('nest-'.length);
    } else {
      return;
    }

    if (!canNestUnder(pages, draggedId, newParentId)) return;
    if (dragged.parent_id === newParentId) return;

    patchPageInStore(draggedId, { parent_id: newParentId });
    try {
      await api.updatePage(draggedId, { parentId: newParentId });
    } catch (err) {
      patchPageInStore(draggedId, { parent_id: dragged.parent_id });
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
      <CollapsibleSidebarSection
        id="projects"
        title="Projects"
        tooltip="Top-level project folders — click to collapse"
        count={projects.length}
        showWhenEmpty
        isEmpty={projects.length === 0}
      >
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
            childrenIndex={childrenIndex}
            depth={0}
            bulkMode={bulkMode}
            selected={selected}
            onToggleSelect={onToggleSelect}
            activeDragId={activeDragId}
            overDropId={overDropId}
            onNavigate={onNavigate}
            onRename={onRename}
            onDelete={onDelete}
            isProjectRoot
            activePageId={activePageId}
          />
        ))}
      </CollapsibleSidebarSection>

      <CollapsibleSidebarSection
        id="pages"
        title="Pages"
        tooltip="Standalone pages not inside a project — click to collapse"
        count={standalonePages.length}
        showWhenEmpty
        isEmpty={standalonePages.length === 0}
      >
        <RootDropZone
          id="nest-pages-root"
          label="Drop here for a standalone page"
          activeDragId={activeDragId}
          overDropId={overDropId}
          draggedPage={draggedPage}
        />
        {standalonePages.length === 0 && !activeDragId && (
          <p className="px-3 py-2 text-xs text-mid-gray">Standalone pages appear here — use New → New Page</p>
        )}
        {standalonePages.map((page) => (
          <FlatPageRow
            key={page.id}
            page={page}
            bulkMode={bulkMode}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onNavigate={onNavigate}
            onRename={onRename}
            onDelete={onDelete}
            activePageId={activePageId}
          />
        ))}
      </CollapsibleSidebarSection>

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
