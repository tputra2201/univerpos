import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, KeyRound, Store, LockKeyhole } from "lucide-react";
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

const DEVICE_TOKEN_KEY = "wo-pos-device-token";

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
            <CardTitle>Store Dinonaktifkan</CardTitle>
            <CardDescription>
              Kode store {db.settings.storeCode} tidak aktif lagi. Hubungi penyedia aplikasi untuk mengaktifkan kembali.
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
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [storeCode, setStoreCode] = useState("");
  const [key, setKey] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{
    code: string;
    name: string;
    mode: string;
    business_type_name: string;
    base_kind: string;
  } | null>(null);
  const [type, setType] = useState<BusinessType>("kuliner");
  const [ownerName, setOwnerName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");

  const deviceToken = useMemo(() => {
    if (typeof localStorage === "undefined") return uid("dev");
    const existing = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (existing) return existing;
    const fresh = uid("dev");
    localStorage.setItem(DEVICE_TOKEN_KEY, fresh);
    return fresh;
  }, []);

  async function activate() {
    if (!storeCode.trim() || !key.trim()) {
      toast.error("Kode store dan kunci aktivasi wajib diisi.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("activate_device", {
      _code: storeCode.trim(),
      _key: key.trim(),
      _token: deviceToken,
      _device_name: deviceName.trim() || "Kasir 1",
    });
    setBusy(false);
    if (error) {
      const msg = error.message.replace(/^.*?(INVALID|INACTIVE|MAX_DEVICES):\s*/, "");
      if (error.message.includes("MAX_DEVICES")) window.alert(`Peringatan: Batas perangkat terlampaui\n\n${msg}`);
      toast.error(msg || "Aktivasi gagal. Periksa koneksi internet.", { duration: 8000 });
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      toast.error("Aktivasi gagal. Coba lagi.");
      return;
    }
    setPicked(row);
    setType(row.base_kind === "retail" || row.base_kind === "jasa" ? row.base_kind : "kuliner");
    setStep(1);
  }

  function finish() {
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
          name: picked?.name ?? "",
          businessTypeName: picked?.business_type_name ?? "",
          activationKey: key.trim(),
          deviceToken,
          deviceName: deviceName.trim() || "Kasir 1",
        },
        serviceTypes: getServiceTypes(seeded),
        users: [owner],
      };
    });
    signIn(owner);
    toast.success("Store aktif. Lengkapi data store dulu, ya.");
    void navigate({ to: "/pengaturan" });
  }

  return (
    <Frame>
      <Card className="border-sidebar-border/40">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {step === 0 ? <KeyRound className="size-5" /> : <Store className="size-5" />}
          </div>
          <CardTitle className="text-2xl">{step === 0 ? "Aktivasi Store" : "Pemilik & PIN"}</CardTitle>
          <CardDescription>
            {step === 0
              ? "Masukkan Kode Store dan Kunci Aktivasi yang Anda terima dari penyedia aplikasi. Butuh koneksi internet."
              : `Store ${picked?.name ?? ""} siap dipakai. Buat akun pemilik untuk membuka kasir.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="st-code">Kode Store</Label>
                <Input
                  id="st-code"
                  autoFocus
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                  className="h-11 font-mono"
                  placeholder="WO-XXXX-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-key">Kunci Aktivasi</Label>
                <Input
                  id="st-key"
                  inputMode="numeric"
                  value={key}
                  onChange={(e) => setKey(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-11 font-mono tracking-widest"
                  placeholder="000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-dev">Nama Perangkat Ini</Label>
                <Input
                  id="st-dev"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="h-11"
                  placeholder="Kasir Depan"
                  onKeyDown={(e) => e.key === "Enter" && activate()}
                />
                <p className="text-xs text-muted-foreground">
                  Perangkat tambahan cukup memakai kode dan kunci yang sama, selama kuota perangkat masih ada.
                </p>
              </div>
              <Button className="h-12 w-full text-base" disabled={busy} onClick={activate}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Aktifkan Sekarang"}
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{picked?.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {picked?.code} • {picked?.business_type_name || "-"}
                </p>
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
                Simpan & Lengkapi Data Store
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Alamat, telepon, pajak, dan jenis layanan diatur di halaman Pengaturan setelah ini. ({db.version})
              </p>
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
