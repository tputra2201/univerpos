import { Bluetooth, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bluetoothSupported, pickBluetoothPrinter } from "@/lib/pos/print";
import { PRINTER_ROLES, PRINTER_ROLE_LABEL, newPrinter, sendToPrinter } from "@/lib/pos/printers";
import { usePos } from "@/lib/pos/store";
import type { PrinterConfig, PrinterRole } from "@/lib/pos/types";

const AUTO_LABEL: Record<PrinterRole, string> = {
  receipt: "Cetak otomatis setelah pembayaran",
  bill: "Langsung cetak tanpa pratinjau",
  kitchen: "Cetak otomatis saat pesanan dikirim",
  bar: "Cetak otomatis saat pesanan dikirim",
  report: "Langsung cetak tanpa pratinjau",
};

function testLines(p: PrinterConfig): string[] {
  const w = p.paperWidth;
  return ["=".repeat(w), "UJI CETAK", p.name, PRINTER_ROLE_LABEL[p.role], new Date().toLocaleString("id-ID"), "=".repeat(w)];
}

export function PrintersSettings() {
  const { db, update } = usePos();
  const printers = db.printer.printers ?? [];

  function save(next: PrinterConfig[]) {
    update((cur) => ({ ...cur, printer: { ...cur.printer, printers: next } }));
  }
  function patch(id: string, p: Partial<PrinterConfig>) {
    save(printers.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Printer per Dokumen</CardTitle>
        <CardDescription>
          Atur printer untuk Struk, Tagihan, Tiket Stasiun 1, Tiket Stasiun 2, dan Laporan.
          Tujuan tiket tiap item diatur di halaman Produk. Pengaturan ini khusus perangkat ini.
          Bila jenis dokumen belum punya printer, Tagihan &amp; Laporan memakai printer Struk dan
          Tiket Stasiun 2 memakai printer Tiket Stasiun 1.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {printers.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Belum ada printer. Semua dokumen memakai pengaturan printer thermal di bawah.
          </p>
        )}
        {printers.map((p) => (
          <div key={p.id} className="space-y-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge>{PRINTER_ROLE_LABEL[p.role].split(" (")[0]}</Badge>
                {!p.active && <Badge variant="outline">Nonaktif</Badge>}
                {p.deviceName && <Badge variant="secondary">{p.deviceName}</Badge>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Switch checked={p.active} onCheckedChange={(v) => patch(p.id, { active: v })} aria-label={`Aktif ${p.name}`} />
                Aktif
                <Button size="icon" variant="ghost" aria-label={`Hapus ${p.name}`} onClick={() => save(printers.filter((x) => x.id !== p.id))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Nama printer</Label>
                <Input className="h-11" value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis dokumen</Label>
                <Select value={p.role} onValueChange={(v) => patch(p.id, { role: v as PrinterRole })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRINTER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{PRINTER_ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ukuran kertas</Label>
                <Select value={String(p.paperWidth)} onValueChange={(v) => patch(p.id, { paperWidth: v === "48" ? 48 : 32 })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="32">58mm</SelectItem>
                    <SelectItem value="48">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cara mencetak</Label>
                <Select value={p.mode} onValueChange={(v) => patch(p.id, { mode: v === "bluetooth" ? "bluetooth" : "dialog" })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dialog">Dialog cetak perangkat</SelectItem>
                    <SelectItem value="bluetooth">Printer Bluetooth langsung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Salinan</Label>
                <Input
                  className="tabular h-11"
                  inputMode="numeric"
                  value={String(p.copies)}
                  onChange={(e) => patch(p.id, { copies: Math.min(5, Number(e.target.value.replace(/\D/g, "")) || 1) })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <Switch checked={p.autoPrint} onCheckedChange={(v) => patch(p.id, { autoPrint: v })} />
                {AUTO_LABEL[p.role]}
              </label>
              {(p.role === "kitchen" || p.role === "bar") && (
                <>
                  <label className="flex items-center gap-2">
                    <Switch checked={p.printTicket !== false} onCheckedChange={(v) => patch(p.id, { printTicket: v })} />
                    Cetak tiket pesanan
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={Boolean(p.printLabels)} onCheckedChange={(v) => patch(p.id, { printLabels: v })} />
                    Cetak label per item
                  </label>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.mode === "bluetooth" && (
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={!bluetoothSupported()}
                  onClick={async () => {
                    try {
                      const d = await pickBluetoothPrinter();
                      patch(p.id, { deviceId: d.id, deviceName: d.name });
                      toast.success(`${d.name} dipasang ke ${p.name}.`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Pencarian printer dibatalkan.");
                    }
                  }}
                >
                  <Bluetooth className="size-4" />
                  {bluetoothSupported() ? "Pilih Printer Bluetooth" : "Bluetooth tak didukung"}
                </Button>
              )}
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() =>
                  sendToPrinter(p, testLines(p)).catch((err: unknown) =>
                    toast.error(err instanceof Error ? err.message : "Uji cetak gagal."),
                  )
                }
              >
                <Printer className="size-4" /> Uji cetak
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {PRINTER_ROLES.map((r) => (
            <Button key={r} variant="outline" className="gap-1" onClick={() => save([...printers, newPrinter(r, db.printer)])}>
              <Plus className="size-4" /> {PRINTER_ROLE_LABEL[r].split(" (")[0]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
