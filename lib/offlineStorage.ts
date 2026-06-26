'use client';

const DB_NAME = 'joshbooks-offline';
const DB_VERSION = 1;
const FILES_STORE = 'files';
const META_STORE = 'fileMeta';

export interface OfflineMeta {
  id: string;
  name: string;
  mimeType: string;
  savedAt: string;
  kind: 'ebook';
  size: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineFile(meta: OfflineMeta, buffer: ArrayBuffer): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, META_STORE], 'readwrite');
    tx.objectStore(FILES_STORE).put(buffer, meta.id);
    tx.objectStore(META_STORE).put(meta);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadOfflineFile(id: string): Promise<{ meta: OfflineMeta; buffer: ArrayBuffer } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, META_STORE], 'readonly');
    const bufReq = tx.objectStore(FILES_STORE).get(id);
    const metaReq = tx.objectStore(META_STORE).get(id);
    tx.oncomplete = () => {
      db.close();
      if (bufReq.result && metaReq.result) {
        resolve({ meta: metaReq.result as OfflineMeta, buffer: bufReq.result as ArrayBuffer });
      } else {
        resolve(null);
      }
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function deleteOfflineFile(id: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, META_STORE], 'readwrite');
    tx.objectStore(FILES_STORE).delete(id);
    tx.objectStore(META_STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function listOfflineFiles(): Promise<OfflineMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as OfflineMeta[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function isOfflineSaved(id: string): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).count(id);
    req.onsuccess = () => { db.close(); resolve(req.result > 0); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
