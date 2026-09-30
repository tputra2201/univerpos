import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePos } from "@/lib/pos/store";
import { hasPerm } from "@/lib/pos/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DeviceRow {
  id: string;
  device_name: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  max_devices: number;
  current_user_name?: string;
  current_user_role?: string;
  shift_open?: boolean;
}

export function DevicesCard() {
  const { db, currentUser } = usePos();
  const code = db.settings.storeCode;
  const key = db.settings.activationKey ?? "";
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");

  const load = useCallback(async () => {
    if (!code || !key) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("store_devices_list", { _code: code, _key: key });
    setBusy(false);
    if (error) {
      toast.error("Tidak bisa memuat daftar perangkat. Periksa koneksi internet.");
      return;
    }
    setRows((data as DeviceRow[]) ?? []);
  }, [code, key]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function release(d: DeviceRow) {
    if (!currentUser || !hasPerm(db.settings, currentUser.role, "settings.manage")) {
      toast.error("Hanya manajer atau pemilik yang boleh melepas perangkat.");
      return;
    }
    if (pin !== currentUser.pin) {
      toast.error("PIN manajer salah.");
      return;
    }
    if (!confirm(`Lepas perangkat "${d.device_name}"? Perangkat itu harus diaktifkan ulang.`)) return;
    const { error } = await supabase.rpc("release_device", { _code: code, _key: key, _device_id: d.id });
    if (error) {
      toast.error("Gagal melepas perangkat.");
      return;
    }
    toast.success("Perangkat dilepas. Kuota kembali tersedia.");
    setPin("");
    void load();
  }

  const max = rows?.[0]?.max_devices ?? 0;
  const thisToken = db.settings.deviceName ?? "-";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-4" /> Perangkat Store
        </CardTitle>
        <CardDescription>
          Perangkat ini: <span className="font-semibold">{thisToken}</span>
          {rows && ` • terpakai ${rows.length} / ${max > 0 ? max : "∞"} perangkat`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!key && (
          <p className="text-sm text-muted-foreground">
            Store ini diaktifkan dengan cara lama, jadi daftar perangkat belum tersedia.
          </p>
        )}
        {key && busy && rows === null && <Loader2 className="size-4 animate-spin text-primary" />}
        {rows?.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <div className="min-w-0 flex-1 break-words">
              <p className="font-semibold">{d.device_name}</p>
              <p className="text-sm">
                <span className={`mr-1 inline-block size-2 rounded-full ${Date.now() - new Date(d.last_seen_at).getTime() < 5 * 60_000 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                {d.current_user_name
                  ? `${d.current_user_name}${d.current_user_role ? ` (${d.current_user_role})` : ""}${d.shift_open ? " • shift dibuka" : ""}`
                  : "Tidak ada yang login"}
              </p>
              <p className="text-xs text-muted-foreground">
                aktif terakhir {new Date(d.last_seen_at).toLocaleString("id-ID")}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => release(d)}>
              Lepas Perangkat
            </Button>
          </div>
        ))}
        {key && rows?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada perangkat terdaftar.</p>}
        {key && (
          <div className="space-y-1">
            <Label htmlFor="dev-pin">PIN Manajer / Pemilik (untuk melepas perangkat)</Label>
            <Input
              id="dev-pin"
              type="password"
              inputMode="numeric"
              className="max-w-40 font-mono tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <p className="text-xs text-muted-foreground">
              Ganti perangkat: lepas perangkat lama di sini, lalu aktifkan perangkat baru dengan Kode Store{" "}
              <span className="font-mono">{code}</span> dan kunci aktivasi yang sama.
            </p>
          </div>
        )}
        <Button size="sm" variant="ghost" onClick={load} disabled={busy || !key}>
          Muat ulang
        </Button>
      </CardContent>
    </Card>
  );
}
