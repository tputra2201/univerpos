import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const clean = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** Form ganti PIN. Jika `oldPin` diberikan, PIN lama wajib diverifikasi. */
export function ChangePinForm({
  oldPin,
  onSave,
  onCancel,
}: {
  oldPin?: string | undefined;
  onSave: (pin: string) => void;
  onCancel?: () => void;
}) {
  const [old, setOld] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");

  function submit() {
    if (oldPin !== undefined && old !== oldPin) { toast.error("PIN lama salah."); return; }
    if (!/^\d{4,6}$/.test(pin)) { toast.error("PIN baru harus 4–6 angka."); return; }
    if (pin !== pin2) { toast.error("Konfirmasi PIN belum sama."); return; }
    if (oldPin !== undefined && pin === oldPin) { toast.error("PIN baru tidak boleh sama dengan PIN lama."); return; }
    onSave(pin);
    toast.success("PIN berhasil diganti.");
  }

  const field = (id: string, label: string, v: string, set: (s: string) => void) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" inputMode="numeric" value={v} onChange={(e) => set(clean(e.target.value))} className="h-11 font-mono tracking-widest" />
    </div>
  );

  return (
    <div className="space-y-4">
      {oldPin !== undefined && field("old-pin", "PIN Lama", old, setOld)}
      {field("new-pin", "PIN Baru (4–6 angka)", pin, setPin)}
      {field("new-pin2", "Ulangi PIN Baru", pin2, setPin2)}
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="outline" className="h-11 flex-1" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button className="h-11 flex-1" onClick={submit}>
          Simpan PIN
        </Button>
      </div>
    </div>
  );
}
