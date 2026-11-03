/**
 * Sinkronisasi data terpusat untuk store mode online.
 * Setiap record (produk, transaksi, dll) dikirim/diambil per baris ke server.
 * Aturan bentrok: perubahan terakhir yang dipakai.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PosDatabase, StoreSettings } from "./types";
import { usePos } from "./store";
import { recomputeStock } from "./stock";
import { SYNC_COLLECTIONS, sameSyncStore } from "./sync-safety";
import { saveDatabase } from "./storage";

export const SYNC_CURSOR_KEY = "wo-pos-sync-cursor";
export const SYNC_BASE_KEY = "wo-pos-sync-base";
/** Penanda pemulihan: perangkat ini menjadi sumber kebenaran, semua data lokal dikirim ulang ke server. */
export const RECOVERY_KEY = "wo-pos-recovery";
/** Penanda sudah memakai pengiriman berbasis tindakan (bukan perbandingan cache). */
const SYNC_V2_KEY = "wo-pos-sync-v2";
/** Saat peralihan, hanya transaksi kasir yang belum terkirim yang ikut dikirim. */
const LEGACY_PENDING = new Set(["sales", "heldOrders", "kitchenOrders", "financeEntries", "deletedFinance", "stockMoves", "memberPoints", "members"]);

const COLLECTIONS = SYNC_COLLECTIONS;
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
    const last = rows.at(-1);
    if (!last) break;
    cur = last.seq;
  }
  return all;
}

/** Tandai perangkat ini sebagai sumber data: seluruh data lokal dikirim ulang ke server pusat.
 *  Dipakai untuk memulihkan data store setelah data pusat hilang/kosong. */
export function requestRestore() {
  try {
    localStorage.setItem(RECOVERY_KEY, "1");
    localStorage.removeItem(SYNC_BASE_KEY);
  } catch {
    /* abaikan */
  }
  requestSync();
}

/** Bangun ulang basis sinkron dari data lokal (setelah pulihkan dari berkas), agar
 *  perangkat tidak menandai data sebagai terhapus karena basis lama sudah basi. */
