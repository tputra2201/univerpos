import { useState } from "react";
import { toast } from "sonner";
import type { PosUser, UserRole } from "@/lib/pos/types";
import { ROLE_LABEL } from "@/lib/pos/roles";
import { normalizeEmail, normalizeWa } from "@/lib/pos/pin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Form edit data pengguna.
 * - `self`: pengguna mengubah datanya sendiri (wajib PIN saat ini, peran tidak bisa diubah).
 * - selain itu: diubah oleh pemilik/manajer.
 */
export function EditUserForm({
  user,
  self,
  onSave,
  onCancel,
}: {
  user: PosUser;
  self?: boolean;
  onSave: (next: PosUser) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [wa, setWa] = useState(user.whatsapp ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [pin, setPin] = useState("");

  function submit(): void {
    if (!name.trim()) { toast.error("Nama wajib diisi."); return; }
    const w = wa.trim() ? normalizeWa(wa) : "";
    const e = email.trim() ? normalizeEmail(email) : "";
    if (!w && !e) { toast.error("Isi minimal No. WhatsApp atau Email."); return; }
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Format email tidak valid."); return; }
    if (w && w.length < 9) { toast.error("Nomor WhatsApp tidak valid."); return; }
    if (self && pin !== user.pin) { toast.error("PIN saat ini salah."); return; }
    const next: PosUser = { ...user, name: name.trim(), role: self ? user.role : role };
    delete next.whatsapp; delete next.email;
    if (w) next.whatsapp = w;
    if (e) next.email = e;
    onSave(next);
    toast.success("Data pengguna disimpan.");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="eu-name">Nama</Label>
        <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eu-wa">No. WhatsApp</Label>
        <Input id="eu-wa" inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="08xxxxxxxxxx" className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eu-email">Email</Label>
        <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
      </div>
      {!self && (
        <div className="space-y-2">
          <Label htmlFor="eu-role">Peran</Label>
          <select id="eu-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
            {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
      )}
      {self && (
        <div className="space-y-2">
          <Label htmlFor="eu-pin">PIN Saat Ini (verifikasi)</Label>
          <Input id="eu-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} className="h-11 font-mono tracking-widest" />
        </div>
      )}
      <div className="flex gap-2">
        {onCancel && <Button variant="outline" className="h-11 flex-1" onClick={onCancel}>Batal</Button>}
        <Button className="h-11 flex-1" onClick={submit}>Simpan</Button>
      </div>
    </div>
  );
}
