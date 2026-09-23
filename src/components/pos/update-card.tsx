import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePos } from "@/lib/pos/store";
import { INSTALLED_VERSION_KEY, UPDATE_REQUEST_KEY, installedVersion } from "@/lib/pos/version";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "pending" | "approved" | "rejected" | "applied";

export function UpdateCard() {
  const { db, currentUser } = usePos();
  const [current, setCurrent] = useState("");
  const [latest, setLatest] = useState<{ version: string; notes: string } | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(id = reqId) {
    const { data } = await supabase.rpc("latest_release");
    setLatest(data?.[0] ?? null);
    if (id) {
      const { data: s } = await supabase.rpc("update_request_status", { _id: id });
      setStatus((s?.[0]?.status as Status) ?? null);
    }
  }

  useEffect(() => {
    setCurrent(installedVersion());
    const id = localStorage.getItem(UPDATE_REQUEST_KEY);
    setReqId(id);
    void refresh(id).catch(() => toast.error("Tidak bisa terhubung ke server."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "pending") return;
    const t = setInterval(() => void refresh(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reqId]);

  async function request() {
    setBusy(true);
    const { data, error } = await supabase.rpc("request_update", {
      _code: db.settings.storeCode,
      _current: current,
      _by: currentUser?.name ?? "",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    localStorage.setItem(UPDATE_REQUEST_KEY, data as string);
    setReqId(data as string);
    setStatus("pending");
    toast.success("Permintaan update terkirim ke developer.");
  }

  async function apply() {
    if (!latest || !reqId) return;
    setBusy(true);
    // Cadangan otomatis sebelum update.
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-sebelum-update-${current}.json`;
    a.click();
    const { error } = await supabase.rpc("mark_update_applied", { _id: reqId, _version: latest.version });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    localStorage.setItem(INSTALLED_VERSION_KEY, latest.version);
    localStorage.removeItem(UPDATE_REQUEST_KEY);
    if ("caches" in window) {
      for (const k of await caches.keys()) await caches.delete(k);
    }
    window.location.reload();
  }

  const hasUpdate = latest && latest.version !== current;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pembaruan Sistem</CardTitle>
        <CardDescription>
          Update hanya bisa dipasang setelah disetujui developer. Pastikan tidak ada transaksi berjalan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-4">
          <div>Versi terpasang: <span className="font-mono font-semibold">{current || "-"}</span></div>
          <div>Versi terbaru: <span className="font-mono font-semibold">{latest?.version ?? "-"}</span></div>
          {status && <Badge variant="secondary">{{ pending: "Menunggu persetujuan", approved: "Disetujui", rejected: "Ditolak", applied: "Terpasang" }[status]}</Badge>}
        </div>
        {hasUpdate && latest?.notes && (
          <p className="whitespace-pre-line rounded-md bg-muted p-3 text-muted-foreground">{latest.notes}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Cek pembaruan
          </Button>
          {hasUpdate && status !== "pending" && status !== "approved" && (
            <Button size="sm" disabled={busy} onClick={() => void request()}>Minta izin update</Button>
          )}
          {hasUpdate && status === "approved" && (
            <Button size="sm" disabled={busy} onClick={() => void apply()}>Pasang update sekarang</Button>
          )}
        </div>
        {!hasUpdate && latest && <p className="text-muted-foreground">Aplikasi sudah versi terbaru.</p>}
      </CardContent>
    </Card>
  );
}
