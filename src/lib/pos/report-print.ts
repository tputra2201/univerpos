/** Ubah isi tab laporan yang sedang tampil menjadi blok teks untuk dicetak. */
import type { ReportBlock } from "./receipt";

const txt = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

export function blocksFromElement(root: Element): ReportBlock[] {
  const out: ReportBlock[] = [];
  const walk = (el: Element) => {
    if (el instanceof HTMLElement && (el.hidden || el.tagName === "BUTTON" || el.tagName === "INPUT")) return;
    if (el.hasAttribute("data-print-title")) {
      const t = txt(el);
      if (t) out.push({ type: "title", text: t });
      return;
    }
    if (el.hasAttribute("data-print-row")) {
      const [a, b] = Array.from(el.children);
      out.push({ type: "row", label: a ? txt(a) : "", value: b ? txt(b) : "" });
      return;
    }
    if (el.tagName === "TABLE") {
      const heads = Array.from(el.querySelectorAll("thead th")).map(txt);
      el.querySelectorAll("tbody tr").forEach((tr) => {
        const cells = Array.from(tr.children).map(txt);
        if (cells.length <= 3) {
          out.push({ type: "row", label: cells.slice(0, -1).join(" x"), value: cells.at(-1) ?? "" });
        } else {
          out.push({ type: "text", text: `• ${cells[0] ?? ""}` });
          cells.slice(1).forEach((c, i) => c && out.push({ type: "row", label: `  ${heads[i + 1] ?? ""}`, value: c }));
        }
      });
      return;
    }
    const kids = Array.from(el.children);
    // Kartu ringkasan: label + angka
    if (kids.length === 2 && kids.every((k) => k.tagName === "P") && el.className.includes("border")) {
      out.push({ type: "row", label: txt(kids[0]!), value: txt(kids[1]!) });
      return;
    }
    if (kids.length === 0) {
      const t = txt(el);
      if (t) out.push({ type: "text", text: t });
      return;
    }
    kids.forEach(walk);
  };
  walk(root);
  return out;
}
