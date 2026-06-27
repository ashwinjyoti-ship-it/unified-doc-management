import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { CanvasComponent, CanvasToken, CanvasMessage } from '../lib/canvas-types';
import * as canvasApi from '../lib/canvas-api';
import { CanvasViewport } from '../components/canvas/CanvasViewport';
import { CanvasToolbar } from '../components/canvas/CanvasToolbar';
import { ComponentInspector } from '../components/canvas/ComponentInspector';
import { AddCommentBox } from '../components/canvas/AddCommentBox';
import { CommentThread } from '../components/canvas/CommentThread';
import { useCanvasCollab } from '../hooks/useCanvasCollab';
import { useStore } from '../lib/store';
import type { ComponentType } from '../lib/canvas-types';

const DEFAULT_SIZES: Record<ComponentType, { w: number; h: number }> = {
  frame: { w: 1440, h: 900 },
  group: { w: 200, h: 200 },
  rect: { w: 200, h: 120 },
  text: { w: 200, h: 40 },
  button: { w: 160, h: 44 },
  input: { w: 240, h: 44 },
  image: { w: 200, h: 150 },
};

export function CanvasPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const user = useStore((s) => s.user);

  const [components, setComponents] = useState<CanvasComponent[]>([]);
  const [tokens, setTokens] = useState<CanvasToken[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentTargetId, setCommentTargetId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [allComments, setAllComments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [activeViewport, setActiveViewport] = useState<'desktop' | 'mobile' | null>(null);
  const [error, setError] = useState('');

  const fetchCanvas = useCallback(async () => {
    if (!pageId) return;
    try {
      const data = await canvasApi.getCanvas(pageId);
      setComponents(data.components);
      setTokens(data.tokens);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  const fetchComments = useCallback(async () => {
    if (!pageId) return;
    try {
      const data = await canvasApi.getAgentComments(pageId);
      setAllComments(data.comments);
    } catch {
      // ignore
    }
  }, [pageId]);

  useEffect(() => {
    fetchCanvas();
    fetchComments();
  }, [fetchCanvas, fetchComments]);

  const handleMessage = useCallback((msg: CanvasMessage) => {
    if (msg.type === 'canvas:component:add') {
      setComponents((prev) => {
        if (prev.find((c) => c.id === msg.payload.id)) return prev;
        return [...prev, msg.payload];
      });
    } else if (msg.type === 'canvas:component:update') {
      setComponents((prev) =>
        prev.map((c) => (c.id === msg.payload.id ? { ...c, ...(msg.payload.patch as Partial<CanvasComponent>) } : c)),
      );
    } else if (msg.type === 'canvas:component:remove') {
      setComponents((prev) => prev.filter((c) => c.id !== msg.payload.id));
      if (selectedId === msg.payload.id) setSelectedId(null);
    } else if (msg.type === 'canvas:token:update') {
      setTokens(msg.payload);
    } else if (msg.type === 'canvas:reset') {
      setComponents([]);
      setSelectedId(null);
    }
  }, [selectedId]);

  useCanvasCollab({
    pageId: pageId!,
    onMessage: handleMessage,
    userId: user?.id,
    userName: user?.name,
  });

  const handleAddComponent = async (type: ComponentType) => {
    if (!pageId) return;
    try {
      const result = await canvasApi.createComponent(pageId, {
        type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        size: DEFAULT_SIZES[type] || { w: 200, h: 100 },
        position: { x: 40 + Math.random() * 60, y: 40 + Math.random() * 60 },
        viewport: activeViewport,
      });
      setComponents((prev) => [...prev, result.component]);
      setSelectedId(result.component.id);
    } catch (e) {
      console.error('Failed to add component', e);
    }
  };

  const selectedComponent = components.find((c) => c.id === selectedId) || null;
  const commentTarget = components.find((c) => c.id === commentTargetId) || null;

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        Loading canvas…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
      <CanvasToolbar
        scale={scale}
        onZoomIn={() => setScale((s) => Math.min(4, s * 1.2))}
        onZoomOut={() => setScale((s) => Math.max(0.1, s / 1.2))}
        onZoomReset={() => setScale(1)}
        onAddComponent={handleAddComponent}
        activeViewport={activeViewport}
        onViewportChange={setActiveViewport}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <CanvasViewport
          components={
            activeViewport
              ? components.filter((c) => !c.viewport || c.viewport === activeViewport)
              : components
          }
          selectedId={selectedId}
          onSelect={setSelectedId}
          onOpenComment={(id) => setCommentTargetId(id)}
        />

        {selectedComponent && (
          <ComponentInspector
            component={selectedComponent}
            tokens={tokens}
            pageId={pageId!}
            onUpdated={(updated) => {
              setComponents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            }}
          />
        )}

        {/* Comments button */}
        <button
          onClick={() => { setShowThread(true); fetchComments(); }}
          style={{
            position: 'absolute',
            top: 12,
            right: selectedComponent ? 272 : 12,
            padding: '6px 12px',
            fontSize: 12,
            background: '#004228',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          💬 Comments {(allComments as { status: string }[]).filter((c) => c.status === 'open').length > 0
            ? `(${(allComments as { status: string }[]).filter((c) => c.status === 'open').length} open)`
            : ''}
        </button>
      </div>

      {commentTarget && (
        <AddCommentBox
          component={commentTarget}
          pageId={pageId!}
          onClose={() => setCommentTargetId(null)}
          onCommentAdded={fetchComments}
        />
      )}

      {showThread && (
        <CommentThread
          comments={allComments as import('../lib/canvas-types').CanvasComment[]}
          components={components}
          onClose={() => setShowThread(false)}
        />
      )}
    </div>
  );
}
