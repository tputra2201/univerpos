import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Tabel baru belum ada di tipe hasil generate saat file ini dibuat.
const db = supabase as unknown as {
  from: (t: string) => any;
};

export function ContactPanel() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    db.from("app_settings")
      .select("contact_email, contact_phone")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }: { data: { contact_email: string; contact_phone: string } | null }) => {
        setEmail(data?.contact_email ?? "");
        setPhone(data?.contact_phone ?? "");
        setBusy(false);
      });
  }, []);

  async function save() {
    setBusy(true);
    const { error } = await db
      .from("app_settings")
      .upsert({ id: 1, contact_email: email.trim(), contact_phone: phone.trim(), updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Kontak developer disimpan.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontak Developer</CardTitle>
        <CardDescription>
          Ditampilkan di layar store saat masa berlaku habis atau store dinonaktifkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dev-email">Email Developer</Label>
          <Input id="dev-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dev-phone">Nomor Telepon / WhatsApp</Label>
          <Input id="dev-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button className="sm:col-span-2" disabled={busy} onClick={save}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Simpan Kontak"}
        </Button>
      </CardContent>
    </Card>
  );
}
