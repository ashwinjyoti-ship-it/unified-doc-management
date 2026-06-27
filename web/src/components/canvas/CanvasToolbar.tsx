import React, { useState } from 'react';
import type { ComponentType } from '../../lib/canvas-types';
import { VIEWPORT_PRESETS } from '../../lib/canvas-types';

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onAddComponent: (type: ComponentType) => void;
  activeViewport: 'desktop' | 'mobile' | null;
  onViewportChange: (v: 'desktop' | 'mobile' | null) => void;
}

const COMPONENT_TYPES: { type: ComponentType; label: string }[] = [
  { type: 'frame', label: 'Frame' },
  { type: 'rect', label: 'Rectangle' },
  { type: 'text', label: 'Text' },
  { type: 'button', label: 'Button' },
  { type: 'input', label: 'Input' },
  { type: 'image', label: 'Image' },
  { type: 'group', label: 'Group' },
];

export function CanvasToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onAddComponent,
  activeViewport,
  onViewportChange,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Add component */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setAddOpen(!addOpen)}
          style={btnStyle}
        >
          + Add
        </button>
        {addOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              minWidth: 140,
              zIndex: 100,
            }}
          >
            {COMPONENT_TYPES.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => { onAddComponent(type); setAddOpen(false); }}
                style={{ ...menuItemStyle }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />

      {/* Zoom controls */}
      <button onClick={onZoomOut} style={btnStyle}>−</button>
      <span
        onClick={onZoomReset}
        style={{ fontSize: 12, color: '#6b7280', minWidth: 44, textAlign: 'center', cursor: 'pointer' }}
      >
        {Math.round(scale * 100)}%
      </span>
      <button onClick={onZoomIn} style={btnStyle}>+</button>

      <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />

      {/* Viewport switcher */}
      {VIEWPORT_PRESETS.map((p) => {
        const key = p.label.toLowerCase() as 'desktop' | 'mobile';
        const active = activeViewport === key;
        return (
          <button
            key={key}
            onClick={() => onViewportChange(active ? null : key)}
            style={{
              ...btnStyle,
              background: active ? '#004228' : undefined,
              color: active ? '#fff' : undefined,
            }}
            title={`${p.label} (${p.width}×${p.height})`}
          >
            {p.label}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 11, color: '#9ca3af' }}>
        Space+drag to pan · Scroll to zoom · Click to select · Double-click to comment
      </span>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 4,
  background: '#f9fafb',
  color: '#374151',
  cursor: 'pointer',
  lineHeight: '1.4',
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  border: 'none',
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  color: '#374151',
};
