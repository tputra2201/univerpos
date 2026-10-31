import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setBranding } from "@/lib/pos/branding";
import { IconCropper } from "@/components/pos/icon-cropper";

const db = supabase as unknown as { from: (t: string) => any };

export function BrandingPanel() {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(true);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    db.from("app_settings").select("app_name, app_icon").eq("id", 1).maybeSingle()
      .then(({ data }: { data: { app_name: string; app_icon: string } | null }) => {
        setName(data?.app_name ?? "Kasir UKM");
        setIcon(data?.app_icon ?? "");
        setBusy(false);
      });
  }, []);

  async function save(): Promise<unknown> {
    if (!name.trim()) return toast.error("Isi nama aplikasi.");
    setBusy(true);
    const { error } = await db.from("app_settings").upsert({ id: 1, app_name: name.trim(), app_icon: icon, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBranding({ name: name.trim(), icon });
    toast.success("Nama & ikon aplikasi disimpan.");
    return undefined;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identitas Aplikasi</CardTitle>
        <CardDescription>Dipakai di tab browser, saat install aplikasi, halaman login, dan dashboard kasir.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">
        <img src={icon || "/icon-192.png"} alt="Ikon" className="size-20 rounded-2xl border object-cover" />
        <div className="grid min-w-0 flex-1 gap-3">
          <div className="space-y-1">
            <Label htmlFor="app-name">Nama Aplikasi</Label>
            <Input id="app-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="app-icon">Ikon Aplikasi (PNG/JPG)</Label>
            <Input id="app-icon" type="file" accept="image/*" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCropSrc(URL.createObjectURL(f));
              e.target.value = "";
            }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void save()}>Simpan</Button>
            {icon && <Button variant="outline" onClick={() => setCropSrc(icon)}>Atur ulang</Button>}
            {icon && <Button variant="outline" onClick={() => setIcon("")}>Pakai ikon bawaan</Button>}
          </div>
          {cropSrc && (
            <IconCropper src={cropSrc} onCancel={() => setCropSrc(null)} onDone={(d) => { setIcon(d); setCropSrc(null); }} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
