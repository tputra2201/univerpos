import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  bootstrapDeveloper,
  createAccount,
  deleteAccount,
  listInstallers,
  resetAccountPassword,
  updateAccount,
} from "@/lib/kontrol.functions";
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

export const Route = createFileRoute("/kontrol")({
  head: () => ({
    meta: [
      { title: "Kontrol Developer — POS UKM" },
      { name: "description", content: "Panel developer untuk mendaftarkan store dan akun installer POS." },
      { property: "og:title", content: "Kontrol Developer — POS UKM" },
      { property: "og:description", content: "Daftarkan store dan kelola akun installer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KontrolPage,
});

interface StoreRow {
  id: string;
  code: string;
  name: string;
  mode: string;
  active: boolean;
  notes: string;
  device_count: number;
  last_activated_at: string | null;
  last_activated_by: string;
  business_type_id: string | null;
}

function randomCode(name: string) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "TOKO";
  const n = Math.floor(1000 + Math.random() * 9000);
  return `WO-${base}-${n}`;
}

function KontrolPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isDev, setIsDev] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshRole = useCallback(async (u: User | null) => {
    setUser(u);
    if (!u) {
      setIsDev(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.rpc("has_role", { _user_id: u.id, _role: "developer" });
    setIsDev(!!data);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => refreshRole(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void refreshRole(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshRole]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sidebar px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <h1 className="text-xl font-bold">Kontrol Developer</h1>
          </div>
          {user && (
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => supabase.auth.signOut()}>
              <LogOut className="size-4" /> Keluar
            </Button>
          )}
        </div>
        {!user ? (
          <DevLogin />
        ) : !isDev ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Akun ini bukan developer. Halaman kontrol hanya untuk developer.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="store">
            <TabsList>
              <TabsTrigger value="store">Store</TabsTrigger>
              <TabsTrigger value="tipe">Tipe Usaha</TabsTrigger>
              <TabsTrigger value="akun">Installer & Developer</TabsTrigger>
            </TabsList>
            <TabsContent value="store">
              <StoresPanel />
            </TabsContent>
            <TabsContent value="tipe">
              <BusinessTypesPanel />
            </TabsContent>
            <TabsContent value="akun">
              <AccountsPanel selfId={user.id} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function DevLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [noDev, setNoDev] = useState(false);
  const [busy, setBusy] = useState(false);
  const bootstrap = useServerFn(bootstrapDeveloper);

  useEffect(() => {
    supabase.rpc("developer_exists").then(({ data }) => setNoDev(data === false));
  }, []);

  async function login() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("Email atau sandi salah.");
  }

  async function register() {
    setBusy(true);
    try {
      await bootstrap({ data: { email, password, name } });
      await supabase.auth.signInWithPassword({ email, password });
      toast.success("Akun developer dibuat.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat akun");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{noDev ? "Buat Akun Developer Pertama" : "Masuk Developer"}</CardTitle>
        <CardDescription>
          {noDev
            ? "Belum ada developer terdaftar. Akun pertama otomatis menjadi developer."
            : "Masuk untuk mengelola store dan akun installer."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {noDev && (
          <div className="space-y-1">
            <Label htmlFor="dev-name">Nama</Label>
            <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="dev-email">Email</Label>
          <Input id="dev-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dev-pass">Sandi {noDev && "(min. 8 karakter)"}</Label>
          <Input
            id="dev-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (noDev ? register() : login())}
          />
        </div>
        <Button className="h-11 w-full" disabled={busy} onClick={noDev ? register : login}>
          {noDev ? "Buat & Masuk" : "Masuk"}
        </Button>
      </CardContent>
    </Card>
  );
}

interface BizType {
  id: string;
  name: string;
  base_kind: string;
  description: string;
}

const KIND_LABEL: Record<string, string> = { kuliner: "Kuliner (meja & dapur)", retail: "Retail (stok & barcode)", jasa: "Jasa (staf)" };

function BusinessTypesPanel() {
  const [rows, setRows] = useState<BizType[]>([]);
  const [form, setForm] = useState({ name: "", base_kind: "retail", description: "" });
  const [edit, setEdit] = useState<BizType | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("business_types").select("*").order("created_at");
    if (error) toast.error(error.message);
    setRows((data as BizType[]) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!form.name.trim()) return void toast.error("Nama tipe usaha wajib diisi.");
    const { error } = await supabase.from("business_types").insert({ ...form, name: form.name.trim() });
    if (error) return void toast.error(error.message);
    toast.success("Tipe usaha ditambahkan.");
    setForm({ name: "", base_kind: "retail", description: "" });
    void load();
  }
  async function saveEdit() {
    if (!edit || !edit.name.trim()) return;
    const { error } = await supabase
      .from("business_types")
      .update({ name: edit.name.trim(), base_kind: edit.base_kind, description: edit.description })
      .eq("id", edit.id);
    if (error) return void toast.error(error.message);
    setEdit(null);
    void load();
  }
  async function remove(b: BizType) {
    if (!confirm(`Hapus tipe usaha ${b.name}?`)) return;
    const { error } = await supabase.from("business_types").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    void load();
  }

  const kindSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(KIND_LABEL).map(([k, l]) => (
          <SelectItem key={k} value={k}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah Tipe Usaha</CardTitle>
          <CardDescription>Perilaku dasar menentukan fitur bawaan kasir (meja/dapur, stok, atau staf).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="bt-name">Nama</Label>
            <Input id="bt-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Perilaku dasar</Label>
            {kindSelect(form.base_kind, (v) => setForm({ ...form, base_kind: v }))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="bt-desc">Keterangan</Label>
            <Input id="bt-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Button className="sm:col-span-3" onClick={add}>
            Tambah Tipe Usaha
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Tipe Usaha ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((b) =>
            edit?.id === b.id ? (
              <div key={b.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
                <Input aria-label="Nama" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                {kindSelect(edit.base_kind, (v) => setEdit({ ...edit, base_kind: v }))}
                <Input
                  aria-label="Keterangan"
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
                <div className="flex gap-2 sm:col-span-3">
                  <Button size="sm" onClick={saveEdit}>Simpan</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Batal</Button>
                </div>
              </div>
            ) : (
              <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="flex-1">
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABEL[b.base_kind] ?? b.base_kind}
                    {b.description && ` • ${b.description}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEdit(b)}>Edit</Button>
                <Button size="icon" variant="ghost" aria-label={`Hapus ${b.name}`} onClick={() => remove(b)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ),
          )}
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada tipe usaha.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function StoresPanel() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [types, setTypes] = useState<BizType[]>([]);
  const [form, setForm] = useState({ name: "", code: "", mode: "offline", notes: "", business_type_id: "" });

  const load = useCallback(async () => {
    const [{ data, error }, { data: bt }] = await Promise.all([
      supabase.from("stores").select("*").order("created_at", { ascending: false }),
      supabase.from("business_types").select("*").order("created_at"),
    ]);
    if (error) toast.error(error.message);
    setStores((data as StoreRow[]) ?? []);
    setTypes((bt as BizType[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(): Promise<unknown> {
    if (!form.name.trim()) return toast.error("Nama store wajib diisi.");
    if (!form.business_type_id) return toast.error("Pilih tipe usaha.");
    const code = (form.code.trim() || randomCode(form.name)).toUpperCase();
    const { error } = await supabase.from("stores").insert({
      name: form.name.trim(),
      code,
      mode: form.mode,
      notes: form.notes.trim(),
      business_type_id: form.business_type_id,
    });
    if (error) return toast.error(error.message.includes("duplicate") ? "Kode store sudah dipakai." : error.message);
    toast.success(`Store terdaftar dengan kode ${code}`);
    setForm({ name: "", code: "", mode: "offline", notes: "", business_type_id: "" });
    void load();
    return undefined;
  }

  async function patch(id: string, values: Partial<StoreRow>) {
    const { error } = await supabase.from("stores").update(values).eq("id", id);
    if (error) toast.error(error.message);
    void load();
  }

  async function remove(s: StoreRow) {
    if (!confirm(`Hapus store ${s.name}?`)) return;
    const { error } = await supabase.from("stores").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    void load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftarkan Store Baru</CardTitle>
          <CardDescription>
            Mode offline: dicek hanya saat aktivasi. Mode online: perangkat mengecek status store setiap kali
            dibuka saat ada internet, dan terkunci bila store dinonaktifkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="st-name">Nama Store</Label>
            <Input id="st-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-code">Kode Store (kosongkan = otomatis)</Label>
            <Input
              id="st-code"
              className="font-mono"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="space-y-1">
            <Label>Mode</Label>
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipe Usaha</Label>
            <Select value={form.business_type_id} onValueChange={(v) => setForm({ ...form, business_type_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder={types.length ? "Pilih tipe usaha" : "Buat dulu di tab Tipe Usaha"} />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-notes">Catatan</Label>
            <Input id="st-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button className="sm:col-span-2" onClick={add}>
            Daftarkan Store
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Store Terdaftar ({stores.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stores.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-48 flex-1">
                <p className="font-semibold">
                  {s.name}
                  {s.business_type_id && (
                    <Badge variant="secondary" className="ml-2">
                      {types.find((t) => t.id === s.business_type_id)?.name ?? "-"}
                    </Badge>
                  )}
                </p>
                <p className="font-mono text-sm text-primary">{s.code}</p>
                <p className="text-xs text-muted-foreground">
                  {s.device_count} perangkat
                  {s.last_activated_at &&
                    ` • terakhir ${new Date(s.last_activated_at).toLocaleString("id-ID")} oleh ${s.last_activated_by || "-"}`}
                  {s.notes && ` • ${s.notes}`}
                </p>
              </div>
              <Select value={s.mode} onValueChange={(v) => patch(s.id, { mode: v })}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={s.active} onCheckedChange={(v) => patch(s.id, { active: v })} />
                {s.active ? "Aktif" : "Nonaktif"}
              </label>
              <Button size="icon" variant="ghost" aria-label={`Hapus ${s.name}`} onClick={() => remove(s)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {stores.length === 0 && <p className="text-sm text-muted-foreground">Belum ada store.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

interface AccountRow {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  email: string;
}

function AccountsPanel({ selfId }: { selfId: string }) {
  const list = useServerFn(listInstallers);
  const create = useServerFn(createAccount);
  const del = useServerFn(deleteAccount);
  const reset = useServerFn(resetAccountPassword);
  const save = useServerFn(updateAccount);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [edit, setEdit] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "installer" as "installer" | "developer" });

  const load = useCallback(async () => {
    try {
      setRows((await list()) as AccountRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat");
    }
  }, [list]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    try {
      await create({ data: form });
      toast.success("Akun dibuat.");
      setForm({ name: "", email: "", password: "", role: "installer" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Periksa kembali isian (sandi min. 8 karakter).");
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    try {
      await save({ data: { userId: edit.userId, name: edit.name, email: edit.email } });
      toast.success("Akun diperbarui.");
      setEdit(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui akun.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buat Akun</CardTitle>
          <CardDescription>Installer memakai akun ini untuk mengaktifkan aplikasi kasir di perangkat store.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ac-name">Nama</Label>
            <Input id="ac-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ac-email">Email</Label>
            <Input id="ac-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ac-pass">Sandi (min. 8)</Label>
            <Input id="ac-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Peran</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "installer" | "developer" })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="installer">Installer</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="sm:col-span-2" onClick={add}>
            Buat Akun
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              {edit?.userId === r.user_id ? (
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`ed-name-${r.id}`}>Nama</Label>
                    <Input
                      id={`ed-name-${r.id}`}
                      value={edit.name}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`ed-email-${r.id}`}>Email</Label>
                    <Input
                      id={`ed-email-${r.id}`}
                      type="email"
                      value={edit.email}
                      onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button size="sm" disabled={saving} onClick={saveEdit}>
                      {saving ? "Menyimpan…" : "Simpan"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-semibold">{r.display_name || r.email}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  <Badge variant={r.role === "developer" ? "default" : "secondary"}>
                    {r.role === "developer" ? "Developer" : "Installer"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEdit({ userId: r.user_id, name: r.display_name, email: r.email })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const pw = prompt("Sandi baru (min. 8 karakter):");
                      if (!pw) return;
                      try {
                        await reset({ data: { userId: r.user_id, password: pw } });
                        toast.success("Sandi diperbarui.");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Gagal");
                      }
                    }}
                  >
                    Ganti sandi
                  </Button>
                  {r.user_id !== selfId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Hapus ${r.email}`}
                      onClick={async () => {
                        if (!confirm(`Hapus akun ${r.email}?`)) return;
                        try {
                          await del({ data: { userId: r.user_id } });
                          void load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Gagal");
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
