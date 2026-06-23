import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '../lib/api';

interface PresenceUser {
  userId: string;
  userName: string;
  color: string;
}

export function useCollab(pageId: string | undefined, userId: string, userName: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [lastUpdate, setLastUpdate] = useState<{ type: string; payload: unknown } | null>(null);

  const connect = useCallback(() => {
    if (!pageId || !userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const color = '#004228';
    const url = `${protocol}//${host}/api/ws/${pageId}?userId=${userId}&userName=${encodeURIComponent(userName)}&color=${encodeURIComponent(color)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence') {
          setPresence(data.users || []);
        } else if (data.type === 'user_joined') {
          setPresence((prev) => [...prev.filter((u) => u.userId !== data.user.userId), data.user]);
        } else if (data.type === 'user_left') {
          setPresence((prev) => prev.filter((u) => u.userId !== data.userId));
        } else {
          setLastUpdate(data);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 3000);
    };
  }, [pageId, userId, userName]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const broadcast = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { presence, lastUpdate, broadcast };
}

export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  delay = 1500
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveFn(dataRef.current).catch(console.error);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [data, saveFn, delay]);
}
