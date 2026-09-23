import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, KeyRound, Store, Coffee, ShoppingBasket, Scissors, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { getServiceTypes, seedForBusiness } from "@/lib/pos/seed";
import { uid } from "@/lib/pos/format";
import type { BusinessType } from "@/lib/pos/types";
import { roleLabel } from "@/lib/pos/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BUSINESS_OPTIONS: {
  value: BusinessType;
  title: string;
  desc: string;
  icon: typeof Coffee;
}[] = [
  {
    value: "kuliner",
    title: "Kuliner / Kafe",
    desc: "Meja, pesanan dapur, label minuman, varian menu",
    icon: Coffee,
  },
  {
    value: "retail",
    title: "Retail / Toko",
    desc: "Barcode, stok barang, satuan jual",
    icon: ShoppingBasket,
  },
  {
    value: "jasa",
    title: "Jasa / Salon & Servis",
    desc: "Daftar layanan, staf pelaksana, nama pelanggan",
    icon: Scissors,
  },
];

export function PosGate({ children }: { children: ReactNode }) {
  const { ready, db, currentUser } = usePos();
  const [blocked, setBlocked] = useState(false);
  const code = db.settings.storeCode;
  const online = db.settings.activated && db.settings.storeMode === "online";

  useEffect(() => {
    if (!ready || !online || !code || typeof navigator === "undefined" || !navigator.onLine) return;
    supabase.rpc("check_store", { _code: code }).then(({ data, error }) => {
      if (error) return; // gangguan jaringan: tetap izinkan kerja offline
      const row = Array.isArray(data) ? data[0] : null;
      setBlocked(!row || !row.active);
    });
  }, [ready, online, code]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!db.settings.activated) return <ActivationFlow />;
  if (blocked)
    return (
      <Frame>
        <Card>
          <CardHeader>
            <CardTitle>Toko Dinonaktifkan</CardTitle>
            <CardDescription>
              Kode toko {db.settings.storeCode} tidak aktif lagi. Hubungi penyedia aplikasi untuk mengaktifkan kembali.
            </CardDescription>
          </CardHeader>
        </Card>
      </Frame>
    );
  if (!currentUser) return <LoginScreen />;
  return <>{children}</>;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

function ActivationFlow() {
  const { db, update, signIn } = usePos();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [installerOk, setInstallerOk] = useState(false);
  const [stores, setStores] = useState<
    { id: string; code: string; name: string; mode: string; business_types: { name: string; base_kind: string } | null }[]
  >([]);
  const [storeId, setStoreId] = useState("");
  const [picked, setPicked] = useState<{ code: string; name: string; mode: string } | null>(null);
  const [services, setServices] = useState(() => getServiceTypes(db));
  const [type, setType] = useState<BusinessType>("kuliner");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");

  async function installerLogin() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setBusy(false);
      toast.error("Email atau sandi installer salah.");
      return;
    }
    const [{ data: isInst }, { data: isDev }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "installer" }),
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "developer" }),
    ]);
    if (!isInst && !isDev) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("Akun ini bukan installer atau developer.");
      return;
    }
    const { data: rows } = await supabase
      .from("stores")
      .select("id, code, name, mode, business_types(name, base_kind)")
      .eq("active", true)
      .order("name");
    setStores((rows as unknown as typeof stores) ?? []);
    setInstallerOk(true);
    setBusy(false);
  }

  async function activateStore() {
    if (!storeId) {
      toast.error("Pilih toko yang akan diaktifkan.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("activate_store", { _store_id: storeId });
    const row = Array.isArray(data) ? data[0] : null;
    setBusy(false);
    if (error || !row) {
      toast.error("Toko tidak bisa diaktifkan. Pastikan toko masih aktif.");
      return;
    }
    await supabase.auth.signOut();
    setPicked(row);
    setStoreName(row.name);
    const kind = stores.find((x) => x.id === storeId)?.business_types?.base_kind;
    setType(kind === "retail" || kind === "jasa" ? kind : "kuliner");
    setStep(2);
  }

  function finish() {
    if (!storeName.trim()) {
      toast.error("Nama toko wajib diisi.");
      return;
    }
    if (!ownerName.trim()) {
      toast.error("Nama pemilik wajib diisi.");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN harus 4–6 angka.");
      return;
    }
    if (pin !== pin2) {
      toast.error("Konfirmasi PIN belum sama.");
      return;
    }

    const owner = { id: uid("usr"), name: ownerName.trim(), role: "owner" as const, pin };
    update((current) => {
      const seeded = seedForBusiness(current, type);
      return {
        ...seeded,
        settings: {
          ...seeded.settings,
          activated: true,
          storeCode: picked?.code ?? "",
          storeMode: picked?.mode === "online" ? "online" : "offline",
          name: storeName.trim(),
        },
        serviceTypes: services,
        users: [owner],
      };
    });
    signIn(owner);
    toast.success("Toko aktif. Selamat berjualan!");
  }

  return (
    <Frame>
      <Card className="border-sidebar-border/40">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {step === 0 ? <KeyRound className="size-5" /> : <Store className="size-5" />}
          </div>
          <CardTitle className="text-2xl">
            {step === 0 ? "Aktivasi oleh Installer" : step === 1 ? "Tipe Usaha" : step === 2 ? "Jenis Layanan" : "Data Toko & Pemilik"}
          </CardTitle>
          <CardDescription>
            {step === 0
              ? "Aktivasi hanya bisa dilakukan installer atau developer. Masuk, lalu pilih toko yang sudah didaftarkan."
              : step === 1
                ? "Pilih tipe usaha. Fitur kasir akan menyesuaikan dan bisa diubah kapan saja."
                : step === 2
                  ? "Aktifkan layanan yang dipakai toko. Bisa ditambah dan diubah nanti di Pengaturan."
                  : "Nama toko tampil di struk. PIN pemilik dipakai untuk masuk ke aplikasi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && !installerOk && (
            <>
              <div className="space-y-2">
                <Label htmlFor="inst-email">Email Installer</Label>
                <Input id="inst-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inst-pass">Sandi</Label>
                <Input
                  id="inst-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                  onKeyDown={(e) => e.key === "Enter" && installerLogin()}
                />
                <p className="text-xs text-muted-foreground">
                  Aktivasi pertama butuh koneksi internet. Pemilik toko tidak perlu mengisi bagian ini.
                </p>
              </div>
              <Button className="h-12 w-full text-base" disabled={busy} onClick={installerLogin}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Masuk"}
              </Button>
            </>
          )}

          {step === 0 && installerOk && (
            <>
              <div className="grid max-h-72 gap-2 overflow-auto">
                {stores.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStoreId(st.id)}
                    className={`rounded-xl border p-3 text-left ${
                      storeId === st.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="block font-semibold">{st.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {st.code} • {st.mode === "online" ? "Online" : "Offline"}
                      {st.business_types && ` • ${st.business_types.name}`}
                    </span>
                  </button>
                ))}
                {stores.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada toko aktif. Daftarkan dulu di /kontrol.</p>
                )}
              </div>
              <Button className="h-12 w-full text-base" disabled={busy} onClick={activateStore}>
                Aktifkan Toko Ini
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-2">
                {services.map((svc) => (
                  <label key={svc.id} className="flex items-center justify-between rounded-xl border p-3">
                    <span>
                      <span className="block font-semibold">{svc.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{svc.code}</span>
                    </span>
                    <Switch
                      checked={svc.active}
                      onCheckedChange={(v) =>
                        setServices((prev) => prev.map((x) => (x.id === svc.id ? { ...x, active: v } : x)))
                      }
                    />
                  </label>
                ))}
              </div>
              <Button className="h-12 w-full text-base" onClick={() => setStep(3)}>
                Lanjut
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid gap-3">
                {BUSINESS_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block font-semibold">{opt.title}</span>
                        <span className="block text-sm text-muted-foreground">{opt.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button className="h-12 w-full text-base" onClick={() => setStep(2)}>
                Lanjut
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="store">Nama Toko (terdaftar di kontrol)</Label>
                <Input
                  id="store"
                  value={storeName}
                  readOnly
                  disabled
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner">Nama Pemilik</Label>
                <Input
                  id="owner"
                  autoFocus
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN (4–6 angka)</Label>
                  <Input
                    id="pin"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-11 font-mono tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin2">Ulangi PIN</Label>
                  <Input
                    id="pin2"
                    inputMode="numeric"
                    value={pin2}
                    onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-11 font-mono tracking-widest"
                  />
                </div>
              </div>
              <Button className="h-12 w-full text-base" onClick={finish}>
                Mulai Pakai Kasir
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Frame>
  );
}

function LoginScreen() {
  const { db, signIn } = usePos();
  const [selected, setSelected] = useState(db.users[0]?.id ?? "");
  const [pin, setPin] = useState("");

  const user = db.users.find((u) => u.id === selected);

  function press(digit: string) {
    setPin((prev) => (prev.length >= 6 ? prev : prev + digit));
  }

  function submit(value = pin) {
    if (!user) return;
    if (value !== user.pin) {
      toast.error("PIN salah.");
      setPin("");
      return;
    }
    signIn(user);
  }

  return (
    <Frame>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle className="text-2xl">{db.settings.name}</CardTitle>
          <CardDescription>Pilih pengguna dan masukkan PIN untuk membuka kasir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap justify-center gap-2">
            {db.users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setSelected(u.id);
                  setPin("");
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  selected === u.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {u.name}
                <span className="ml-1 text-xs opacity-70">
                  {roleLabel(u.role)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className={`size-3 rounded-full ${i < pin.length ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <Button
                key={d}
                variant="secondary"
                className="h-14 text-xl font-semibold"
                onClick={() => press(d)}
              >
                {d}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="h-14 text-sm"
              onClick={() => setPin((p) => p.slice(0, -1))}
            >
              Hapus
            </Button>
            <Button variant="secondary" className="h-14 text-xl font-semibold" onClick={() => press("0")}>
              0
            </Button>
            <Button className="h-14 text-sm font-semibold" onClick={() => submit()}>
              Masuk
            </Button>
          </div>
        </CardContent>
      </Card>
    </Frame>
  );
}
