/**
 * Lapisan penyimpanan lokal (offline-first).
 * Seluruh basis data POS disimpan sebagai satu dokumen di IndexedDB.
 * Mengganti ke penyimpanan online nanti cukup mengubah file ini.
 */
import type { PosDatabase } from "./types";
import { closedArchiveEvents } from "./sync-safety";

export const ARCHIVE_STORE = "archives";
const DB_NAME = "wo-pos";
const STORE_NAME = "kv";
const KEY = "database";
const PRINTER_KEY = "wo-pos-printer-settings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) db.createObjectStore(ARCHIVE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDatabase(): Promise<PosDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    return await new Promise<PosDatabase | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(KEY);
      req.onsuccess = () => resolve((req.result as PosDatabase) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

let saveQueue: Promise<void> = Promise.resolve();
export function saveDatabase(data: PosDatabase): Promise<void> {
  const task = saveQueue.catch(() => undefined).then(() => persistDatabase(data));
  saveQueue = task;
  return task;
}

export interface LocalArchive { id: string; storeCode: string; savedAt: string; event: string; data: PosDatabase }

export async function listLocalArchives(storeCode: string): Promise<LocalArchive[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, "readonly");
      const req = tx.objectStore(ARCHIVE_STORE).getAll();
      req.onsuccess = () => resolve((req.result as LocalArchive[]).filter((a) => a.storeCode === storeCode).sort((a,b) => b.savedAt.localeCompare(a.savedAt)));
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

async function persistDatabase(data: PosDatabase): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, ARCHIVE_STORE], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onsuccess = () => {
        const previous = (req.result as PosDatabase | undefined) ?? null;
        for (const event of closedArchiveEvents(previous, data)) {
          const id = `${data.settings.storeCode}:${event}`;
          const archives = tx.objectStore(ARCHIVE_STORE);
          const existing = archives.get(id);
          existing.onsuccess = () => {
            if (!existing.result) archives.put({ id, storeCode: data.settings.storeCode, savedAt: new Date().toISOString(), event, data }, id);
          };
        }
        store.put(data, KEY);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function clearDatabase(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Pengaturan printer bersifat khusus perangkat dan tidak boleh tertimpa sinkronisasi store. */
export function loadPrinterSettings(): PosDatabase["printer"] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRINTER_KEY);
    return raw ? (JSON.parse(raw) as PosDatabase["printer"]) : null;
  } catch {
    return null;
  }
}

export function savePrinterSettings(printer: PosDatabase["printer"]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PRINTER_KEY, JSON.stringify(printer));
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

const SESSION_KEY = "wo-pos-session";
const CART_KEY = "wo-pos-cart";

export function readLocal<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penuh atau diblokir */
  }
}

export function removeLocal(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* diabaikan */
  }
}

export const SESSION_STORAGE_KEY = SESSION_KEY;
export const CART_STORAGE_KEY = CART_KEY;
