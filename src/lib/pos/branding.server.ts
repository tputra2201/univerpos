import { createClient } from "@supabase/supabase-js";

export async function fetchBranding(): Promise<{ name: string; icon: string }> {
  try {
    const sb = createClient(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { data } = await sb.rpc("app_branding" as never);
    const row = (data as unknown as { app_name: string; app_icon: string }[] | null)?.[0];
    return { name: row?.app_name || "Kasir UKM", icon: row?.app_icon || "" };
  } catch {
    return { name: "Kasir UKM", icon: "" };
  }
}
