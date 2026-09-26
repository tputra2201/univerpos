import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePos } from "@/lib/pos/store";
import { emptyDatabase } from "@/lib/pos/seed";
import { SYNC_BASE_KEY, SYNC_CURSOR_KEY } from "@/lib/pos/sync";

const DEVICE_TOKEN_KEY = "wo-pos-device-token";
export const DEV_USER_PREFIX = "dev:";

type StoreRow = { code: string; name: string };

/** Hook: apakah perangkat ini sedang login sebagai developer (akun Portal Kontrol). */
export function useDeveloper() {
  const [dev, setDev] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return alive && setDev(null);
      const { data: ok } = await supabase.rpc("has_role", { _user_id: u.id, _role: "developer" });
      if (alive) setDev(ok ? { id: u.id, name: (u.user_metadata?.["name"] as string) || u.email || "Developer" } : null);
    };
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void check());
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return dev;
}

/** Dropdown pindah store untuk developer (hanya store mode online). */
export function DevStoreSwitcher({ compact }: { compact?: boolean }) {
  const dev = useDeveloper();
  const { db, replaceAll, signIn } = usePos();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dev) return;
    supabase
      .from("stores")
      .select("code, name")
      .eq("mode", "online")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setStores(data ?? []));
  }, [dev]);

  if (!dev) return null;

  async function switchTo(code: string) {
    if (!code || code === db.settings.storeCode) return;
    if (!window.confirm(`Pindah ke store ${code}? Data store ini di perangkat akan diganti dengan data store tujuan.`)) return;
    setBusy(true);
    let token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      token = `dev_${crypto.randomUUID()}`;
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
    const { data, error } = await supabase.rpc("dev_attach_device" as never, {
      _code: code,
      _token: token,
      _device_name: `Developer · ${dev!.name}`.slice(0, 60),
    } as never);
    setBusy(false);
    const row = Array.isArray(data) ? (data[0] as Record<string, any>) : null;
    if (error || !row) {
      toast.error(error?.message.replace(/^.*?:\s*/, "") || "Gagal pindah store.");
      return;
    }
    localStorage.removeItem(SYNC_CURSOR_KEY);
    localStorage.removeItem(SYNC_BASE_KEY);
    const base = emptyDatabase();
    replaceAll({
      ...base,
      users: [],
      settings: {
        ...base.settings,
        activated: true,
        storeCode: row["code"],
        storeMode: "online",
        name: row["name"],
        businessTypeName: row["business_type_name"] ?? "",
        expiresAt: row["expires_at"] ?? null,
        activationKey: row["activation_key"],
        activatedAt: new Date().toISOString(),
        deviceToken: token,
        deviceName: "Developer",
      },
    });
    signIn({ id: `${DEV_USER_PREFIX}${dev!.id}`, name: dev!.name, role: "owner", pin: "" });
    toast.success(`Pindah ke ${row["name"]}. Data store sedang diunduh.`);
  }

  return (
    <label className={`flex items-center gap-2 ${compact ? "" : "w-full"}`}>
      <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
      <select
        aria-label="Pindah store"
        disabled={busy}
        value={db.settings.storeCode}
        onChange={(e) => void switchTo(e.target.value)}
        className={`h-8 rounded-md border bg-background px-2 text-xs text-foreground ${compact ? "max-w-32" : "w-full"}`}
      >
        {!stores.some((s) => s.code === db.settings.storeCode) && (
          <option value={db.settings.storeCode}>{db.settings.storeCode || "Pilih store"}</option>
        )}
        {stores.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name} ({s.code})
          </option>
        ))}
      </select>
    </label>
  );
}
