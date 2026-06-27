import React, { useState } from 'react';
import type { CanvasComponent } from '../../lib/canvas-types';
import { createCanvasComment } from '../../lib/canvas-api';

interface Props {
  component: CanvasComponent;
  pageId: string;
  onClose: () => void;
  onCommentAdded: () => void;
}

const COMMON_TAGS = ['color', 'size', 'layout', 'text', 'spacing', 'style'];

export function AddCommentBox({ component, pageId, onClose, onCommentAdded }: Props) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const submit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    try {
      await createCanvasComment(pageId, {
        content: content.trim(),
        anchor_kind: 'component',
        anchor_id: component.id,
        anchor_path: component.nodePath,
        tags,
      });
      onCommentAdded();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 20,
          width: 380,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Commenting on</div>
          <div style={{ fontWeight: 600, color: '#004228', fontSize: 13 }}>{component.name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{component.nodePath}</div>
        </div>

        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Describe what you want changed…"
          rows={4}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) submit();
            if (e.key === 'Escape') onClose();
          }}
        />

        <div style={{ marginTop: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COMMON_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  borderRadius: 12,
                  border: '1px solid',
                  borderColor: tags.includes(tag) ? '#004228' : '#d1d5db',
                  background: tags.includes(tag) ? '#004228' : '#f9fafb',
                  color: tags.includes(tag) ? '#fff' : '#374151',
                  cursor: 'pointer',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !content.trim()}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              border: 'none',
              borderRadius: 6,
              background: '#004228',
              color: '#fff',
              cursor: loading || !content.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !content.trim() ? 0.6 : 1,
            }}
          >
            {loading ? 'Sending…' : 'Send instruction'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, textAlign: 'right' }}>⌘↵ to submit</div>
      </div>
    </div>
  );
}
