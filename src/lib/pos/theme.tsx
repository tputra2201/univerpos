import { useEffect } from "react";
import { usePos } from "./store";

export interface ThemePreset {
  id: string;
  name: string;
  hint: string;
  /** Warna utama terang & gelap (oklch). */
  light: string;
  dark: string;
  accent: string;
  hue: number;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "logo", name: "Ikuti logo", hint: "Warna diambil dari ikon aplikasi", light: "", dark: "", accent: "", hue: 0 },
  { id: "teal", name: "Hijau Toska", hint: "Bawaan, segar untuk semua usaha", light: "oklch(0.44 0.085 196)", dark: "oklch(0.72 0.11 190)", accent: "oklch(0.82 0.15 72)", hue: 200 },
  { id: "ocean", name: "Biru Samudra", hint: "Retail, elektronik, apotek", light: "oklch(0.48 0.15 255)", dark: "oklch(0.7 0.14 250)", accent: "oklch(0.82 0.13 200)", hue: 255 },
  { id: "forest", name: "Hijau Daun", hint: "Sayur, kopi, produk alami", light: "oklch(0.47 0.12 150)", dark: "oklch(0.72 0.14 150)", accent: "oklch(0.84 0.14 100)", hue: 150 },
  { id: "sunset", name: "Oranye Senja", hint: "Kuliner, jajanan, fast food", light: "oklch(0.58 0.17 45)", dark: "oklch(0.74 0.15 50)", accent: "oklch(0.85 0.14 85)", hue: 45 },
  { id: "cherry", name: "Merah Ceri", hint: "Resto, bakery, dessert", light: "oklch(0.5 0.19 20)", dark: "oklch(0.7 0.17 18)", accent: "oklch(0.85 0.12 70)", hue: 20 },
  { id: "violet", name: "Ungu Anggur", hint: "Salon, spa, butik", light: "oklch(0.47 0.16 300)", dark: "oklch(0.72 0.14 300)", accent: "oklch(0.84 0.12 340)", hue: 300 },
  { id: "charcoal", name: "Arang Emas", hint: "Barbershop, bar, kafe malam", light: "oklch(0.3 0.02 250)", dark: "oklch(0.82 0.13 80)", accent: "oklch(0.8 0.14 80)", hue: 250 },
  { id: "rose", name: "Merah Muda", hint: "Kosmetik, bunga, kado", light: "oklch(0.58 0.16 355)", dark: "oklch(0.76 0.13 355)", accent: "oklch(0.86 0.1 20)", hue: 355 },
];

export type ThemeMode = "light" | "dark" | "system";

const VARS = ["--primary", "--primary-foreground", "--ring", "--chart-1", "--accent", "--sidebar", "--sidebar-accent", "--sidebar-border", "--sidebar-primary", "--sidebar-ring"];

/** Terapkan tema store: preset warna + mode terang/gelap. */
export function useStoreTheme() {
  const { db } = usePos();
  const id = db.settings.themeId ?? "logo";
  const mode: ThemeMode = db.settings.themeMode ?? "light";
  useEffect(() => {
    const el = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && mq.matches);
      el.classList.toggle("dark", dark);
      const p = THEME_PRESETS.find((t) => t.id === id);
      if (!p || p.id === "logo") {
        if (el.dataset.storeTheme) { VARS.forEach((v) => el.style.removeProperty(v)); delete el.dataset.storeTheme; window.dispatchEvent(new Event("pos-theme-reset")); }
        return;
      }
      el.dataset.storeTheme = p.id;
      const col = dark ? p.dark : p.light;
      const s = el.style;
      s.setProperty("--primary", col);
      s.setProperty("--primary-foreground", dark ? "oklch(0.18 0.02 250)" : "oklch(0.985 0.01 95)");
      s.setProperty("--ring", col);
      s.setProperty("--chart-1", col);
      s.setProperty("--accent", p.accent);
      s.setProperty("--sidebar-primary", p.accent);
      s.setProperty("--sidebar-ring", p.accent);
      s.setProperty("--sidebar", `oklch(${dark ? 0.22 : 0.28} 0.04 ${p.hue})`);
      s.setProperty("--sidebar-accent", `oklch(${dark ? 0.3 : 0.35} 0.05 ${p.hue})`);
      s.setProperty("--sidebar-border", `oklch(${dark ? 0.32 : 0.38} 0.045 ${p.hue})`);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [id, mode]);
}

export function StoreThemeApplier() {
  useStoreTheme();
  return null;
}
