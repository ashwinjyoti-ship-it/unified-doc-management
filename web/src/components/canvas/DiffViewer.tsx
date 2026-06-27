import React from 'react';
import type { CanvasComponent } from '../../lib/canvas-types';

interface Props {
  before: CanvasComponent | Record<string, unknown>;
  after: CanvasComponent;
}

function parseStyles(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
  }
  return raw as Record<string, string>;
}

export function DiffViewer({ before, after }: Props) {
  const beforeStyles = parseStyles((before as Record<string, unknown>).styles);
  const afterStyles = parseStyles(after.styles as unknown);
  const beforeProps = parseStyles((before as Record<string, unknown>).props);
  const afterProps = parseStyles(after.props as unknown);

  const allStyleKeys = Array.from(new Set([...Object.keys(beforeStyles), ...Object.keys(afterStyles)]));
  const allPropKeys = Array.from(new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)]));
  const changedStyles = allStyleKeys.filter((k) => beforeStyles[k] !== afterStyles[k]);
  const changedProps = allPropKeys.filter((k) => beforeProps[k] !== afterProps[k]);

  if (changedStyles.length === 0 && changedProps.length === 0) {
    return <div style={{ fontSize: 12, color: '#6b7280', padding: 8 }}>No visual changes recorded.</div>;
  }

  const Row = ({ label, before: b, after: a }: { label: string; before?: string; after?: string }) => (
    <tr>
      <td style={{ padding: '3px 8px', fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{label}</td>
      <td style={{ padding: '3px 8px', fontSize: 11, background: '#fef2f2', color: '#ef4444', fontFamily: 'monospace' }}>
        {b ?? <em style={{ color: '#9ca3af' }}>—</em>}
      </td>
      <td style={{ padding: '3px 8px', fontSize: 11, background: '#f0fdf4', color: '#16a34a', fontFamily: 'monospace' }}>
        {a ?? <em style={{ color: '#9ca3af' }}>—</em>}
      </td>
    </tr>
  );

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Property</th>
            <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, color: '#ef4444', fontWeight: 500 }}>Before</th>
            <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, color: '#16a34a', fontWeight: 500 }}>After</th>
          </tr>
        </thead>
        <tbody>
          {changedStyles.map((k) => (
            <Row key={`style-${k}`} label={k} before={beforeStyles[k]} after={afterStyles[k]} />
          ))}
          {changedProps.map((k) => (
            <Row key={`prop-${k}`} label={k} before={String(beforeProps[k] ?? '')} after={String(afterProps[k] ?? '')} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
