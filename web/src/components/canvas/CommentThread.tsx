import React, { useState } from 'react';
import type { CanvasComment, CanvasComponent } from '../../lib/canvas-types';
import { DiffViewer } from './DiffViewer';

interface Props {
  comments: CanvasComment[];
  components: CanvasComponent[];
  onClose: () => void;
}

export function CommentThread({ comments, components, onClose }: Props) {
  const [expandDiff, setExpandDiff] = useState<string | null>(null);

  const grouped: Record<string, CanvasComment[]> = {};
  for (const c of comments) {
    const key = c.anchor_id || 'page';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }

  const getComponentName = (id: string | null) => {
    if (!id) return 'Page';
    return components.find((c) => c.id === id)?.name || id.slice(0, 8);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: '#fff',
        borderLeft: '1px solid #e5e7eb',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Comments ({comments.length})</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>×</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {Object.entries(grouped).map(([anchorId, items]) => (
          <div key={anchorId} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {getComponentName(anchorId === 'page' ? null : anchorId)}
            </div>
            {items.map((comment) => {
              const showDiff = expandDiff === comment.id;
              const afterComp = comment.anchor_id ? components.find((c) => c.id === comment.anchor_id) : null;
              return (
                <div
                  key={comment.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                    background: comment.status === 'resolved' ? '#f0fdf4' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{comment.author_name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 10,
                        background: comment.status === 'resolved' ? '#dcfce7' : '#fef3c7',
                        color: comment.status === 'resolved' ? '#16a34a' : '#d97706',
                        fontWeight: 500,
                      }}
                    >
                      {comment.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>{comment.content}</div>
                  {comment.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                      {comment.tags.map((t) => (
                        <span key={t} style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 8 }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {comment.status === 'resolved' && comment.snapshot_before && afterComp && (
                    <div>
                      <button
                        onClick={() => setExpandDiff(showDiff ? null : comment.id)}
                        style={{ fontSize: 11, color: '#004228', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        {showDiff ? 'Hide diff' : 'Show diff'}
                      </button>
                      {showDiff && (
                        <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                          <DiffViewer before={comment.snapshot_before} after={afterComp} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {comments.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingTop: 40 }}>
            No comments yet.<br />Double-click a component to add one.
          </div>
        )}
      </div>
    </div>
  );
}
