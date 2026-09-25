/**
 * Sinkronisasi data terpusat untuk store mode online.
 * Setiap record (produk, transaksi, dll) dikirim/diambil per baris ke server.
 * Aturan bentrok: perubahan terakhir yang dipakai.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PosDatabase, StoreSettings } from "./types";
import { usePos } from "./store";

export const SYNC_CURSOR_KEY = "wo-pos-sync-cursor";
export const SYNC_BASE_KEY = "wo-pos-sync-base";

const COLLECTIONS = [
  "users",
  "categories",
  "products",
  "modifiers",
  "paymentMethods",
  "tables",
  "staff",
  "onlineChannels",
  "serviceTypes",
  "sales",
  "heldOrders",
  "kitchenOrders",
  "shifts",
  "businessDays",
  "members",
  "memberPoints",
  "financeCategories",
  "financeEntries",

] as const;
type Col = (typeof COLLECTIONS)[number];

/** Field pengaturan yang khusus perangkat ini (tidak disinkronkan). */
const LOCAL_SETTINGS: (keyof StoreSettings)[] = ["deviceToken", "deviceName"];

export interface SyncStatus {
  state: "idle" | "syncing" | "offline" | "error";
  pending: number;
  lastSync: string | null;
  message?: string;
}

let status: SyncStatus = { state: "idle", pending: 0, lastSync: null };
const listeners = new Set<() => void>();
function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l());
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}

function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}
function hash(v: unknown): string {
  const s = stable(v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

function sharedSettings(s: StoreSettings): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...s };
  for (const k of LOCAL_SETTINGS) delete copy[k];
  return copy;
}

type Rec = { key: string; c: string; id: string; d: unknown };
function records(db: PosDatabase): Map<string, Rec> {
  const out = new Map<string, Rec>();
  for (const c of COLLECTIONS) {
    const arr = (db[c] as { id: string }[] | undefined) ?? [];
    for (const item of arr) {
      if (!item?.id) continue;
      const key = `${c}:${item.id}`;
      out.set(key, { key, c, id: item.id, d: item });
    }
  }
  out.set("settings:main", { key: "settings:main", c: "settings", id: "main", d: sharedSettings(db.settings) });
  return out;
}

