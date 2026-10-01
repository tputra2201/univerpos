/** Ekspor tab laporan yang sedang tampil ke Excel / PDF. */
import { rangeBounds, type ReportRange } from "./report-range";

type Section = { title?: string | undefined; head?: string[]; rows: string[][] };

const txt = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

export function sectionsFromElement(root: Element): Section[] {
  const out: Section[] = [{ rows: [] }];
  const cur = () => out[out.length - 1]!;
  const walk = (el: Element) => {
    if (el instanceof HTMLElement && (el.hidden || el.tagName === "BUTTON" || el.tagName === "INPUT")) return;
    if (el.hasAttribute("data-print-title")) {
      const t = txt(el);
      if (t) out.push({ title: t, rows: [] });
      return;
    }
    if (el.hasAttribute("data-print-row")) {
      cur().rows.push(Array.from(el.children).map(txt));
      return;
    }
    if (el.tagName === "TABLE") {
      const head = Array.from(el.querySelectorAll("thead th")).map(txt);
      const rows = Array.from(el.querySelectorAll("tbody tr, tfoot tr")).map((tr) =>
        Array.from(tr.children).map(txt),
      );
      out.push({ title: cur().rows.length ? undefined : cur().title, head, rows });
      if (!out[out.length - 2]!.rows.length && out[out.length - 2]!.title) out.splice(out.length - 2, 1);
      out.push({ rows: [] });
      return;
    }
    const kids = Array.from(el.children);
    if (kids.length === 2 && kids.every((k) => k.tagName === "P") && el.className.includes("border")) {
      cur().rows.push([txt(kids[0]!), txt(kids[1]!)]);
      return;
    }
    if (kids.length === 0) {
      const t = txt(el);
      if (t) cur().rows.push([t]);
      return;
    }
    kids.forEach(walk);
  };
  walk(root);
  return out.filter((s) => s.title || s.rows.length);
}

const monthDay = (d: Date) =>
  d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");

/** Contoh: "Fruitbox TS-Sales Report-01 Sep 2026" */
export function exportFileName(store: string, tab: string, range: ReportRange): string {
  const { start, end } = rangeBounds(range);
  const a = new Date(start);
  let period: string;
  if (range.mode === "day") period = monthDay(a);
  else if (range.mode === "month")
    period = a.toLocaleDateString("id-ID", { month: "short", year: "numeric" }).replace(/\./g, "");
  else if (range.mode === "year") period = String(a.getFullYear());
  else period = `${monthDay(a)} - ${monthDay(new Date(end - 1))}`;
  return `${store}-${tab}-${period}`.replace(/[\\/:*?"<>|]/g, "");
}

const toNum = (v: string): string | number => {
  const m = v.match(/^(-?)\s*(?:Rp\s?)?(\d{1,3}(?:\.\d{3})+|\d+)$/);
  return m ? Number(m[1] + m[2]!.replace(/\./g, "")) : v;
};

export async function exportTabExcel(root: Element, store: string, tab: string, period: string, range: ReportRange) {
  const XLSX = await import("xlsx");
  const aoa: (string | number)[][] = [[store], [tab], [period], []];
  sectionsFromElement(root).forEach((s) => {
    if (s.title) aoa.push([s.title]);
    if (s.head?.length) aoa.push(s.head);
    s.rows.forEach((r) => aoa.push(r.map(toNum)));
    aoa.push([]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tab.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  XLSX.writeFile(wb, `${exportFileName(store, tab, range)}.xlsx`);
}

export async function exportTabPdf(root: Element, store: string, tab: string, period: string, range: ReportRange) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  doc.setFontSize(14).setFont("helvetica", "bold").text(store, margin, 50);
  doc.setFontSize(11).setFont("helvetica", "normal").text(tab, margin, 68);
  doc.setFontSize(9).setTextColor(100).text(period, margin, 82).setTextColor(0);
  let y = 100;
  sectionsFromElement(root).forEach((s) => {
    const width = Math.max(s.head?.length ?? 0, ...s.rows.map((r) => r.length), 1);
    const body = s.rows.map((r) =>
      r.length === 1 && width > 1 ? [{ content: r[0]!, colSpan: width }] : r,
    );
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: s.title || s.head?.length ? [
        ...(s.title ? [[{ content: s.title, colSpan: width, styles: { fillColor: [40, 40, 40] as [number, number, number] } }]] : []),
        ...(s.head?.length ? [s.head] : []),
      ] : [],
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [90, 90, 90] },
      columnStyles: Object.fromEntries(Array.from({ length: width - 1 }, (_, i) => [i + 1, { halign: "right" }])),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  });
  doc.save(`${exportFileName(store, tab, range)}.pdf`);
}
