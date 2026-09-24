import { BrandIcon, useBranding } from "@/lib/pos/branding";
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

import { ChangePinForm } from "@/components/pos/change-pin";
import { normalizeEmail, normalizeWa, pinMessage, randomPin, deliverPin } from "@/lib/pos/pin";
import { daysLeft, formatExpiry } from "@/lib/pos/expiry";

const DEVICE_TOKEN_KEY = "wo-pos-device-token";

/** Tebak tipe perangkat, mis. "Redmi Note 8 Pro" (Android Chrome) atau "iPhone". */
async function detectDeviceModel(): Promise<string> {
  if (typeof navigator === "undefined") return "";
  const uad = (navigator as unknown as {
    userAgentData?: { platform?: string; getHighEntropyValues?: (h: string[]) => Promise<{ model?: string; platform?: string }> };
  }).userAgentData;
  try {
    const v = await uad?.getHighEntropyValues?.(["model", "platform"]);
    if (v?.model) return v.model;
  } catch {
    /* abaikan */
  }
  const ua = navigator.userAgent;
  const android = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
  if (android?.[1] && android[1] !== "K") return android[1].trim();
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux PC";
  return uad?.platform ?? "";
}

export function PosGate({ children }: { children: ReactNode }) {
  const { ready, db, currentUser, update } = usePos();
  const [blocked, setBlocked] = useState(false);
  const code = db.settings.storeCode;
  const activated = db.settings.activated;
  const online = activated && db.settings.storeMode === "online";

  useEffect(() => {
    if (!ready || !activated || !code || typeof navigator === "undefined" || !navigator.onLine) return;
    supabase.rpc("check_store", { _code: code }).then(({ data, error }) => {
      if (error) return; // gangguan jaringan: tetap izinkan kerja offline
      const row = Array.isArray(data) ? data[0] : null;
      if (online) setBlocked(!row || !row.active);
      if (row) {
        const exp = (row as { expires_at?: string | null }).expires_at ?? null;
        update((cur) =>
          (cur.settings.expiresAt ?? null) === exp ? cur : { ...cur, settings: { ...cur.settings, expiresAt: exp } },
        );
      }
    });
    (supabase.rpc as unknown as (n: string) => Promise<{ data: unknown; error: unknown }>)("developer_contact").then(
      ({ data, error }) => {
        if (error) return;
        const row = (Array.isArray(data) ? data[0] : null) as { contact_email?: string; contact_phone?: string } | null;
        if (!row) return;
        const email = row.contact_email ?? "";
        const phone = row.contact_phone ?? "";
        update((cur) =>
          cur.settings.devEmail === email && cur.settings.devPhone === phone
            ? cur
            : { ...cur, settings: { ...cur.settings, devEmail: email, devPhone: phone } },
        );
      },
    );
  }, [ready, activated, online, code, update]);

  // Detak perangkat: laporkan "masih aktif" tiap 2 menit saat online.
  useEffect(() => {
    if (!ready || !activated || !code || typeof window === "undefined") return;
    const token = db.settings.deviceToken || window.localStorage.getItem(DEVICE_TOKEN_KEY) || "";
    if (!token) return;
    if (!db.settings.deviceToken) {
      update((cur) => ({ ...cur, settings: { ...cur.settings, deviceToken: token } }));
    }
    let model = "";
    const beat = async () => {
      const result = await (supabase.rpc as unknown as (
        n: string,
        a: object,
      ) => Promise<{ error?: { message?: string } | null }>)("device_heartbeat", {
        _code: code,
        _token: token,
        _model: model,
      });
      if (result.error) console.warn("Status perangkat gagal diperbarui", result.error.message);
    };
    void detectDeviceModel().then((m) => {
      model = m;
      void beat();
    });
    const onOnline = () => void beat();
    const onVisible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    const t = setInterval(() => void beat(), 120_000);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, activated, code, db.settings.deviceToken, update]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const contact = <DevContact email={db.settings.devEmail} phone={db.settings.devPhone} />;

  if (!db.settings.activated) return <ActivationFlow />;
  if (blocked)
    return (
      <Frame>
        <Card>
          <CardHeader>
            <CardTitle>Store Dinonaktifkan</CardTitle>
            <CardDescription>
              Kode store {db.settings.storeCode} tidak aktif lagi. Hubungi developer untuk mengaktifkan kembali.
            </CardDescription>
          </CardHeader>
          <CardContent>{contact}</CardContent>
        </Card>
      </Frame>
    );
  const left = daysLeft(db.settings.expiresAt);
  if (left !== null && left < 0)
    return (
      <Frame>
        <Card>
          <CardHeader>
            <CardTitle>Masa Berlaku Store Habis</CardTitle>
            <CardDescription>
              Masa berlaku store {db.settings.storeCode} berakhir pada {formatExpiry(db.settings.expiresAt)}. Hubungi developer untuk perpanjangan, lalu buka ulang aplikasi dalam keadaan online.
            </CardDescription>
          </CardHeader>
          <CardContent>{contact}</CardContent>
        </Card>
      </Frame>
    );
  if (!currentUser) return <LoginScreen />;
  return (
    <>
      {left !== null && left <= 10 && (
        <div
          role="alert"
          className={
            "px-4 py-2 text-center text-sm font-medium " +
            (left < 0 ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground")
          }
        >
          {left < 0
            ? `Masa berlaku store telah berakhir pada ${formatExpiry(db.settings.expiresAt)}. Hubungi penyedia aplikasi untuk perpanjangan.`
            : left === 0
              ? "Masa berlaku store berakhir HARI INI. Segera hubungi penyedia aplikasi untuk perpanjangan."
              : `Masa berlaku store berakhir dalam ${left} hari (${formatExpiry(db.settings.expiresAt)}). Segera lakukan perpanjangan.`}
        </div>
      )}
      {children}
    </>
  );
}

function DevContact({ email, phone }: { email?: string | undefined; phone?: string | undefined }) {
  if (!email && !phone)
    return <p className="text-sm text-muted-foreground">Kontak developer belum tersedia.</p>;
  const wa = phone ? phone.replace(/\D/g, "").replace(/^0/, "62") : "";
  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
      <p className="font-semibold">Kontak Developer</p>
      {email && (
        <p>
          Email:{" "}
          <a className="font-medium text-primary underline" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      )}
      {phone && (
        <p>
          Telepon/WA:{" "}
          <a className="font-medium text-primary underline" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
            {phone}
          </a>
        </p>
      )}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

function ActivationFlow() {
  const { update, signIn } = usePos();
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
    expires_at?: string | null;
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
          expiresAt: picked?.expires_at ?? null,
          activatedAt: seeded.settings.activatedAt || new Date().toISOString(),
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
                Alamat, telepon, pajak, dan jenis layanan diatur di halaman Pengaturan setelah ini.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </Frame>
  );
}

function LoginScreen() {
  const brand = useBranding();
  const { db, signIn, update } = usePos();
  const [selected, setSelected] = useState(db.users[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"pin" | "change" | "forgot">("pin");
  const [contact, setContact] = useState("");

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
    if (user.mustChangePin) {
      setMode("change");
      return;
    }
    signIn(user);
  }

  function saveNewPin(newPin: string) {
    if (!user) return;
    const next = { ...user, pin: newPin, mustChangePin: false };
    update((cur) => ({ ...cur, users: cur.users.map((u) => (u.id === user.id ? next : u)) }));
    signIn(next);
  }

  function forgot() {
    if (!user) return;
    const input = contact.trim();
    if (!input) { toast.error("Masukkan email atau nomor WhatsApp terdaftar."); return; }
    if (!user.email && !user.whatsapp) {
      toast.error("Pengguna ini belum punya email/WhatsApp terdaftar. Minta manager mengirim ulang PIN.");
      return;
    }
    const isEmail = input.includes("@");
    const match = isEmail
      ? !!user.email && normalizeEmail(user.email) === normalizeEmail(input)
      : !!user.whatsapp && normalizeWa(user.whatsapp) === normalizeWa(input);
    if (!match) {
      toast.error(`${isEmail ? "Email" : "Nomor WhatsApp"} tidak sesuai dengan data ${user.name}.`, { duration: 6000 });
      return;
    }
    const temp = randomPin();
    update((cur) => ({
      ...cur,
      users: cur.users.map((u) => (u.id === user.id ? { ...u, pin: temp, mustChangePin: true } : u)),
    }));
    void deliverPin({
      email: isEmail ? user.email : undefined,
      whatsapp: isEmail ? undefined : user.whatsapp,
      subject: `PIN sementara ${db.settings.name}`,
      message: pinMessage(db.settings.name, user.name, temp, true),
      storeCode: db.settings.storeCode, activationKey: db.settings.activationKey, storeName: db.settings.name,
      userName: user.name, pin: temp, temporary: true,
    }).then((r) =>
      r.ok
        ? toast.success(isEmail ? "PIN sementara sudah dikirim ke email Anda." : "PIN sementara dikirim. Masuk dengan PIN tersebut lalu buat PIN baru.", { duration: 8000 })
        : toast.error(`PIN tidak terkirim: ${r.error}`),
    );
    setContact("");
    setMode("pin");
  }

  if (mode === "change" && user)
    return (
      <Frame>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Buat PIN Baru</CardTitle>
            <CardDescription>
              Halo {user.name}, Anda masuk dengan PIN default/sementara. Buat PIN baru yang hanya Anda ketahui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePinForm onSave={saveNewPin} onCancel={() => { setMode("pin"); setPin(""); }} />
          </CardContent>
        </Card>
      </Frame>
    );

  if (mode === "forgot" && user)
    return (
      <Frame>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Lupa PIN</CardTitle>
            <CardDescription>
              Masukkan email atau nomor WhatsApp yang terdaftar untuk {user.name}. PIN sementara akan dikirim ke sana.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fg">Email / Nomor WhatsApp</Label>
              <Input id="fg" autoFocus value={contact} onChange={(e) => setContact(e.target.value)} className="h-11" placeholder="nama@email.com atau 08xxxx" onKeyDown={(e) => e.key === "Enter" && forgot()} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setMode("pin")}>
                Kembali
              </Button>
              <Button className="h-11 flex-1" onClick={forgot}>
                Kirim PIN Sementara
              </Button>
            </div>
          </CardContent>
        </Card>
      </Frame>
    );

  return (
    <Frame>
      <Card>
        <CardHeader className="text-center">
          <BrandIcon className="mx-auto mb-1 size-16 rounded-2xl object-cover" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{brand.name}</p>
          <CardTitle className="text-2xl">{db.settings.name}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-1.5"><LockKeyhole className="size-3.5" /> Pilih pengguna dan masukkan PIN untuk membuka kasir.</CardDescription>
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
          <button type="button" className="mx-auto block text-sm font-medium text-primary underline" onClick={() => setMode("forgot")}>
            Lupa PIN?
          </button>
        </CardContent>
      </Card>
    </Frame>
  );
}
