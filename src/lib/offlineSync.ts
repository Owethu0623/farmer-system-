import { apiRequest } from './api';
import {
  OfflineBundlePayload,
  OfflineMutationType,
  OfflineQueuedMutation,
  OfflineSyncBatchResponse,
  OfflineSyncResultItem,
} from '../types';

const DB_NAME = 'fieldshift_offline_v1';
const STORE_NAME = 'vault';
const LS_PREFIX = 'fieldshift_offline_vault_';

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openVaultDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    try {
      const raw = window.localStorage.getItem(`${LS_PREFIX}${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback for environments without IndexedDB
  }
  try {
    window.localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore localStorage quota error cleanly
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(`${LS_PREFIX}${key}`);
  } catch {
    // ignore
  }
}

export function createClientMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `mut-${crypto.randomUUID()}`;
  }
  return `mut-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isLikelyOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (typeof window !== 'undefined' && window.localStorage.getItem('fieldshift_simulated_offline') === 'true') {
    return true;
  }
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed')
    );
  }
  return false;
}

export function getOfflineStaleness(bundle: OfflineBundlePayload | null) {
  if (!bundle) {
    return {
      isBundleStale: false,
      isWeatherStale: false,
      bundleAgeHours: null as number | null,
      weatherAgeHours: null as number | null,
    };
  }
  const now = Date.now();
  const downloadedMs = new Date(bundle.downloadedAt).getTime();
  const bundleAgeHours = Number.isFinite(downloadedMs)
    ? Math.max(0, Number(((now - downloadedMs) / 3600000).toFixed(1)))
    : null;

  let oldestWeatherMs = Infinity;
  for (const ws of bundle.weatherSnapshots || []) {
    const ms = new Date(ws.snapshotFetchedAt).getTime();
    if (Number.isFinite(ms) && ms < oldestWeatherMs) {
      oldestWeatherMs = ms;
    }
  }
  const weatherAgeHours =
    oldestWeatherMs < Infinity
      ? Math.max(0, Number(((now - oldestWeatherMs) / 3600000).toFixed(1)))
      : bundleAgeHours;

  return {
    isBundleStale: bundleAgeHours !== null && bundleAgeHours >= (bundle.staleAfterHours || 24),
    isWeatherStale:
      weatherAgeHours !== null && weatherAgeHours >= (bundle.weatherStaleAfterHours || 6),
    bundleAgeHours,
    weatherAgeHours,
  };
}

export async function loadOfflineBundle(userId: string): Promise<OfflineBundlePayload | null> {
  return idbGet<OfflineBundlePayload>(`bundle:${userId}`);
}

export async function saveOfflineBundle(
  userId: string,
  bundle: OfflineBundlePayload
): Promise<void> {
  await idbSet(`bundle:${userId}`, bundle);
}

export async function downloadAndStoreOfflineBundle(
  userId: string,
  farmIds?: string[]
): Promise<OfflineBundlePayload> {
  const qs =
    Array.isArray(farmIds) && farmIds.length > 0
      ? `?farmIds=${encodeURIComponent(farmIds.join(','))}`
      : '';
  const bundle = await apiRequest<OfflineBundlePayload>(`/api/offline/bundle${qs}`);
  await saveOfflineBundle(userId, bundle);
  return bundle;
}

export async function loadOfflineQueue(userId: string): Promise<OfflineQueuedMutation[]> {
  const list = await idbGet<OfflineQueuedMutation[]>(`queue:${userId}`);
  return Array.isArray(list) ? list : [];
}

export async function saveOfflineQueue(
  userId: string,
  queue: OfflineQueuedMutation[]
): Promise<void> {
  await idbSet(`queue:${userId}`, queue);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fieldshift-offline-queue-changed', { detail: { userId, count: queue.length } })
    );
  }
}

