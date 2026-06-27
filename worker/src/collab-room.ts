import { DurableObject } from 'cloudflare:workers';

interface Session {
  ws: WebSocket;
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

export class CollabRoom extends DurableObject {
  private sessions: Map<string, Session> = new Map();

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

    this.ctx.acceptWebSocket(server);
    this.sessions.set(server, { ws: server, userId, userName, color });

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
    const session = this.sessions.get(ws);
    if (!session) return;

    try {
      const data = JSON.parse(message as string);
      this.broadcast(JSON.stringify({
        ...data,
        userId: session.userId,
        userName: session.userName,
      }), session.userId);
    } catch {
      // ignore malformed messages
    }
  }

  webSocketClose(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (session) {
      this.broadcast(JSON.stringify({
        type: 'user_left',
        userId: session.userId,
      }));
      this.sessions.delete(ws);
    }
  }

  private getPresence() {
    return Array.from(this.sessions.values()).map((s) => ({
      userId: s.userId,
      userName: s.userName,
      color: s.color,
    }));
  }

  private broadcast(message: string, excludeUserId?: string): void {
    for (const session of this.sessions.values()) {
      if (excludeUserId && session.userId === excludeUserId) continue;
      try {
        session.ws.send(message);
      } catch {
        this.sessions.delete(session.ws);
      }
    }
  }
}

export default CollabRoom;
