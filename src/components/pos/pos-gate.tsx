import { useState, type ReactNode } from "react";
import { Loader2, KeyRound, Store, Coffee, ShoppingBasket, Scissors, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { isValidStoreCode, normalizeCode } from "@/lib/pos/license";
import { seedForBusiness } from "@/lib/pos/seed";
import { uid } from "@/lib/pos/format";
import type { BusinessType } from "@/lib/pos/types";
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

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!db.settings.activated) return <ActivationFlow />;
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
  const { db, update } = usePos();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [type, setType] = useState<BusinessType>("kuliner");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");

  function submitCode() {
    if (!isValidStoreCode(code)) {
      toast.error("Kode toko tidak dikenali. Periksa kembali kode dari penyedia aplikasi.");
      return;
    }
    setStep(1);
  }

  function finish() {
    if (!storeName.trim()) return toast.error("Nama toko wajib diisi.");
    if (!ownerName.trim()) return toast.error("Nama pemilik wajib diisi.");
    if (!/^\d{4,6}$/.test(pin)) return toast.error("PIN harus 4–6 angka.");
    if (pin !== pin2) return toast.error("Konfirmasi PIN belum sama.");

    update((current) => {
      const seeded = seedForBusiness(current, type);
      return {
        ...seeded,
        settings: {
          ...seeded.settings,
          activated: true,
          storeCode: normalizeCode(code),
          name: storeName.trim(),
        },
        users: [{ id: uid("usr"), name: ownerName.trim(), role: "owner", pin }],
      };
    });
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
            {step === 0 ? "Aktivasi Aplikasi" : step === 1 ? "Tipe Usaha" : "Data Toko & Pemilik"}
          </CardTitle>
          <CardDescription>
            {step === 0
              ? "Masukkan kode toko Anda untuk mulai memakai aplikasi kasir di perangkat ini."
              : step === 1
                ? "Pilih tipe usaha. Fitur kasir akan menyesuaikan dan bisa diubah kapan saja."
                : "Nama toko tampil di struk. PIN pemilik dipakai untuk masuk ke aplikasi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Kode Toko</Label>
                <Input
                  id="code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="WO-UKM-2026"
                  className="h-12 font-mono text-lg tracking-widest"
                  onKeyDown={(e) => e.key === "Enter" && submitCode()}
                />
                <p className="text-xs text-muted-foreground">
                  Belum punya kode? Hubungi penyedia aplikasi Anda. Tanpa kode yang sah, aplikasi
                  tidak dapat digunakan di perangkat ini.
                </p>
              </div>
              <Button className="h-12 w-full text-base" onClick={submitCode}>
                Aktifkan
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

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="store">Nama Toko</Label>
                <Input
                  id="store"
                  autoFocus
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder={db.settings.name}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner">Nama Pemilik</Label>
                <Input
                  id="owner"
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
                  {u.role === "owner" ? "Pemilik" : "Kasir"}
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
