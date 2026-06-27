import React from 'react';
import type { CanvasComponent } from '../../lib/canvas-types';

interface Props {
  component: CanvasComponent;
  allComponents: CanvasComponent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenComment: (id: string) => void;
  scale: number;
}

function resolveStyles(styles: Record<string, string>): React.CSSProperties {
  const result: React.CSSProperties = {};
  for (const [key, value] of Object.entries(styles)) {
    (result as Record<string, string>)[key] = value;
  }
  return result;
}

function ComponentNode({ component, allComponents, selectedId, onSelect, onOpenComment, scale }: Props) {
  const children = allComponents.filter((c) => c.parentId === component.id);
  const isSelected = selectedId === component.id;

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: component.position.x,
    top: component.position.y,
    width: component.size.w,
    height: component.size.h,
    boxSizing: 'border-box',
    ...resolveStyles(component.styles),
  };

  const selectionStyle: React.CSSProperties = isSelected
    ? { outline: '2px solid #004228', outlineOffset: 1 }
    : {};

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(component.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenComment(component.id);
  };

  const renderInner = () => {
    switch (component.type) {
      case 'text':
        return (
          <span style={{ display: 'block', width: '100%', height: '100%', overflow: 'hidden' }}>
            {(component.props.text as string) || component.name}
          </span>
        );
      case 'button':
        return (
          <button
            style={{
              width: '100%',
              height: '100%',
              cursor: 'pointer',
              border: 'none',
              background: 'inherit',
              color: 'inherit',
              font: 'inherit',
              borderRadius: 'inherit',
            }}
            onClick={(e) => e.preventDefault()}
          >
            {(component.props.label as string) || component.name}
          </button>
        );
      case 'input':
        return (
          <input
            readOnly
            placeholder={(component.props.placeholder as string) || component.name}
            style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', boxSizing: 'border-box', padding: '0 8px' }}
          />
        );
      case 'image':
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 12,
            }}
          >
            {component.props.src ? (
              <img src={component.props.src as string} alt={component.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>Image</span>
            )}
          </div>
        );
      case 'rect':
      case 'frame':
      case 'group':
      default:
        return null;
    }
  };

  return (
    <div
      style={{ ...baseStyle, ...selectionStyle }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={`${component.name} (double-click to comment)`}
    >
      {renderInner()}
      {children
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((child) => (
          <ComponentNode
            key={child.id}
            component={child}
            allComponents={allComponents}
            selectedId={selectedId}
            onSelect={onSelect}
            onOpenComment={onOpenComment}
            scale={scale}
          />
        ))}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: 0,
            background: '#004228',
            color: '#fff',
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {component.name}
        </div>
      )}
    </div>
  );
}

export function ComponentRenderer({ component, allComponents, selectedId, onSelect, onOpenComment, scale }: Props) {
  return (
    <ComponentNode
      component={component}
      allComponents={allComponents}
      selectedId={selectedId}
      onSelect={onSelect}
      onOpenComment={onOpenComment}
      scale={scale}
    />
  );
}
