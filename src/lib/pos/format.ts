export function rupiah(value: number): string {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}

export function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function uid(prefix = "id"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