function readJson<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type PullRow = { collection: string; record_id: string; data: unknown; deleted: boolean; seq: number };
type Rpc = (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (n, a) => (supabase.rpc as unknown as Rpc).call(supabase, n, a);

async function pullAll(code: string, token: string, since: number): Promise<PullRow[]> {
  const all: PullRow[] = [];
  let cur = since;
  for (;;) {
    const { data, error } = await rpc("sync_pull", { _code: code, _token: token, _since: cur });
    if (error) throw new Error(error.message);
    const rows = (data as PullRow[]) ?? [];
    all.push(...rows);
    if (rows.length < 1000) break;
    cur = rows[rows.length - 1]!.seq;
  }
  return all;
}

function applyRows(cur: PosDatabase, rows: PullRow[], replace: boolean, skip: Set<string>): PosDatabase {
  const next: PosDatabase = { ...cur };
  const maps = new Map<Col, Map<string, unknown>>();
  for (const c of COLLECTIONS) {
    const m = new Map<string, unknown>();
    if (!replace) for (const it of (cur[c] as { id: string }[] | undefined) ?? []) m.set(it.id, it);
    maps.set(c, m);
  }
  let settings = cur.settings;
  for (const r of rows) {
    const key = `${r.collection}:${r.record_id}`;
    if (skip.has(key)) continue;
    if (r.collection === "settings") {
      if (!r.deleted && r.data) {
        const local: Partial<StoreSettings> = {};
        for (const k of LOCAL_SETTINGS) (local as Record<string, unknown>)[k] = cur.settings[k];
        settings = { ...(r.data as StoreSettings), ...local, activated: true };
      }
      continue;
    }
    const m = maps.get(r.collection as Col);
    if (!m) continue;
    if (r.deleted) m.delete(r.record_id);
    else m.set(r.record_id, r.data);
  }
  for (const c of COLLECTIONS) (next as unknown as Record<string, unknown>)[c] = [...maps.get(c)!.values()];
  next.settings = settings;
  return next;
}

/** Jalankan sinkronisasi di latar belakang (hanya store mode online). */
export function useCentralSync() {
  const { ready, db, update } = usePos();
  const dbRef = useRef(db);
  dbRef.current = db;
  const running = useRef(false);
  const enabled = ready && db.settings.activated && db.settings.storeMode === "online";
  const code = db.settings.storeCode;
  const token =
    db.settings.deviceToken || (typeof localStorage !== "undefined" ? localStorage.getItem("wo-pos-device-token") : "") || "";

  useEffect(() => {
    if (!enabled || !code || !token) return;
    let alive = true;

    const cycle = async () => {
      if (running.current || !alive) return;
      const base = readJson<Record<string, string>>(SYNC_BASE_KEY, {});
      const local = records(dbRef.current);
      const dirty: Rec[] = [];
      for (const r of local.values()) if (base[r.key] !== hash(r.d)) dirty.push(r);
      const deleted = Object.keys(base).filter((k) => !local.has(k));
      const cursorRaw = localStorage.getItem(SYNC_CURSOR_KEY);
      if (!navigator.onLine) {
        setStatus({ state: "offline", pending: cursorRaw === null ? 0 : dirty.length + deleted.length });
        return;
      }
      running.current = true;
      setStatus({ state: "syncing" });
      try {
        if (cursorRaw === null) {
          // Pertama tersambung: kalau server sudah punya data, data server dipakai.
          const rows = await pullAll(code, token, 0);
          if (rows.length > 0) {
            let nextDb: PosDatabase | null = null;
            update((cur) => (nextDb = applyRows(cur, rows, true, new Set())));
            const merged = nextDb ?? applyRows(dbRef.current, rows, true, new Set());
            const nb: Record<string, string> = {};
            for (const r of records(merged).values()) nb[r.key] = hash(r.d);
            localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(nb));
            localStorage.setItem(SYNC_CURSOR_KEY, String(rows[rows.length - 1]!.seq));
            setStatus({ state: "idle", pending: 0, lastSync: new Date().toISOString() });
            return;
          }
          localStorage.setItem(SYNC_CURSOR_KEY, "0");
        }

        // 1) Kirim perubahan lokal.
        const payload = [
          ...dirty.map((r) => ({ c: r.c, id: r.id, d: r.d, h: hash(r.d), key: r.key })),
          ...deleted.map((k) => {
            const [c, ...rest] = k.split(":");
            return { c: c!, id: rest.join(":"), del: true, key: k, h: "" };
          }),
        ];
        for (let i = 0; i < payload.length; i += 200) {
          const chunk = payload.slice(i, i + 200);
          const { error } = await rpc("sync_push", {
            _code: code,
            _token: token,
            _records: chunk.map(({ key: _k, h: _h, ...rest }) => rest),
          });
          if (error) throw new Error(error.message);
          for (const p of chunk) {
            if ("del" in p) delete base[p.key];
            else base[p.key] = p.h;
          }
          localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(base));
        }

        // 2) Ambil perubahan dari perangkat lain.
        const since = Number(localStorage.getItem(SYNC_CURSOR_KEY) ?? "0") || 0;
        const rows = await pullAll(code, token, since);
        if (rows.length > 0) {
          // Record yang diubah lagi di perangkat ini sejak kirim tadi tidak ditimpa.
          const now = records(dbRef.current);
          const skip = new Set<string>();
          for (const r of now.values()) if (base[r.key] !== undefined && base[r.key] !== hash(r.d)) skip.add(r.key);
          let nextDb: PosDatabase | null = null;
          update((cur) => (nextDb = applyRows(cur, rows, false, skip)));
          const merged = records(nextDb ?? applyRows(dbRef.current, rows, false, skip));
          for (const r of rows) {
            const key = `${r.collection}:${r.record_id}`;
            if (skip.has(key)) continue;
            const m = merged.get(key);
            if (m) base[key] = hash(m.d);
            else delete base[key];
          }
          localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(base));
          localStorage.setItem(SYNC_CURSOR_KEY, String(rows[rows.length - 1]!.seq));
        }
        setStatus({ state: "idle", pending: 0, lastSync: new Date().toISOString(), message: "" });
      } catch (e) {
        setStatus({
          state: "error",
          pending: dirty.length + deleted.length,
          message: e instanceof Error ? e.message.replace(/^.*?SYNC_DENIED:\s*/, "") : "Sinkronisasi gagal",
        });
      } finally {
        running.current = false;
      }
    };

    // Sinkron berbasis peristiwa: saat dibuka, saat internet kembali, saat aplikasi
    // kembali aktif, dan setelah ada perubahan data. Polling cadangan jarang (2 menit).
    void cycle();
    const t = setInterval(() => document.visibilityState === "visible" && void cycle(), 120_000);
    const onOnline = () => void cycle();
    const onVis = () => document.visibilityState === "visible" && void cycle();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    document.addEventListener("visibilitychange", onVis);
    (globalThis as { __posSyncNow?: () => void }).__posSyncNow = () => void cycle();
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, code, token, update]);

  // Kirim setelah ada perubahan lokal (transaksi, produk, pengaturan, dll).
  // Perubahan beruntun digabung jadi satu kiriman setelah 4 detik tenang.
  const lastHash = useRef<string>("");
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      const base = readJson<Record<string, string>>(SYNC_BASE_KEY, {});
      const local = records(dbRef.current);
      let dirty = Object.keys(base).some((k) => !local.has(k));
      if (!dirty) for (const r of local.values()) if (base[r.key] !== hash(r.d)) { dirty = true; break; }
      if (!dirty) return;
      const sig = String(local.size) + Date.now();
      lastHash.current = sig;
      (globalThis as { __posSyncNow?: () => void }).__posSyncNow?.();
    }, 4000);
    return () => clearTimeout(t);
  }, [db, enabled]);
}

/** Minta sinkron segera (mis. sebelum checkout atau setelah transaksi). */
export function requestSync() {
  (globalThis as { __posSyncNow?: () => void }).__posSyncNow?.();
}
