import { deliverPin, pinMessage, randomPin } from "@/lib/pos/pin";
import { daysLeft, formatExpiry } from "@/lib/pos/expiry";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Bluetooth, Download, Plus, Trash2, Upload, Printer } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { usePos } from "@/lib/pos/store";
import { uid } from "@/lib/pos/format";
import { buildReceipt } from "@/lib/pos/receipt";
import { bluetoothSupported, pickBluetoothPrinter } from "@/lib/pos/print";
import { getServiceTypes, seedForBusiness } from "@/lib/pos/seed";
import type { BusinessType, PosDatabase, Sale, ServiceKind, ServiceType, UserRole } from "@/lib/pos/types";
import { roleLabel } from "@/lib/pos/roles";
import { UpdateCard } from "@/components/pos/update-card";
import { DevicesCard } from "@/components/pos/devices-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan Store — POS UKM" },
      {
        name: "description",
        content:
          "Atur identitas store, tipe usaha, pajak, pengguna, metode pembayaran, printer thermal, meja, dan pencadangan data.",
      },
      { property: "og:title", content: "Pengaturan Store — POS UKM" },
      {
        property: "og:description",
        content: "Identitas store, pajak, pengguna, metode pembayaran, printer, dan backup data.",
      },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <PengaturanPage />
      </AppShell>
    </PosGate>
  ),
});

