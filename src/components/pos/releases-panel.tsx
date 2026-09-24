import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandingPanel } from "@/components/pos/branding-panel";

interface Release { id: string; version: string; notes: string; created_at: string }
interface Req {
  id: string; status: string; current_version: string; target_version: string;
  requested_by: string; created_at: string; stores: { name: string; code: string } | null;
}
interface StoreV { id: string; name: string; code: string; app_version: string }

export function ReleasesPanel() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [stores, setStores] = useState<StoreV[]>([]);
  const [form, setForm] = useState({ version: "", notes: "" });

  const load = useCallback(async () => {
    const [r, q, s] = await Promise.all([
      supabase.from("app_releases").select("*").order("created_at", { ascending: false }),
      supabase.from("update_requests").select("*, stores(name, code)").order("created_at", { ascending: false }).limit(50),
      supabase.from("stores").select("id, name, code, app_version").order("name"),
    ]);
    setReleases((r.data as Release[]) ?? []);
    setReqs((q.data as unknown as Req[]) ?? []);
    setStores((s.data as StoreV[]) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add(): Promise<unknown> {
    const version = form.version.trim();
    if (!version) return toast.error("Isi nomor versi.");
    const { error } = await supabase.from("app_releases").insert({ version, notes: form.notes.trim() });
    if (error) return toast.error(error.message.includes("duplicate") ? "Versi sudah ada." : error.message);
    setForm({ version: "", notes: "" });
    toast.success(`Rilis ${version} diterbitkan.`);
    void load();
    return undefined;
  }

  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("update_requests").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    void load();
  }

  async function removeRelease(r: Release) {
    if (!confirm(`Hapus rilis ${r.version}?`)) return;
    await supabase.from("app_releases").delete().eq("id", r.id);
    void load();
  }

  const latest = releases[0]?.version;
  const statusLabel: Record<string, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak", applied: "Terpasang" };

  return (
    <div className="space-y-4">
      <BrandingPanel />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permintaan Update dari Store</CardTitle>
          <CardDescription>Setujui agar manager/installer bisa memasang versi terbaru di store.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reqs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada permintaan.</p>}
          {reqs.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
              <div className="min-w-0 flex-1 break-words">
                <div className="font-medium">{q.stores?.name ?? "-"} <span className="font-mono text-muted-foreground">{q.stores?.code}</span></div>
                <div className="text-muted-foreground">
                  <span className="font-mono">{q.current_version || "?"} → {q.target_version}</span> • oleh {q.requested_by || "-"} • {new Date(q.created_at).toLocaleString("id-ID")}
                </div>
              </div>
              <Badge variant={q.status === "pending" ? "default" : "secondary"}>{statusLabel[q.status] ?? q.status}</Badge>
              {q.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => void decide(q.id, "approved")}>Setujui</Button>
                  <Button size="sm" variant="outline" onClick={() => void decide(q.id, "rejected")}>Tolak</Button>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terbitkan Rilis Baru</CardTitle>
          <CardDescription>Rilis terakhir yang diterbitkan menjadi versi tujuan update semua store.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="rel-v">Versi</Label>
            <Input id="rel-v" className="font-mono" placeholder="1.1.0" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rel-n">Catatan rilis</Label>
            <Textarea id="rel-n" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button className="justify-self-start" onClick={() => void add()}>Terbitkan</Button>
          <div className="space-y-2 pt-2">
            {releases.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start gap-2 rounded-md border p-3 text-sm">
                <div className="min-w-0 flex-1 break-words">
                  <div className="font-mono font-semibold">{r.version} {r.version === latest && <Badge className="ml-1">Terbaru</Badge>}</div>
                  {r.notes && <p className="whitespace-pre-line text-muted-foreground">{r.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" aria-label="Hapus rilis" onClick={() => void removeRelease(r)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Versi per Store</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {stores.map((s) => (
            <div key={s.id} className="flex flex-wrap justify-between gap-2 border-b py-1 last:border-0">
              <span>{s.name} <span className="font-mono text-muted-foreground">{s.code}</span></span>
              <span className="font-mono">
                {s.app_version || "belum tercatat"}
                {latest && s.app_version && s.app_version !== latest && <Badge variant="outline" className="ml-2">Tertinggal</Badge>}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
