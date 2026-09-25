/**
 * Rentang waktu laporan berbasis "hari usaha".
 * Jam operasional store menggeser batas hari: transaksi jam 01:00 dini hari
 * masih dihitung ke hari usaha sebelumnya bila store buka jam 10:00.
 */
import type { StoreSettings } from "./types";

export type RangeMode = "day" | "month" | "year" | "custom";

export interface ReportRange {
  mode: RangeMode;
  /** "yyyy-mm-dd" (day/custom), "yyyy-mm" (month), "yyyy" (year) */
  from: string;
  to: string;
  openHour: number;
  closeHour: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseHour(value: string | undefined, fallback: number): number {
  const part = (value ?? "").split(":")[0];
  const n = Number(part);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? Math.round(n) : fallback;
}

export function hoursOf(settings: StoreSettings): { openHour: number; closeHour: number } {
  return {
    openHour: parseHour(settings.openTime, 0),
    closeHour: parseHour(settings.closeTime, 0),
  };
}

export function dayValue(at = new Date()): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Tanggal hari usaha untuk satu waktu. */
export function businessDate(at: number | Date, openHour: number): Date {
  const d = new Date(at);
  if (d.getHours() < openHour) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function defaultRange(settings: StoreSettings): ReportRange {
  const { openHour, closeHour } = hoursOf(settings);
  const value = dayValue(businessDate(Date.now(), openHour));
  return { mode: "day", from: value, to: value, openHour, closeHour };
}

export function rangeBounds(range: ReportRange): { start: number; end: number } {
  const { openHour, closeHour } = range;
  const num = (v: string) => v.split("-").map((p) => Number(p) || 0);
  const [fy = 1970, fm = 1, fd = 1] = num(range.from);
  const [ty = 1970, tm = 1, td = 1] = num(range.to);

  const start = new Date(
    fy,
    range.mode === "year" ? 0 : fm - 1,
    range.mode === "day" || range.mode === "custom" ? fd : 1,
    openHour,
  );

  // Hari usaha berakhir pada jam tutup keesokan harinya bila jam tutup <= jam buka.
  const overnight = closeHour <= openHour;
  let end: Date;
  if (range.mode === "year") end = new Date(ty + 1, 0, overnight ? 1 : 0, closeHour);
  else if (range.mode === "month") end = new Date(ty, tm, overnight ? 1 : 0, closeHour);
  else end = new Date(ty, tm - 1, overnight ? td + 1 : td, closeHour);

  const a = start.getTime();
  const b = end.getTime();
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

export function inRange(iso: string, range: ReportRange): boolean {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return false;
  const { start, end } = rangeBounds(range);
  return at >= start && at < end;
}

export function rangeLabel(range: ReportRange): string {
  const { start, end } = rangeBounds(range);
  const a = new Date(start);
  const b = new Date(end);
  const clock = (d: Date) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;
  const day = (d: Date) =>
    d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  if (range.mode === "day") {
    return a.toDateString() === b.toDateString()
      ? `${day(a)} · ${clock(a)} – ${clock(b)}`
      : `${day(a)} ${clock(a)} – ${day(b)} ${clock(b)}`;
  }
  if (range.mode === "month") {
    return new Date(start).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }
  if (range.mode === "year") return String(a.getFullYear());
  return `${day(a)} – ${day(new Date(end - 1))}`;
}

/** Nama hari (Senin, dst.) untuk statistik hari ramai. */
export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