function PengaturanPage() {
  const { db, update, replaceAll } = usePos();
  const [printLines, setPrintLines] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [newUser, setNewUser] = useState({ name: "", email: "", whatsapp: "", role: "cashier" as UserRole });
  const [newMethod, setNewMethod] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [newTable, setNewTable] = useState("");
  const [newStaff, setNewStaff] = useState("");

  function setSettings(patch: Partial<PosDatabase["settings"]>) {
    update((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function setPrinter(patch: Partial<PosDatabase["printer"]>) {
    update((current) => ({ ...current, printer: { ...current.printer, ...patch } }));
  }

  function changeBusinessType(type: BusinessType) {
    if (db.products.length > 0) {
      setSettings({ businessType: type });
      toast.success("Tipe usaha diperbarui. Produk yang ada tetap tersimpan.");
      return;
    }
    update((current) => seedForBusiness(current, type));
    toast.success("Tipe usaha diperbarui beserta contoh produk.");
  }

  function backup() {
    const blob = new Blob([JSON.stringify(db)], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${db.settings.name.replace(/\s+/g, "-").toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.posbak`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Berkas cadangan diunduh.");
  }

  async function restore(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as PosDatabase;
      if (!parsed.settings || !Array.isArray(parsed.products)) throw new Error("format");
      replaceAll(parsed);
      toast.success("Data berhasil dipulihkan dari cadangan.");
    } catch {
      toast.error("Berkas cadangan tidak valid.");
    }
  }

  function testPrint() {
    const sample: Sale = {
      id: "sample",
      code: "TEST-0001",
      createdAt: new Date().toISOString(),
      userName: "Uji Coba",
      items: [
        {
          lineId: "1",
          productId: "1",
          name: "Contoh Produk",
          variantName: "",
          unitPrice: 25000,
          qty: 2,
          note: "catatan contoh",
          discount: 0,
          staffName: "",
        },
      ],
      subtotal: 50000,
      discount: 0,
      tax: 0,
      service: 0,
      total: 50000,
      payments: [{ methodId: "pm_cash", methodName: "Tunai", amount: 50000 }],
      paid: 50000,
      change: 0,
      tableName: "",
      customerName: "",
      status: "paid",
      reason: "",
    };
    setPrintLines(buildReceipt("receipt", sample, db.settings, db.printer));
  }

  return (
    <div>
      <PageHeader title="Pengaturan" description="Sesuaikan aplikasi dengan cara kerja store Anda." />

      <Tabs defaultValue="store" className="p-4 md:p-6">
        <TabsList>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="layanan">Jenis Layanan</TabsTrigger>
          <TabsTrigger value="pengguna">Pengguna</TabsTrigger>
          <TabsTrigger value="pembayaran">Pembayaran</TabsTrigger>
          <TabsTrigger value="printer">Printer</TabsTrigger>
          <TabsTrigger value="operasional">Meja & Staf</TabsTrigger>
          <TabsTrigger value="perangkat">Perangkat</TabsTrigger>
          <TabsTrigger value="online">Online Order</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="perangkat" className="space-y-4">
          <DevicesCard />
        </TabsContent>

        <TabsContent value="store" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identitas Store</CardTitle>
              <CardDescription>Nama store dan tipe usaha mengikuti data yang terdaftar di panel kontrol.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Nama store">
                <Input
                  value={db.settings.name}
                  readOnly
                  disabled
                  className="h-11"
                />
              </Field>
              <Field label="Telepon">
                <Input
                  value={db.settings.phone}
                  onChange={(e) => setSettings({ phone: e.target.value })}
                  className="h-11"
                />
              </Field>
              <Field label="Email Store">
                <Input
                  type="email"
                  value={db.settings.email ?? ""}
                  onChange={(e) => setSettings({ email: e.target.value })}
                  placeholder="store@contoh.com"
                  className="h-11"
                />
              </Field>
              <Field label="Alamat" className="md:col-span-2">
                <Input
                  value={db.settings.address}
                  onChange={(e) => setSettings({ address: e.target.value })}
                  className="h-11"
                />
              </Field>
              <Field label="Tipe usaha">
                <Input
                  value={
                    db.settings.businessTypeName ||
                    { kuliner: "Kuliner", retail: "Retail", jasa: "Jasa" }[db.settings.businessType]
                  }
                  readOnly
                  disabled
                  className="h-11"
                />
              </Field>
              <Field label="Kode store (aktivasi)">
                <Input value={db.settings.storeCode} readOnly className="h-11 font-mono" />
              </Field>
              <Field label="Tanggal mulai aktivasi">
                <Input
                  value={
                    db.settings.activatedAt
                      ? new Date(db.settings.activatedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
                      : "Belum tercatat"
                  }
                  readOnly
                  disabled
                  className="h-11"
                />
              </Field>
              <Field label="Jam operasional">
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label="Jam buka"
                    value={db.settings.openTime ?? ""}
                    onChange={(e) => setSettings({ openTime: e.target.value })}
                    className="h-11 min-w-0 flex-1"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    aria-label="Jam tutup"
                    value={db.settings.closeTime ?? ""}
                    onChange={(e) => setSettings({ closeTime: e.target.value })}
                    className="h-11 min-w-0 flex-1"
                  />
                </div>
              </Field>
              <Field label="Masa berlaku sampai">
                <Input
                  value={(() => {
                    const l = daysLeft(db.settings.expiresAt);
                    const f = formatExpiry(db.settings.expiresAt);
                    if (l === null) return f;
                    return l < 0 ? `${f} (kedaluwarsa)` : `${f} (${l} hari lagi)`;
                  })()}
                  readOnly
                  disabled
                  className={"h-11 " + ((daysLeft(db.settings.expiresAt) ?? 99) <= 10 ? "text-destructive" : "")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pajak & Layanan</CardTitle>
              <CardDescription>Dihitung otomatis pada setiap transaksi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                title="Pajak"
                desc="Tambahkan pajak pada total transaksi."
                checked={db.settings.taxEnabled}
                onCheckedChange={(v) => setSettings({ taxEnabled: v })}
              />
              {db.settings.taxEnabled && (
                <Field label="Persentase pajak (%)">
                  <Input
                    inputMode="numeric"
                    value={String(db.settings.taxPercent)}
                    onChange={(e) =>
                      setSettings({ taxPercent: Number(e.target.value.replace(/\D/g, "")) || 0 })
                    }
                    className="tabular h-11 max-w-32"
                  />
                </Field>
              )}
              <ToggleRow
                title="Biaya layanan"
                desc="Umum dipakai kafe dan restoran."
                checked={db.settings.serviceEnabled}
                onCheckedChange={(v) => setSettings({ serviceEnabled: v })}
              />
              {db.settings.serviceEnabled && (
                <Field label="Persentase layanan (%)">
                  <Input
                    inputMode="numeric"
                    value={String(db.settings.servicePercent)}
                    onChange={(e) =>
                      setSettings({ servicePercent: Number(e.target.value.replace(/\D/g, "")) || 0 })
                    }
                    className="tabular h-11 max-w-32"
                  />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nomor Order</CardTitle>
              <CardDescription>
                Format [kode layanan]-[6 digit]. Kode tiap layanan diatur di tab Jenis Layanan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Nomor urut berikutnya">
                <Input
                  id="order-seq"
                  inputMode="numeric"
                  value={String(db.settings.orderSeq ?? 1)}
                  onChange={(e) =>
                    setSettings({
                      orderSeq: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1),
                    })
                  }
                  className="tabular h-11 max-w-32 font-mono"
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                Contoh nomor berikutnya: <span className="font-mono">DI-{String(db.settings.orderSeq ?? 1).padStart(6, "0")}</span>
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setSettings({ orderSeq: 1 });
                  toast.success("Nomor order direset ke 000001.");
                }}
              >
                Reset nomor order
              </Button>
            </CardContent>
          </Card>
          <UpdateCard />
        </TabsContent>

        <TabsContent value="pengguna" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pengguna & Hak Akses</CardTitle>
              <CardDescription>
                Pemilik dapat membuka semua menu. Kasir hanya kasir, transaksi, dan laporan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {db.users.map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{u.name}</p>
                    <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                  </div>
                  <div className="hidden min-w-0 text-xs text-muted-foreground sm:block">
                    <p className="truncate">{u.whatsapp || "-"}</p>
                    <p className="truncate">{u.email || "-"}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!u.email && !u.whatsapp}
                    onClick={() => {
                      if (!window.confirm(`Buat PIN default baru untuk ${u.name} dan kirim ke ${u.whatsapp ? "WhatsApp" : "email"}-nya?`)) return;
                      const temp = randomPin();
                      update((current) => ({
                        ...current,
                        users: current.users.map((x) => (x.id === u.id ? { ...x, pin: temp, mustChangePin: true } : x)),
                      }));
                      void deliverPin({ email: u.email, whatsapp: u.whatsapp, subject: `PIN ${db.settings.name}`, message: pinMessage(db.settings.name, u.name, temp, true), storeCode: db.settings.storeCode, activationKey: db.settings.activationKey, storeName: db.settings.name, userName: u.name, pin: temp, temporary: true }).then((r) => (r.ok ? toast.success("PIN dikirim.") : toast.error(`PIN tidak terkirim: ${r.error}`)));
                    }}
                  >
                    Kirim Ulang PIN
                  </Button>
                  <EditUserButton user={u} />
                  
                  {db.users.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Hapus pengguna"
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          users: current.users.filter((x) => x.id !== u.id),
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
                <Field label="Nama">
                  <Input
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="h-10 w-40"
                  />
                </Field>
                <Field label="No. WhatsApp">
                  <Input
                    value={newUser.whatsapp}
                    inputMode="tel"
                    placeholder="08xxxx"
                    onChange={(e) => setNewUser({ ...newUser, whatsapp: e.target.value })}
                    className="h-10 w-40"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={newUser.email}
                    type="email"
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="h-10 w-48"
                  />
                </Field>
                <Field label="Peran">
                  <Select
                    value={newUser.role}
                    onValueChange={(v) => setNewUser({ ...newUser, role: v as UserRole })}
                  >
                    <SelectTrigger className="h-10 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Kasir</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="owner">Pemilik</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  className="gap-2"
                  onClick={() => {
                    if (!newUser.name.trim()) {
                      toast.error("Nama wajib diisi.");
                      return;
                    }
                    const wa = newUser.whatsapp.trim();
                    const em = newUser.email.trim();
                    if (!wa && !em) {
                      toast.error("Isi nomor WhatsApp atau email untuk mengirim PIN default.");
                      return;
                    }
                    if (em && !/^\S+@\S+\.\S+$/.test(em)) {
                      toast.error("Format email tidak valid.");
                      return;
                    }
                    const temp = randomPin();
                    update((current) => ({
                      ...current,
                      users: [
                        ...current.users,
                        {
                          id: uid("usr"),
                          name: newUser.name.trim(),
                          pin: temp,
                          role: newUser.role,
                          mustChangePin: true,
                          ...(wa ? { whatsapp: wa } : {}),
                          ...(em ? { email: em } : {}),
                        },
                      ],
                    }));
                    void deliverPin({ email: em, whatsapp: wa, subject: `PIN ${db.settings.name}`, message: pinMessage(db.settings.name, newUser.name.trim(), temp, false), storeCode: db.settings.storeCode, activationKey: db.settings.activationKey, storeName: db.settings.name, userName: newUser.name.trim(), pin: temp, temporary: false }).then((r) => (r.ok ? toast.success("PIN dikirim.") : toast.error(`PIN tidak terkirim: ${r.error}`)));
                    toast.success("Pengguna ditambahkan.");
                    setNewUser({ name: "", email: "", whatsapp: "", role: "cashier" });
                  }}
                >
                  <Plus className="size-4" /> Tambah
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pembayaran" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metode Pembayaran</CardTitle>
              <CardDescription>Nonaktifkan yang tidak dipakai agar kasir lebih cepat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {db.paymentMethods.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Input
                    value={m.name}
                    onChange={(e) =>
                      update((current) => ({
                        ...current,
                        paymentMethods: current.paymentMethods.map((x) =>
                          x.id === m.id ? { ...x, name: e.target.value } : x,
                        ),
                      }))
                    }
                    className="h-10"
                  />
                  {m.isCash && <Badge variant="secondary">Tunai</Badge>}
                  <Switch
                    checked={m.active}
                    onCheckedChange={(v) =>
                      update((current) => ({
                        ...current,
                        paymentMethods: current.paymentMethods.map((x) =>
                          x.id === m.id ? { ...x, active: v } : x,
                        ),
                      }))
                    }
                  />
                  {!m.isCash && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Hapus metode"
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          paymentMethods: current.paymentMethods.filter((x) => x.id !== m.id),
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value)}
                  placeholder="Metode baru, misal GoPay"
                  className="h-10 max-w-xs"
                />
                <Button
                  onClick={() => {
                    if (!newMethod.trim()) return;
                    update((current) => ({
                      ...current,
                      paymentMethods: [
                        ...current.paymentMethods,
                        { id: uid("pm"), name: newMethod.trim(), isCash: false, active: true },
                      ],
                    }));
                    setNewMethod("");
                  }}
                >
                  Tambah
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="printer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Printer Thermal</CardTitle>
              <CardDescription>
                Cetak biasa selalu tersedia. Pengiriman langsung ke printer Bluetooth tersedia di
                Chrome Android dan komputer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Lebar kertas">
                <Select
                  value={String(db.printer.paperWidth)}
                  onValueChange={(v) => setPrinter({ paperWidth: Number(v) === 48 ? 48 : 32 })}
                >
                  <SelectTrigger className="h-11 max-w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="32">58mm (32 karakter)</SelectItem>
                    <SelectItem value="48">80mm (48 karakter)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Header 1">
                  <Input
                    value={db.printer.header1}
                    onChange={(e) => setPrinter({ header1: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label="Header 2">
                  <Input
                    value={db.printer.header2}
                    onChange={(e) => setPrinter({ header2: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label="Footer" className="md:col-span-2">
                  <Input
                    value={db.printer.footer}
                    onChange={(e) => setPrinter({ footer: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label="Margin atas (baris)">
                  <Input
                    inputMode="numeric"
                    value={String(db.printer.marginTop)}
                    onChange={(e) =>
                      setPrinter({ marginTop: Number(e.target.value.replace(/\D/g, "")) || 0 })
                    }
                    className="tabular h-11 max-w-32"
                  />
                </Field>
                <Field label="Margin bawah (baris)">
                  <Input
                    inputMode="numeric"
                    value={String(db.printer.marginBottom)}
                    onChange={(e) =>
                      setPrinter({ marginBottom: Number(e.target.value.replace(/\D/g, "")) || 0 })
                    }
                    className="tabular h-11 max-w-32"
                  />
                </Field>
              </div>
              <ToggleRow
                title="Cetak struk otomatis setelah bayar"
                desc="Tanpa pratinjau, langsung ke dialog cetak."
                checked={db.printer.autoPrintOnPay}
                onCheckedChange={(v) => setPrinter({ autoPrintOnPay: v })}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={!bluetoothSupported()}
                  onClick={async () => {
                    try {
                      const name = await pickBluetoothPrinter();
                      setPrinter({ deviceName: name });
                      toast.success(`Printer ${name} tersimpan.`);
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Pencarian printer dibatalkan.",
                      );
                    }
                  }}
                >
                  <Bluetooth className="size-4" />
                  {bluetoothSupported() ? "Cari Printer Bluetooth" : "Bluetooth tak didukung"}
                </Button>
                <Button variant="secondary" className="gap-2" onClick={testPrint}>
                  <Printer className="size-4" /> Uji cetak
                </Button>
                {db.printer.deviceName && (
                  <Badge variant="secondary">Tersimpan: {db.printer.deviceName}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operasional" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meja / Nomor Antrean</CardTitle>
              <CardDescription>Dipakai pada layar kasir dan tiket dapur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {db.tables.map((t) => (
                  <Badge key={t.id} variant="secondary" className="gap-2 py-1.5">
                    {t.name}
                    <button
                      type="button"
                      aria-label={`Hapus ${t.name}`}
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          tables: current.tables.filter((x) => x.id !== t.id),
                        }))
                      }
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))}
                {db.tables.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada meja.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTable}
                  onChange={(e) => setNewTable(e.target.value)}
                  placeholder="Meja 9"
                  className="h-10 max-w-40"
                />
                <Button
                  onClick={() => {
                    if (!newTable.trim()) return;
                    update((current) => ({
                      ...current,
                      tables: [...current.tables, { id: uid("tbl"), name: newTable.trim() }],
                    }));
                    setNewTable("");
                  }}
                >
                  Tambah
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Staf Pelaksana</CardTitle>
              <CardDescription>Untuk usaha jasa: siapa yang mengerjakan layanan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {db.staff.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-2 py-1.5">
                    {s.name}
                    <button
                      type="button"
                      aria-label={`Hapus ${s.name}`}
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          staff: current.staff.filter((x) => x.id !== s.id),
                        }))
                      }
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))}
                {db.staff.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada staf.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newStaff}
                  onChange={(e) => setNewStaff(e.target.value)}
                  placeholder="Nama staf"
                  className="h-10 max-w-40"
                />
                <Button
                  onClick={() => {
                    if (!newStaff.trim()) return;
                    update((current) => ({
                      ...current,
                      staff: [...current.staff, { id: uid("stf"), name: newStaff.trim() }],
                    }));
                    setNewStaff("");
                  }}
                >
                  Tambah
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layanan" className="space-y-4">
          <ServiceTypesCard />
        </TabsContent>

        <TabsContent value="online" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aplikasi Online Order</CardTitle>
              <CardDescription>
                Pilihan yang aktif tampil saat kasir memilih layanan "Online Order".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(db.onlineChannels ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={c.active}
                      onCheckedChange={(v) =>
                        update((current) => ({
                          ...current,
                          onlineChannels: current.onlineChannels.map((x) =>
                            x.id === c.id ? { ...x, active: v } : x,
                          ),
                        }))
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Hapus ${c.name}`}
                      onClick={() =>
                        update((current) => ({
                          ...current,
                          onlineChannels: current.onlineChannels.filter((x) => x.id !== c.id),
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  placeholder="Nama aplikasi, mis. Maxim Food"
                  className="h-10 max-w-64"
                />
                <Button
                  onClick={() => {
                    if (!newChannel.trim()) return;
                    update((current) => ({
                      ...current,
                      onlineChannels: [
                        ...(current.onlineChannels ?? []),
                        { id: uid("oc"), name: newChannel.trim(), active: true },
                      ],
                    }));
                    setNewChannel("");
                  }}
                >
                  Tambah
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cadangkan & Pulihkan</CardTitle>
              <CardDescription>
                Semua data tersimpan di perangkat ini. Simpan berkas cadangan secara berkala.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button className="gap-2" onClick={backup}>
                <Download className="size-4" /> Unduh cadangan (.posbak)
              </Button>
              <Button variant="secondary" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Pulihkan dari berkas
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".posbak,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void restore(file);
                  e.target.value = "";
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ringkasan Data</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Produk: {db.products.length}</p>
              <p>Kategori: {db.categories.length}</p>
              <p>Transaksi: {db.sales.length}</p>
              <p>Shift: {db.shifts.length}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PrintPreview
        open={printLines !== null}
        onOpenChange={(v) => !v && setPrintLines(null)}
        title="Uji Cetak"
        lines={printLines ?? []}
      />
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onCheckedChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

const KIND_LABEL: Record<ServiceKind, string> = {
  takeout: "Langsung ke menu (seperti Take Out)",
  dinein: "Pilih meja/room (seperti Dine In)",
  online: "Pilih aplikasi online (seperti Online Order)",
};

export function ServiceTypesCard() {
  const { db, update } = usePos();
  const services = getServiceTypes(db);
  const [draft, setDraft] = useState({ name: "", code: "", kind: "takeout" as ServiceKind });

  function save(next: ServiceType[]) {
    update((current) => ({ ...current, serviceTypes: next }));
  }
  function patch(id: string, values: Partial<ServiceType>) {
    save(services.map((x) => (x.id === id ? { ...x, ...values } : x)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Jenis Layanan</CardTitle>
        <CardDescription>
          Hanya layanan yang aktif yang muncul di halaman kasir. Kode dipakai di nomor order, mis. TO-000001.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {services.map((svc) => (
          <div key={svc.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <Input
              aria-label="Nama layanan"
              value={svc.name}
              onChange={(e) => patch(svc.id, { name: e.target.value })}
              className="h-10 w-40"
            />
            <Input
              aria-label="Kode layanan"
              value={svc.code}
              onChange={(e) => patch(svc.id, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) })}
              className="h-10 w-20 font-mono"
            />
            <Select value={svc.kind} onValueChange={(v) => patch(svc.id, { kind: v as ServiceKind })}>
              <SelectTrigger className="h-10 w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as ServiceKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch checked={svc.active} onCheckedChange={(v) => patch(svc.id, { active: v })} />
              {svc.active ? "Aktif" : "Nonaktif"}
            </label>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Hapus ${svc.name}`}
              onClick={() => save(services.filter((x) => x.id !== svc.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Nama layanan baru, mis. Delivery"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-10 w-56"
          />
          <Input
            placeholder="Kode"
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) })}
            className="h-10 w-20 font-mono"
          />
          <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as ServiceKind })}>
            <SelectTrigger className="h-10 w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABEL) as ServiceKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="gap-2"
            onClick={() => {
              if (!draft.name.trim() || !draft.code) {
                toast.error("Nama dan kode layanan wajib diisi.");
                return;
              }
              save([...services, { id: uid("svc"), name: draft.name.trim(), code: draft.code, kind: draft.kind, active: true }]);
              setDraft({ name: "", code: "", kind: "takeout" });
            }}
          >
            <Plus className="size-4" /> Tambah
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
