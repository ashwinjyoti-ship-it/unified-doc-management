import { DurableObject } from 'cloudflare:workers';

interface SessionMeta {
  userId: string;
  userName: string;
  color: string;
}

// Canvas real-time message kinds (broadcast via /broadcast endpoint from canvas routes)
// | { kind: 'canvas:component:add';    payload: CanvasComponent }
// | { kind: 'canvas:component:update'; payload: { id: string; patch: Partial<CanvasComponent> } }
// | { kind: 'canvas:component:remove'; payload: { id: string } }
// | { kind: 'canvas:token:update';     payload: CanvasToken[] }
// | { kind: 'canvas:reset';            payload: { pageId: string } }
// All these flow through the generic broadcast handler below unchanged.
//
// IMPORTANT: this room uses the WebSocket Hibernation API (ctx.acceptWebSocket).
// When the room is idle it is evicted from memory while sockets stay open, so we
// must NOT keep connected clients in an in-memory Map — that map is empty after a
// hibernation wake-up, which silently drops every broadcast (the classic "I have
// to refresh to see the agent's edits" bug). Instead we enumerate live sockets
// via ctx.getWebSockets() and stash per-socket identity with serializeAttachment,
// both of which survive hibernation.

export class CollabRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const body = await request.json() as { type: string; payload: unknown; excludeUserId?: string };
      this.broadcast(JSON.stringify(body), body.excludeUserId);
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const userId = url.searchParams.get('userId') || 'anonymous';
    const userName = url.searchParams.get('userName') || 'Anonymous';
    const color = url.searchParams.get('color') || '#004228';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation-safe accept + identity that survives eviction from memory.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, userName, color } satisfies SessionMeta);

    server.send(JSON.stringify({
      type: 'presence',
      users: this.getPresence(),
    }));

    this.broadcast(JSON.stringify({
      type: 'user_joined',
      user: { userId, userName, color },
    }), userId);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const meta = this.metaOf(ws);
    if (!meta) return;

    try {
      const data = JSON.parse(message as string);
      this.broadcast(JSON.stringify({
        ...data,
        userId: meta.userId,
        userName: meta.userName,
      }), meta.userId);
    } catch {
      // ignore malformed messages
    }
  }

  webSocketClose(ws: WebSocket): void {
    const meta = this.metaOf(ws);
    try {
      ws.close();
    } catch {
      // already closing
    }
    if (meta) {
      this.broadcast(JSON.stringify({
        type: 'user_left',
        userId: meta.userId,
      }));
    }
  }

  webSocketError(ws: WebSocket): void {
    try {
      ws.close();
    } catch {
      // already gone
    }
  }

  private metaOf(ws: WebSocket): SessionMeta | null {
    try {
      return (ws.deserializeAttachment() as SessionMeta | null) ?? null;
    } catch {
      return null;
    }
  }

  private getPresence(): SessionMeta[] {
    const seen = new Set<string>();
    const users: SessionMeta[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const meta = this.metaOf(ws);
      if (!meta || seen.has(meta.userId)) continue;
      seen.add(meta.userId);
      users.push(meta);
    }
    return users;
  }

  private broadcast(message: string, excludeUserId?: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      const meta = this.metaOf(ws);
      if (excludeUserId && meta?.userId === excludeUserId) continue;
      try {
        ws.send(message);
      } catch {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    }
  }
}

export default CollabRoom;
