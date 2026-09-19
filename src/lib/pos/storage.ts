/**
 * Lapisan penyimpanan lokal (offline-first).
 * Seluruh basis data POS disimpan sebagai satu dokumen di IndexedDB.
 * Mengganti ke penyimpanan online nanti cukup mengubah file ini.
 */
import type { PosDatabase } from "./types";

const DB_NAME = "wo-pos";
const STORE_NAME = "kv";
const KEY = "database";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDatabase(): Promise<PosDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<PosDatabase | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(KEY);
      req.onsuccess = () => resolve((req.result as PosDatabase) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveDatabase(data: PosDatabase): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(data, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* penyimpanan tidak tersedia */
  }
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
