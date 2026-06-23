import { get, set, del, keys } from 'idb-keyval';

const SYNC_QUEUE_KEY = 'sync_queue';

export interface SyncOperation {
  id: string;
  operation: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  timestamp: number;
}

export async function queueOperation(op: Omit<SyncOperation, 'id' | 'timestamp'>) {
  const queue = (await get<SyncOperation[]>(SYNC_QUEUE_KEY)) || [];
  queue.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
  await set(SYNC_QUEUE_KEY, queue);
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  return (await get<SyncOperation[]>(SYNC_QUEUE_KEY)) || [];
}

export async function clearSyncQueue() {
  await del(SYNC_QUEUE_KEY);
}

export async function removeFromQueue(ids: string[]) {
  const queue = await getSyncQueue();
  await set(SYNC_QUEUE_KEY, queue.filter((op) => !ids.includes(op.id)));
}

export async function cachePage(pageId: string, data: unknown) {
  await set(`page_${pageId}`, data);
}

export async function getCachedPage(pageId: string) {
  return get(`page_${pageId}`);
}

export async function clearCache() {
  const allKeys = await keys();
  for (const key of allKeys) {
    if (typeof key === 'string' && (key.startsWith('page_') || key === SYNC_QUEUE_KEY)) {
      await del(key);
    }
  }
}
