/** Pilih atau daftarkan member cepat dari layar kasir. */
import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { uid } from "@/lib/pos/format";
import { nextMemberCode, normalizePhone, searchMembers } from "@/lib/pos/members";
import type { Member } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function newMember(name: string, phone: string, code: string, extra: Partial<Member> = {}): Member {
  return {
    id: uid("mbr"),
    code,
    name: name.trim(),
    phone: normalizePhone(phone),
    points: 0,
    totalSpend: 0,
    visits: 0,
    joinedAt: new Date().toISOString(),
    active: true,
    ...extra,
  };
}

export function MemberPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (member: Member) => void;
}) {
  const { db, update } = usePos();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"search" | "new">("search");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const results = searchMembers(db, query);

  function register() {
    if (!name.trim()) {
      toast.error("Nama member wajib diisi.");
      return;
    }
    if (!normalizePhone(phone)) {
      toast.error("Nomor WhatsApp/telepon wajib diisi.");
      return;
    }
    const exists = (db.members ?? []).find((m) => normalizePhone(m.phone) === normalizePhone(phone));
    if (exists) {
      toast.error(`Nomor ini sudah terdaftar sebagai ${exists.name}.`);
      onPick(exists);
      reset();
      onOpenChange(false);
      return;
    }
    const member = newMember(name, phone, nextMemberCode(db));
    update((cur) => ({ ...cur, members: [...(cur.members ?? []), member] }));
    toast.success(`Member ${member.name} terdaftar (${member.code}).`);
    onPick(member);
    reset();
    onOpenChange(false);
  }

  function reset() {
    setQuery("");
    setName("");
    setPhone("");
    setMode("search");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "Daftar Member Baru" : "Pilih Member"}</DialogTitle>
          <DialogDescription>
            {mode === "new"
              ? "Cukup nama dan nomor WhatsApp, poin langsung mulai terkumpul."
              : "Cari dengan nama, nomor telepon, atau kode member."}
          </DialogDescription>
        </DialogHeader>

        {mode === "search" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nama / nomor / kode member"
                className="h-11 pl-9"
              />
            </div>
            <div className="max-h-64 space-y-1.5 overflow-auto">
              {results.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Member tidak ditemukan.
                </p>
              )}
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full rounded-lg border p-3 text-left hover:border-primary hover:bg-muted/60"
                  onClick={() => {
                    onPick(m);
                    reset();
                    onOpenChange(false);
                  }}
                >
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.code} • {m.phone || "tanpa nomor"}
                  </p>
                  <p className="tabular text-xs font-medium text-primary">{m.points} poin</p>
                </button>
              ))}
            </div>
            <Button variant="secondary" className="w-full gap-2" onClick={() => setMode("new")}>
              <UserPlus className="size-4" /> Daftar member baru
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mbr-name">Nama</Label>
              <Input
                id="mbr-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama pelanggan"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mbr-phone">Nomor WhatsApp</Label>
              <Input
                id="mbr-phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="h-11"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("search")}>
                Batal
              </Button>
              <Button className="flex-1" onClick={register}>
                Simpan & pilih
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