export async function enqueueOfflineMutation(params: {
  userId: string;
  mutationType: OfflineMutationType;
  label: string;
  farmId?: string | null;
  farmName?: string | null;
  baseUpdatedAt?: string | null;
  payload: Record<string, unknown>;
}): Promise<OfflineQueuedMutation> {
  const current = await loadOfflineQueue(params.userId);
  const item: OfflineQueuedMutation = {
    clientMutationId: createClientMutationId(),
    userId: params.userId,
    mutationType: params.mutationType,
    label: params.label,
    farmId: params.farmId || null,
    farmName: params.farmName || null,
    createdAt: new Date().toISOString(),
    baseUpdatedAt: params.baseUpdatedAt || null,
    forceOverwrite: false,
    payload: params.payload,
    syncState: 'pending',
    lastError: null,
  };
  await saveOfflineQueue(params.userId, [item, ...current]);
  return item;
}

export async function removeOfflineQueueItem(userId: string, clientMutationId: string): Promise<OfflineQueuedMutation[]> {
  const current = await loadOfflineQueue(userId);
  const next = current.filter((m) => m.clientMutationId !== clientMutationId);
  await saveOfflineQueue(userId, next);
  return next;
}

export async function markQueueItemForceOverwrite(
  userId: string,
  clientMutationId: string
): Promise<OfflineQueuedMutation[]> {
  const current = await loadOfflineQueue(userId);
  const next = current.map((m) =>
    m.clientMutationId === clientMutationId
      ? { ...m, forceOverwrite: true, syncState: 'pending' as const, lastError: null }
      : m
  );
  await saveOfflineQueue(userId, next);
  return next;
}

export async function wipeUserOfflineVault(userId: string): Promise<void> {
  await idbDelete(`bundle:${userId}`);
  await idbDelete(`queue:${userId}`);
}

export async function syncPendingQueue(
  userId: string,
  onlyMutationId?: string
): Promise<{
  syncedCount: number;
  duplicateSkippedCount: number;
  conflictCount: number;
  errorCount: number;
  remainingQueue: OfflineQueuedMutation[];
  results: OfflineSyncResultItem[];
}> {
  const queue = await loadOfflineQueue(userId);
  const targets = queue.filter((item) =>
    onlyMutationId
      ? item.clientMutationId === onlyMutationId
      : item.syncState === 'pending' || item.syncState === 'error'
  );

  if (targets.length === 0) {
    return {
      syncedCount: 0,
      duplicateSkippedCount: 0,
      conflictCount: queue.filter((i) => i.syncState === 'conflict').length,
      errorCount: queue.filter((i) => i.syncState === 'error').length,
      remainingQueue: queue,
      results: [],
    };
  }

  const response = await apiRequest<OfflineSyncBatchResponse>('/api/offline/sync', {
    method: 'POST',
    body: JSON.stringify({
      mutations: targets.map((m) => ({
        clientMutationId: m.clientMutationId,
        mutationType: m.mutationType,
        createdAt: m.createdAt,
        baseUpdatedAt: m.baseUpdatedAt,
        forceOverwrite: Boolean(m.forceOverwrite),
        payload: m.payload,
      })),
    }),
  });

  const resultMap = new Map(response.results.map((r) => [r.clientMutationId, r]));
  const remaining: OfflineQueuedMutation[] = [];
  let syncedCount = 0;
  let duplicateSkippedCount = 0;
  let conflictCount = 0;
  let errorCount = 0;

  for (const item of queue) {
    const res = resultMap.get(item.clientMutationId);
    if (!res) {
      remaining.push(item);
      continue;
    }
    if (res.status === 'synced') {
      syncedCount += 1;
    } else if (res.status === 'already_synced') {
      duplicateSkippedCount += 1;
    } else if (res.status === 'conflict') {
      conflictCount += 1;
      remaining.push({
        ...item,
        syncState: 'conflict',
        lastError: res.message,
        serverUpdatedAt: res.serverUpdatedAt || null,
        serverSummary: res.serverSummary || null,
      });
    } else {
      errorCount += 1;
      remaining.push({
        ...item,
        syncState: 'error',
        lastError: res.message,
      });
    }
  }

  await saveOfflineQueue(userId, remaining);
  return {
    syncedCount,
    duplicateSkippedCount,
    conflictCount,
    errorCount,
    remainingQueue: remaining,
    results: response.results,
  };
}
