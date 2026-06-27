import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Page } from '../../types';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store';
import { CanvasContextMenu } from './CanvasContextMenu';

const COLLAPSED_KEY = 'design-section-collapsed';

function CanvasIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="3" y="3" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.7" />
      <rect x="8" y="3" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="3" y="8.5" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

interface Props {
  pages: Page[];
  currentPageId?: string;
  onRefresh: () => void;
}

export function DesignSection({ pages, currentPageId, onRefresh }: Props) {
  const navigate = useNavigate();
  const workspace = useStore((s) => s.workspace);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) !== 'false');
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; page: Page } | null>(null);
  const [confirmReset, setConfirmReset] = useState<Page | null>(null);

  const canvasPages = pages.filter((p) => p.type === 'canvas');

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
  };

  const createCanvas = async () => {
    if (!workspace || creating) return;
    setCreating(true);
    try {
      const res = await api.createPage(workspace.id, { title: 'Untitled Canvas', type: 'canvas' });
      await onRefresh();
      navigate(`/canvas/${res.page.id}`);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, page: Page) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, page });
  };

  const handleDuplicate = async (page: Page) => {
    await fetch(`/api/pages/${page.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
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
    await fetch(`/api/pages/${page.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    await onRefresh();
    if (currentPageId === page.id) navigate('/');
  };

  return (
    <div style={{ marginTop: 4 }}>
      {/* Section header */}
      <div
        onClick={toggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          color: '#6b7280',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        <span style={{ fontSize: 9, transform: collapsed ? 'rotate(-90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▾</span>
        <span>Design</span>
        {canvasPages.length > 0 && (
          <span style={{ background: '#e5e7eb', borderRadius: 8, padding: '0 5px', fontSize: 10, color: '#6b7280', fontWeight: 500 }}>
            {canvasPages.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={(e) => { e.stopPropagation(); createCanvas(); }}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', lineHeight: 1, padding: '0 2px' }}
          title="New canvas"
        >
          +
        </button>
      </div>

      {!collapsed && (
        <div>
          {canvasPages.length === 0 ? (
            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>No design canvases yet</div>
              <button
                onClick={createCanvas}
                disabled={creating}
                style={{
                  fontSize: 12,
                  padding: '5px 12px',
                  border: '1px solid #004228',
                  borderRadius: 6,
                  background: '#004228',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {creating ? 'Creating…' : '+ New canvas'}
              </button>
            </div>
          ) : (
            canvasPages.map((page) => (
              <div
                key={page.id}
                onContextMenu={(e) => handleContextMenu(e, page)}
                onClick={() => navigate(`/canvas/${page.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 14px 5px 16px',
                  cursor: 'pointer',
                  fontSize: 13,
                  borderRadius: 6,
                  margin: '1px 4px',
                  background: currentPageId === page.id ? '#e8f5ef' : 'none',
                  color: currentPageId === page.id ? '#004228' : '#374151',
                }}
              >
                <span style={{ color: currentPageId === page.id ? '#004228' : '#9ca3af', flexShrink: 0 }}>
                  <CanvasIcon />
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {page.title}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Duplicate',
              onClick: () => handleDuplicate(contextMenu.page),
            },
            {
              label: 'Reset canvas…',
              onClick: () => setConfirmReset(contextMenu.page),
            },
            {
              label: 'Delete',
              onClick: () => handleDelete(contextMenu.page),
              danger: true,
            },
          ]}
        />
      )}

      {confirmReset && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setConfirmReset(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 10, padding: 24, width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Reset canvas?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              All components on <strong>{confirmReset.title}</strong> will be deleted. Design tokens are preserved.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmReset(null)} style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleReset(confirmReset)} style={{ padding: '6px 14px', fontSize: 13, border: 'none', borderRadius: 6, background: '#ef4444', color: '#fff', cursor: 'pointer' }}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
