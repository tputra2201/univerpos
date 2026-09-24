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

/** Terapkan nama & ikon ke tab browser. */
export function useApplyBranding() {
  const b = useBranding();
  useEffect(() => {
    document.title = b.name;
    const href = b.icon || "/favicon.png";
    document.querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='apple-touch-icon']").forEach((l) => { l.href = href; });
    document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']")?.setAttribute("content", b.name);
  }, [b]);
}

export function BrandIcon({ className }: { className?: string }) {
  const b = useBranding();
  return <img src={b.icon || "/icon-192.png"} alt={b.name} className={className} />;
}
