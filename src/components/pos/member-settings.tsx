/** Pengaturan → Member: aturan poin dan diskon member. */
import { usePos } from "@/lib/pos/store";
import { loyaltyOf } from "@/lib/pos/members";
import { rupiah } from "@/lib/pos/format";
import type { LoyaltySettings } from "@/lib/pos/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MemberSettings() {
  const { db, update } = usePos();
  const loyalty = loyaltyOf(db.settings);

  function patch(next: Partial<LoyaltySettings>) {
    update((cur) => ({
      ...cur,
      settings: { ...cur.settings, loyalty: { ...loyaltyOf(cur.settings), ...next } },
    }));
  }

  const num = (v: string) => Number(v.replace(/\D/g, "")) || 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Program Member</CardTitle>
          <CardDescription>
            Pelanggan terdaftar mengumpulkan poin dari setiap belanja dan bisa menukarnya menjadi
            potongan harga.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Aktifkan program member</p>
              <p className="text-xs text-muted-foreground">
                Kalau dimatikan, poin tidak bertambah dan tidak bisa ditukar.
              </p>
            </div>
            <Switch checked={loyalty.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="earn">Belanja per 1 poin (Rp)</Label>
            <Input
              id="earn"
              inputMode="numeric"
              className="tabular"
              value={loyalty.earnPerAmount ? String(loyalty.earnPerAmount) : ""}
              onChange={(e) => patch({ earnPerAmount: num(e.target.value) })}
              placeholder="10000"
            />
            <p className="text-xs text-muted-foreground">
              Contoh: belanja {rupiah(loyalty.earnPerAmount || 0)} mendapat 1 poin.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Nilai 1 poin saat ditukar (Rp)</Label>
            <Input
              id="value"
              inputMode="numeric"
              className="tabular"
              value={loyalty.pointValue ? String(loyalty.pointValue) : ""}
              onChange={(e) => patch({ pointValue: num(e.target.value) })}
              placeholder="100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minredeem">Poin minimum untuk menukar</Label>
            <Input
              id="minredeem"
              inputMode="numeric"
              className="tabular"
              value={loyalty.minRedeem ? String(loyalty.minRedeem) : ""}
              onChange={(e) => patch({ minRedeem: num(e.target.value) })}
              placeholder="10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mdisc">Diskon khusus member (%)</Label>
            <Input
              id="mdisc"
              inputMode="decimal"
              className="tabular"
              value={loyalty.memberDiscountPercent ? String(loyalty.memberDiscountPercent) : ""}
              onChange={(e) =>
                patch({
                  memberDiscountPercent:
                    Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0,
                })
              }
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Kosongkan atau isi 0 kalau member tidak mendapat diskon otomatis.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contoh Perhitungan</CardTitle>
          <CardDescription>Simulasi belanja {rupiah(100000)}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Line
            label="Diskon member"
            value={rupiah(Math.round((100000 * (loyalty.memberDiscountPercent || 0)) / 100))}
          />
          <Line
            label="Poin didapat"
            value={`${loyalty.earnPerAmount > 0 ? Math.floor(100000 / loyalty.earnPerAmount) : 0} poin`}
          />
          <Line label="Nilai 100 poin" value={rupiah(100 * (loyalty.pointValue || 0))} />
          <p className="pt-2 text-xs text-muted-foreground">
            Kasir memilih member di keranjang, lalu bisa menukar poin saat pembayaran.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{value}</span>
    </div>
  );
}
