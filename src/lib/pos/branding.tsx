import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Branding { name: string; icon: string }
const KEY = "wo-pos-branding";
export const DEFAULT_BRANDING: Branding = { name: "Kasir UKM", icon: "" };

const listeners = new Set<(b: Branding) => void>();

function read(): Branding {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_BRANDING, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_BRANDING;
}

export function setBranding(b: Branding) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* ignore */ }
  listeners.forEach((l) => l(b));
}

let fetched = false;
async function refresh() {
  const { data } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: { app_name: string; app_icon: string }[] | null }> }).rpc("app_branding");
  const row = data?.[0];
  if (row) setBranding({ name: row.app_name || DEFAULT_BRANDING.name, icon: row.app_icon || "" });
}

export function useBranding(): Branding {
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING);
  useEffect(() => {
    setB(read());
    listeners.add(setB);
    if (!fetched && navigator.onLine) { fetched = true; void refresh().catch(() => { fetched = false; }); }
    return () => { listeners.delete(setB); };
  }, []);
  return b;
}

/** Ambil warna dominan (yang paling berwarna) dari gambar. */
function dominantColor(src: string): Promise<[number, number, number] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 40;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 40, 40);
        const d = Array.from(ctx.getImageData(0, 0, 40, 40).data) as number[];
        let r = 0, g = 0, bl = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          if ((d[i + 3] ?? 0) < 128) continue;
          const max = Math.max((d[i] ?? 0), (d[i + 1] ?? 0), (d[i + 2] ?? 0)), min = Math.min((d[i] ?? 0), (d[i + 1] ?? 0), (d[i + 2] ?? 0));
          const sat = max === 0 ? 0 : (max - min) / max;
          if (max > 240 && sat < 0.1) continue; // putih
          if (max < 25) continue; // hitam
          const wt = 0.05 + sat * sat;
          r += (d[i] ?? 0) * wt; g += (d[i + 1] ?? 0) * wt; bl += (d[i + 2] ?? 0) * wt; w += wt;
        }
        resolve(w ? [Math.round(r / w), Math.round(g / w), Math.round(bl / w)] : null);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const THEME_VARS = ["--primary", "--primary-foreground", "--ring", "--chart-1", "--sidebar", "--sidebar-accent", "--sidebar-border"];

function applyTheme(rgb: [number, number, number] | null) {
  // Tema store dipilih manual: jangan ditimpa warna logo.
  if (document.documentElement.dataset["storeTheme"]) return;
  const root = document.documentElement.style;
  const meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
  if (!rgb) { THEME_VARS.forEach((v) => root.removeProperty(v)); meta?.setAttribute("content", "#04585a"); return; }
  const [r, g, b] = rgb;
  const col = `rgb(${r} ${g} ${b})`;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  root.setProperty("--primary", col);
  root.setProperty("--primary-foreground", lum > 0.62 ? "oklch(0.2 0.02 200)" : "oklch(0.985 0.01 95)");
  root.setProperty("--ring", col);
  root.setProperty("--chart-1", col);
  root.setProperty("--sidebar", `color-mix(in oklab, ${col} 45%, oklch(0.2 0.02 220))`);
  root.setProperty("--sidebar-accent", `color-mix(in oklab, ${col} 45%, oklch(0.3 0.02 220))`);
  root.setProperty("--sidebar-border", `color-mix(in oklab, ${col} 40%, oklch(0.35 0.02 220))`);
  meta?.setAttribute("content", `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`);
}

/** Terapkan nama, ikon & warna tema dari logo. */
export function useApplyBranding() {
  const b = useBranding();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("pos-theme-reset", on);
    return () => window.removeEventListener("pos-theme-reset", on);
  }, []);
  useEffect(() => {
    document.title = b.name;
    const href = b.icon || "/favicon.png";
    document.querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='apple-touch-icon']").forEach((l) => { l.href = href; });
    document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']")?.setAttribute("content", b.name);
    let alive = true;
    if (b.icon) void dominantColor(b.icon).then((c) => { if (alive) applyTheme(c); });
    else applyTheme(null);
    return () => { alive = false; };
  }, [b, tick]);
}

export function BrandIcon({ className }: { className?: string }) {
  const b = useBranding();
  return <img src={b.icon || "/icon-192.png"} alt={b.name} className={className} />;
}
