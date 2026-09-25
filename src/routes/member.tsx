import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { newMember } from "@/components/pos/member-picker";
import { usePos } from "@/lib/pos/store";
import { hasPerm } from "@/lib/pos/permissions";
import { rupiah } from "@/lib/pos/format";
import {
  loyaltyOf,
  memberPointsOf,
  membersOf,
  nextMemberCode,
  normalizePhone,
  pointsToRupiah,
} from "@/lib/pos/members";
import type { Member } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/member")({
  head: () => ({
    meta: [
      { title: "Member — POS UKM" },
      {
        name: "description",
        content: "Kelola member, poin loyalitas, dan riwayat belanja pelanggan store Anda.",
      },
      { property: "og:title", content: "Member — POS UKM" },
      { property: "og:description", content: "Kelola member dan poin loyalitas pelanggan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <MemberPage />
      </AppShell>
    </PosGate>
  ),
});

function MemberPage() {
  const { db, update, currentUser } = usePos();
  const loyalty = loyaltyOf(db.settings);
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<Member | null>(null);
  const [adjust, setAdjust] = useState<Member | null>(null);
  const [detail, setDetail] = useState<Member | null>(null);

  const members = membersOf(db);
  const ledger = memberPointsOf(db);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...members].sort((a, b) => b.totalSpend - a.totalSpend);
    if (!q) return list;
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
    );
  }, [members, query]);

  if (!hasPerm(db.settings, currentUser?.role, "member.manage"))
    return <p className="p-6 text-sm text-muted-foreground">Akun Anda tidak berhak membuka Member.</p>;

  const totalPoints = members.reduce((s, m) => s + m.points, 0);
  const totalSpend = members.reduce((s, m) => s + m.totalSpend, 0);

  function save(m: Member) {
    if (!m.name.trim()) {
      toast.error("Nama member wajib diisi.");
      return;
    }
    update((cur) => {
      const list = membersOf(cur);
      const exists = list.some((x) => x.id === m.id);
      return {
        ...cur,
        members: exists ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m],
      };
    });
    setEdit(null);
    toast.success("Member disimpan.");
  }

  function remove(m: Member) {
    if (!window.confirm(`Hapus member ${m.name}? Riwayat poinnya juga dihapus.`)) return;
    update((cur) => ({
      ...cur,
      members: membersOf(cur).filter((x) => x.id !== m.id),
      memberPoints: memberPointsOf(cur).filter((x) => x.memberId !== m.id),
    }));
    toast.success("Member dihapus.");
  }

  function applyAdjust(m: Member, points: number, note: string) {
    if (!points) {
      toast.error("Jumlah poin tidak boleh 0.");
      return;
    }
    update((cur) => ({
      ...cur,
      members: membersOf(cur).map((x) =>
        x.id === m.id ? { ...x, points: Math.max(0, x.points + points) } : x,
      ),
      memberPoints: [
        ...memberPointsOf(cur),
        {
          id: `mpt_${Date.now()}`,
          memberId: m.id,
          createdAt: new Date().toISOString(),
          type: "adjust" as const,
          points,
          note: note.trim() || "Penyesuaian manual",
          userName: currentUser?.name ?? "",
        },
      ],
    }));
    setAdjust(null);
    toast.success("Poin disesuaikan.");
  }

  return (
    <div>
      <PageHeader
        title="Member"
        description={`${members.length} member • ${totalPoints} poin beredar`}
        action={
          <Button
            className="gap-1"
            onClick={() => setEdit(newMember("", "", nextMemberCode(db)))}
          >
            <Plus className="size-4" /> Member Baru
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Jumlah member" value={String(members.length)} />
          <Stat label="Total belanja member" value={rupiah(totalSpend)} />
          <Stat
            label="Nilai poin beredar"
            value={rupiah(pointsToRupiah(totalPoints, loyalty))}
          />
        </div>

        <Tabs defaultValue="daftar">
          <TabsList>
            <TabsTrigger value="daftar">Daftar Member</TabsTrigger>
            <TabsTrigger value="top">Pelanggan Teratas</TabsTrigger>
          </TabsList>

          <TabsContent value="daftar" className="space-y-3 pt-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama / nomor / kode"
                className="pl-9"
              />
            </div>

            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Belum ada member. Kasir juga bisa mendaftarkan member langsung dari keranjang.
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((m) => (
                <Card key={m.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{m.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {m.code} • {m.phone || "tanpa nomor"}
                        </p>
                      </div>
                      {!m.active && <Badge variant="secondary">Nonaktif</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo poin</span>
                      <span className="tabular font-semibold text-primary">{m.points}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total belanja</span>
                      <span className="tabular font-semibold">{rupiah(m.totalSpend)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaksi</span>
                      <span className="tabular">{m.visits}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="secondary" onClick={() => setDetail(m)}>
                        Riwayat
                      </Button>
                      <Button size="sm" variant="secondary" className="gap-1" onClick={() => setAdjust(m)}>
                        <Star className="size-3.5" /> Poin
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEdit(m)}>
                        <Pencil className="size-3.5" /> Ubah
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive"
                        onClick={() => remove(m)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="top" className="pt-3">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Member</th>
                      <th className="p-3 text-right">Transaksi</th>
                      <th className="p-3 text-right">Total Belanja</th>
                      <th className="p-3 text-right">Poin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...members]
                      .sort((a, b) => b.totalSpend - a.totalSpend)
                      .slice(0, 20)
                      .map((m, i) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="p-3 tabular">{i + 1}</td>
                          <td className="p-3">
                            {m.name}
                            <span className="block text-xs text-muted-foreground">{m.code}</span>
                          </td>
                          <td className="p-3 text-right tabular">{m.visits}</td>
                          <td className="p-3 text-right tabular">{rupiah(m.totalSpend)}</td>
                          <td className="p-3 text-right tabular">{m.points}</td>
                        </tr>
                      ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          Belum ada data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <MemberForm member={edit} onClose={() => setEdit(null)} onSave={save} />

      <AdjustDialog member={adjust} onClose={() => setAdjust(null)} onApply={applyAdjust} />

      <Dialog open={detail !== null} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Riwayat Poin — {detail?.name}</DialogTitle>
            <DialogDescription>Perolehan, penukaran, dan penyesuaian poin.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {ledger
              .filter((l) => l.memberId === detail?.id)
              .slice()
              .reverse()
              .map((l) => (
                <div key={l.id} className="flex items-start justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {l.type === "earn" ? "Poin masuk" : l.type === "redeem" ? "Poin ditukar" : "Penyesuaian"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(l.createdAt).toLocaleString("id-ID")}
                      {l.saleCode ? ` • ${l.saleCode}` : ""}
                    </p>
                    {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
                  </div>
                  <span
                    className={`tabular font-semibold ${l.points < 0 ? "text-destructive" : "text-primary"}`}
                  >
                    {l.points > 0 ? "+" : ""}
                    {l.points}
                  </span>
                </div>
              ))}
            {ledger.filter((l) => l.memberId === detail?.id).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Belum ada riwayat poin.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="tabular text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function MemberForm({
  member,
  onClose,
  onSave,
}: {
  member: Member | null;
  onClose: () => void;
  onSave: (m: Member) => void;
}) {
  const [draft, setDraft] = useState<Member | null>(member);
  const key = member?.id ?? "none";
  if (draft?.id !== member?.id) setDraft(member);

  return (
    <Dialog open={member !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" key={key}>
        <DialogHeader>
          <DialogTitle>{member?.name ? "Ubah Member" : "Member Baru"}</DialogTitle>
          <DialogDescription>Kode member: {member?.code}</DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-3">
            <Field label="Nama" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
            <Field
              label="Nomor WhatsApp"
              value={draft.phone}
              onChange={(v) => setDraft({ ...draft, phone: normalizePhone(v) })}
            />
            <Field
              label="Email (opsional)"
              value={draft.email ?? ""}
              onChange={(v) => setDraft({ ...draft, email: v })}
            />
            <Field
              label="Catatan (opsional)"
              value={draft.note ?? ""}
              onChange={(v) => setDraft({ ...draft, note: v })}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => draft && onSave(draft)}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-11" />
    </div>
  );
}

function AdjustDialog({
  member,
  onClose,
  onApply,
}: {
  member: Member | null;
  onClose: () => void;
  onApply: (m: Member, points: number, note: string) => void;
}) {
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(v) => {
        if (!v) {
          setPoints("");
          setNote("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sesuaikan Poin — {member?.name}</DialogTitle>
          <DialogDescription>
            Saldo sekarang {member?.points ?? 0} poin. Isi angka minus untuk mengurangi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Jumlah poin" value={points} onChange={(v) => setPoints(v.replace(/[^\d-]/g, ""))} />
          <Field label="Catatan" value={note} onChange={setNote} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => member && onApply(member, Number(points) || 0, note)}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
