import { useEffect, useRef, useCallback } from 'react';
import type { CanvasMessage } from '../lib/canvas-types';

interface UseCanvasCollabOptions {
  pageId: string;
  onMessage: (msg: CanvasMessage) => void;
  userId?: string;
  userName?: string;
}

export function useCanvasCollab({ pageId, onMessage, userId = 'anonymous', userName = 'User' }: UseCanvasCollabOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/ws/${pageId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (
          data.type === 'canvas:component:add' ||
          data.type === 'canvas:component:update' ||
          data.type === 'canvas:component:remove' ||
          data.type === 'canvas:token:update' ||
          data.type === 'canvas:reset'
        ) {
          onMessageRef.current(data as CanvasMessage);
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      // reconnect after 2s
      setTimeout(connect, 2000);
    };
  }, [pageId, userId, userName]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
