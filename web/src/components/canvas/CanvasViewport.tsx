import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { CanvasComponent } from '../../lib/canvas-types';
import { ComponentRenderer } from './ComponentRenderer';

interface Props {
  components: CanvasComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenComment: (componentId: string) => void;
}

export function CanvasViewport({ components, selectedId, onSelect, onOpenComment }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const spaceDown = useRef(false);

  // Wheel to zoom
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((s) => Math.min(4, Math.max(0.1, s * factor)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Space + drag to pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceDown.current = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        if (containerRef.current) containerRef.current.style.cursor = 'default';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (spaceDown.current) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  };

  const onMouseUp = () => {
    setIsPanning(false);
    if (containerRef.current) containerRef.current.style.cursor = spaceDown.current ? 'grab' : 'default';
  };

  const roots = components.filter((c) => c.parentId === null).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: '#f3f4f6',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={() => onSelect(null)}
    >
      {/* Dot grid background */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" x={pan.x % (20 * scale)} y={pan.y % (20 * scale)} width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={0.8} fill="#d1d5db" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Canvas content */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        {roots.map((comp) => (
          <ComponentRenderer
            key={comp.id}
            component={comp}
            allComponents={components}
            selectedId={selectedId}
            onSelect={onSelect}
            onOpenComment={onOpenComment}
            scale={scale}
          />
        ))}

        {components.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: 80,
              left: 0,
              color: '#9ca3af',
              fontSize: 14,
              textAlign: 'center',
              width: 400,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>
            <div style={{ fontWeight: 600, color: '#6b7280' }}>Canvas is empty</div>
            <div style={{ marginTop: 4 }}>Use the toolbar to add components, or let an agent build for you.</div>
          </div>
        )}
      </div>

      {/* Scale indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
