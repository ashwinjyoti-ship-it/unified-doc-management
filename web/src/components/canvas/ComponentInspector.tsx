import React, { useState } from 'react';
import type { CanvasComponent, CanvasToken } from '../../lib/canvas-types';
import { updateComponent } from '../../lib/canvas-api';

interface Props {
  component: CanvasComponent;
  tokens: CanvasToken[];
  pageId: string;
  onUpdated: (c: CanvasComponent) => void;
}

export function ComponentInspector({ component, tokens, pageId, onUpdated }: Props) {
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const displayComponent = (() => {
    if (!activeVariant) return component;
    const variant = component.variants.find((v) => v.name === activeVariant);
    if (!variant) return component;
    return {
      ...component,
      props: { ...component.props, ...variant.props },
      styles: { ...component.styles, ...variant.styles },
    };
  })();

  const swapToken = async (styleKey: string, tokenName: string) => {
    setSaving(true);
    try {
      const result = await updateComponent(pageId, component.id, {
        styles: { ...component.styles, [styleKey]: `var(--${tokenName.replace(/\./g, '-')})` },
      });
      onUpdated(result.component);
    } finally {
      setSaving(false);
    }
  };

  const styles = displayComponent.styles;
  const styleEntries = Object.entries(styles);

  return (
    <div
      style={{
        width: 260,
        borderLeft: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11, color: '#6b7280' }}>Selected</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginTop: 2 }}>{component.name}</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{component.type} · {component.size.w}×{component.size.h}</div>
      </div>

      {/* Variant Tabs */}
      {component.variants.length > 0 && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Variants</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              onClick={() => setActiveVariant(null)}
              style={variantBtnStyle(activeVariant === null)}
            >
              Default
            </button>
            {component.variants.map((v) => (
              <button
                key={v.name}
                onClick={() => setActiveVariant(v.name === activeVariant ? null : v.name)}
                style={variantBtnStyle(activeVariant === v.name)}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Styles + Token Inspector */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Styles
        </div>

        {styleEntries.length === 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>No styles applied</div>
        )}

        {styleEntries.map(([key, value]) => {
          const isTokenRef = value.startsWith('var(--');
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{key}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {key === 'background' || key === 'color' || key === 'borderColor' ? (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      background: isTokenRef ? 'transparent' : value,
                      border: '1px solid #e5e7eb',
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: isTokenRef ? '#7c3aed' : '#111827',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {value}
                </span>
              </div>

              {/* Token swap dropdown */}
              {tokens.length > 0 && (
                <select
                  disabled={saving}
                  onChange={(e) => e.target.value && swapToken(key, e.target.value)}
                  defaultValue=""
                  style={{ marginTop: 4, fontSize: 11, width: '100%', padding: '2px 4px', border: '1px solid #e5e7eb', borderRadius: 4 }}
                >
                  <option value="">Swap to token…</option>
                  {tokens.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} = {t.value}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}

        {/* Props */}
        {Object.keys(displayComponent.props).length > 0 && (
          <>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, marginTop: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Props
            </div>
            {Object.entries(displayComponent.props).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{k}: </span>
                <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{String(v)}</span>
              </div>
            ))}
          </>
        )}

        {/* Position/Size */}
        <div style={{ marginTop: 16, fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Layout
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['X', component.position.x],
            ['Y', component.position.y],
            ['W', component.size.w],
            ['H', component.size.h],
          ].map(([label, val]) => (
            <div key={label as string} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 8px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>{label}</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function variantBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 8px',
    fontSize: 11,
    borderRadius: 4,
    border: '1px solid',
    borderColor: active ? '#004228' : '#e5e7eb',
    background: active ? '#004228' : '#f9fafb',
    color: active ? '#fff' : '#374151',
    cursor: 'pointer',
  };
}
