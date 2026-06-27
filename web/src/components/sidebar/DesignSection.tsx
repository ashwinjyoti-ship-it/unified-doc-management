import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Plus } from 'lucide-react';
import type { Page } from '../../types';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store';
import { pageItemClass } from '../../lib/pageSelection';
import CollapsibleSidebarSection from '../CollapsibleSidebarSection';
import ConfirmDialog from '../ConfirmDialog';
import SidebarItemMenu from '../SidebarItemMenu';
import Tooltip from '../Tooltip';
import { CanvasContextMenu } from './CanvasContextMenu';
import { buildDeleteConfirmMessage, getDeleteOrder } from '../../lib/pageDelete';
import { closeSidebarOnMobile } from '../../lib/device';

interface Props {
  pages: Page[];
  currentPageId?: string | null;
  onRefresh: () => Promise<void>;
}

export function DesignSection({ pages, currentPageId, onRefresh }: Props) {
  const navigate = useNavigate();
  const workspace = useStore((s) => s.workspace);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; page: Page } | null>(null);
  const [confirmReset, setConfirmReset] = useState<Page | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canvasPages = pages.filter((p) => p.type === 'canvas');

  const createCanvas = async () => {
    if (!workspace || creating) return;
    setCreating(true);
    try {
      const res = await api.createPage(workspace.id, { title: 'Untitled Canvas', type: 'canvas' });
      await onRefresh();
      navigate(`/canvas/${res.page.id}`);
      closeSidebarOnMobile(setSidebarOpen);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not create canvas');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (page: Page) => {
    await api.duplicatePage(page.id);
    await onRefresh();
  };

  const handleReset = async (page: Page) => {
    await fetch(`/api/pages/${page.id}/canvas/reset?confirm=true`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    setConfirmReset(null);
  };

  const handleDelete = async (page: Page) => {
    const idsToDelete = getDeleteOrder(pages, page.id);
    setDeleting(true);
    try {
      if (idsToDelete.length === 1) {
        await api.deletePage(page.id);
      } else {
        await api.bulkPages('delete', idsToDelete);
      }
      useStore.getState().removePagesFromStore(idsToDelete);
      await onRefresh();
      if (currentPageId === page.id) navigate('/', { replace: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete canvas');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const newCanvasButton = (
    <Tooltip text="Create a new design canvas">
      <button
        type="button"
        onClick={() => void createCanvas()}
        disabled={creating}
        className="p-1.5 mr-1 rounded-md text-mid-gray hover:text-charcoal hover:bg-linen disabled:opacity-50"
        aria-label="New canvas"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </Tooltip>
  );

  return (
    <>
      <CollapsibleSidebarSection
        id="design"
        title="Design"
        icon={<Layout className="w-3 h-3" />}
        tooltip="UI design canvases for wireframes and mockups — click to collapse"
        count={canvasPages.length}
        showWhenEmpty
        isEmpty={canvasPages.length === 0}
        headerAction={newCanvasButton}
      >
        <div className="space-y-0.5">
          {canvasPages.length === 0 ? (
            <div className="px-3 py-2 text-center">
              <p className="text-xs text-mid-gray mb-2">No design canvases yet</p>
              <button
                type="button"
                onClick={() => void createCanvas()}
                disabled={creating}
                className="btn-primary text-xs px-3 py-1.5"
              >
                {creating ? 'Creating…' : '+ New canvas'}
              </button>
            </div>
          ) : (
            canvasPages.map((page) => {
              const active = currentPageId === page.id;
              return (
                <div key={page.id} className="group flex items-center min-w-0 pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/canvas/${page.id}`);
                      closeSidebarOnMobile(setSidebarOpen);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, page });
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`${pageItemClass(active, 'py-1.5 flex-1 min-w-0')}`}
                  >
                    <span>{page.icon || '🎨'}</span>
                    <span className="truncate flex-1 text-left">{page.title}</span>
                  </button>
                  <SidebarItemMenu
                    label={page.title}
                    onDelete={() => setDeleteTarget(page)}
                    light={active}
                  />
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSidebarSection>

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Duplicate',
              onClick: () => { void handleDuplicate(contextMenu.page); },
            },
            {
              label: 'Reset canvas…',
              onClick: () => setConfirmReset(contextMenu.page),
            },
            {
              label: 'Delete',
              onClick: () => setDeleteTarget(contextMenu.page),
              danger: true,
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmReset)}
        title="Reset canvas?"
        message={confirmReset
          ? `All components on "${confirmReset.title}" will be deleted. Design tokens are preserved.`
          : ''}
        confirmLabel="Reset"
        destructive
        onConfirm={() => { if (confirmReset) void handleReset(confirmReset); }}
        onCancel={() => setConfirmReset(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete canvas"
        message={deleteTarget ? buildDeleteConfirmMessage(pages, deleteTarget) : ''}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget); }}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </>
  );
}