export function rebuildSyncBase(db: PosDatabase) {
  try {
    const nb: Record<string, string> = {};
    for (const r of records(db).values()) nb[r.key] = hash(r.d);
    localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(nb));
    localStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* abaikan */
  }
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
  for (const c of COLLECTIONS) (next as unknown as Record<string, unknown>)[c] = [...(maps.get(c)?.values() ?? [])];
  next.settings = settings;
  return recomputeStock(next);
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
    const stillCurrent = () => alive && sameSyncStore(dbRef.current, code, token);

    const cycle = async () => {
      if (running.current || !alive) return;
      // Jaga-jaga: jangan jalankan siklus yang masih memegang store lama setelah pindah store.
      if (!sameSyncStore(dbRef.current, code, token)) return;
      const base = readJson<Record<string, string>>(SYNC_BASE_KEY, {});
      const local = records(dbRef.current);
      const hasLocalData = [...local.values()].some((r) => r.c !== "settings");

      // Mode pemulihan: perangkat ini sumber kebenaran. Kirim semua data lokal,
      // lalu majukan cursor melewati seluruh isi server tanpa menerapkannya.
      if (localStorage.getItem(RECOVERY_KEY) === "1") {
        if (!hasLocalData) { setStatus({ state: "error", message: "Pemulihan data kosong diblokir." }); return; }
        if (!navigator.onLine) {
          setStatus({ state: "offline", pending: local.size });
          return;
        }
        running.current = true;
        setStatus({ state: "syncing" });
        try {
          await saveDatabase(dbRef.current);
          if (!stillCurrent()) return;
          const payload = [...local.values()].map((r) => ({ c: r.c, id: r.id, d: r.d }));
          for (let i = 0; i < payload.length; i += 200) {
            const { error } = await rpc("sync_push", {
              _code: code,
              _token: token,
              _records: payload.slice(i, i + 200),
            });
            if (!stillCurrent()) return;
            if (error) throw new Error(error.message);
          }
          const rows = await pullAll(code, token, 0);
          if (!stillCurrent()) return;
          const maxSeq = rows.length > 0 ? (rows.at(-1)?.seq ?? 0) : Number(localStorage.getItem(SYNC_CURSOR_KEY) ?? "0") || 0;
          const nb: Record<string, string> = {};
          for (const r of local.values()) nb[r.key] = hash(r.d);
          localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(nb));
          localStorage.setItem(SYNC_CURSOR_KEY, String(maxSeq));
          const changed = records(dbRef.current);
          if ([...changed.values()].every((r) => nb[r.key] === hash(r.d))) localStorage.removeItem(RECOVERY_KEY);
          setStatus({ state: "idle", pending: 0, lastSync: new Date().toISOString() });
        } catch (e) {
          if (!stillCurrent()) return;
          setStatus({
            state: "error",
            pending: local.size,
            message: e instanceof Error ? e.message.replace(/^.*?SYNC_DENIED:\s*/, "") : "Pemulihan gagal",
          });
        } finally {
          running.current = false;
        }
        return;
      }

      // Pengaman: perangkat kosong/direset hanya mengunduh, tidak pernah mengirim.
      if (!hasLocalData && (Object.keys(base).length > 0 || localStorage.getItem(SYNC_CURSOR_KEY) !== null)) {
        localStorage.removeItem(SYNC_BASE_KEY);
        localStorage.removeItem(SYNC_CURSOR_KEY);
        return;
      }
      // Peralihan sekali: transaksi kasir yang belum terkirim di versi lama tetap dikirim.
      if (localStorage.getItem(SYNC_V2_KEY) !== "1") {
        const legacy: Record<string, true> = {};
        if (localStorage.getItem(SYNC_CURSOR_KEY) !== null) {
          for (const r of local.values()) if (LEGACY_PENDING.has(r.c) && base[r.key] !== hash(r.d)) legacy[r.key] = true;
        }
        update((cur) => sameSyncStore(cur, code, token) ? { ...cur, syncDirty: { ...legacy, ...(cur.syncDirty ?? {}) } } : cur, { source: "sync" });
        localStorage.setItem(SYNC_V2_KEY, "1");
        return;
      }
      // Hanya catatan yang benar-benar diubah oleh tindakan di perangkat ini yang dikirim.
      const marks = { ...(dbRef.current.syncDirty ?? {}) };
      const dirty: Rec[] = [];
      for (const key of Object.keys(marks)) {
        const r = local.get(key);
        if (r) dirty.push(r);
      }
      const deleted = (dbRef.current.syncDeletes ?? []).filter((d) => !local.has(`${d.c}:${d.id}`));
      const cursorRaw = localStorage.getItem(SYNC_CURSOR_KEY);
      if (!navigator.onLine) {
        setStatus({ state: "offline", pending: dirty.length + deleted.length });
        return;
      }
      running.current = true;
      setStatus({ state: "syncing" });
      try {
        // 1) Ambil data terbaru dari server lebih dulu. Catatan yang sedang diubah di
        //    perangkat ini tidak ditimpa; pengaturan digabung per field.
        const firstTime = cursorRaw === null;
        const rows = await pullAll(code, token, firstTime ? 0 : Number(cursorRaw) || 0);
        if (!stillCurrent()) return;
        if (firstTime && rows.length > 0 && !hasLocalData && !rows.some((r) => !r.deleted && r.collection === "users")) {
          throw new Error("SYNC_SAFETY: Data pengguna belum tersedia. Jangan reset perangkat; pulihkan cadangan store ini.");
        }
        if (rows.length > 0) {
          let nextDb: PosDatabase | null = null;
          update((cur) => {
            if (!sameSyncStore(cur, code, token)) return cur;
            const curMarks = cur.syncDirty ?? {};
            const skip = new Set<string>([...Object.keys(curMarks), ...(cur.syncDeletes ?? []).map((d) => `${d.c}:${d.id}`)]);
            skip.delete("settings:main");
            const applied = applyRows(cur, rows, firstTime && !hasLocalData, skip);
            const fields = curMarks["settings:main"];
            if (fields) {
              const keep = Array.isArray(fields) ? fields : Object.keys(cur.settings);
              const s = { ...applied.settings } as unknown as Record<string, unknown>;
              for (const k of keep) s[k] = (cur.settings as unknown as Record<string, unknown>)[k];
              applied.settings = s as unknown as StoreSettings;
            }
            nextDb = applied;
            return applied;
          }, { source: "sync" });
          await saveDatabase(nextDb ?? dbRef.current);
          if (!stillCurrent()) return;
          localStorage.setItem(SYNC_CURSOR_KEY, String(rows.at(-1)?.seq ?? 0));
        } else if (firstTime) {
          localStorage.setItem(SYNC_CURSOR_KEY, "0");
        }

        // 2) Kirim hanya perubahan nyata (dibaca ulang setelah penggabungan).
        const fresh = records(dbRef.current);
        const curMarks = dbRef.current.syncDirty ?? {};
        const send = Object.keys(curMarks).map((k) => fresh.get(k)).filter((r): r is Rec => !!r);
        const payload = [
          ...send.map((r) => ({ c: r.c, id: r.id, d: r.d, h: hash(r.d), key: r.key })),
          ...deleted.map((d) => ({ ...d, intent: "explicit-delete-v1", del: true, key: `${d.c}:${d.id}`, h: "" })),
        ];
        for (let i = 0; i < payload.length; i += 200) {
          const chunk = payload.slice(i, i + 200);
          const { error } = await rpc("sync_push", {
            _code: code,
            _token: token,
            _records: chunk.map(({ key: _k, h: _h, ...rest }) => rest),
          });
          if (!stillCurrent()) return;
          if (error) throw new Error(error.message);
          const sentHash = new Map(chunk.filter((p) => !("del" in p)).map((p) => [p.key, p.h]));
          const acknowledged = new Set(chunk.filter((p) => "del" in p).map((p) => p.key));
          update((cur) => {
            if (!sameSyncStore(cur, code, token)) return cur;
            const now = records(cur);
            const left = { ...(cur.syncDirty ?? {}) };
            // Hapus tanda hanya bila belum diubah lagi sejak dikirim.
            for (const [k, h] of sentHash) if (hash(now.get(k)?.d) === h) delete left[k];
            return { ...cur, syncDirty: left, syncDeletes: (cur.syncDeletes ?? []).filter((d) => !acknowledged.has(`${d.c}:${d.id}`)) };
          }, { source: "sync" });
        }
        void base;
        setStatus({ state: "idle", pending: 0, lastSync: new Date().toISOString(), message: "" });
        return;
      } catch (e) {
        if (!stillCurrent()) return;
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

  // Kirim beberapa detik setelah ada tindakan nyata (simpan, bayar, tutup shift, dll).
  const pendingCount = Object.keys(db.syncDirty ?? {}).length + (db.syncDeletes?.length ?? 0);
  useEffect(() => {
    if (!enabled || pendingCount === 0) return;
    const t = setTimeout(() => (globalThis as { __posSyncNow?: () => void }).__posSyncNow?.(), 3000);
    return () => clearTimeout(t);
  }, [db, enabled, pendingCount]);
}

/** Minta sinkron segera (mis. sebelum checkout atau setelah transaksi). */
export function requestSync() {
  (globalThis as { __posSyncNow?: () => void }).__posSyncNow?.();
}
