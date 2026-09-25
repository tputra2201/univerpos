/** Dialog pencatatan Other Income / Expense / Paid-In / Paid-Out. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { uid } from "@/lib/pos/format";
import { FINANCE_KINDS, buildFinanceSlip, financeCategoriesOf } from "@/lib/pos/finance";
import { activeShiftOf } from "@/lib/pos/shift";
import type { FinanceEntry, FinanceKind } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const sel =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function FinanceForm({
  open,
  kind: initialKind,
  onOpenChange,
  onPrint,
}: {
  open: boolean;
  kind: FinanceKind;
  onOpenChange: (v: boolean) => void;
  onPrint?: (title: string, lines: string[]) => void;
}) {
  const { db, update, currentUser } = usePos();
  const [kind, setKind] = useState<FinanceKind>(initialKind);
  const [catId, setCatId] = useState("");
  const [itemName, setItemName] = useState("");
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const methods = db.paymentMethods.filter((m) => m.active);
  const cats = financeCategoriesOf(db).filter((c) => c.kind === kind);
  const cat = cats.find((c) => c.id === catId);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setCatId("");
    setItemName("");
    setMethodId(methods.find((m) => m.isCash)?.id ?? methods[0]?.id ?? "");
    setAmount("");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKind]);

  function submit() {
    const value = Number(amount) || 0;
    const method = methods.find((m) => m.id === methodId);
    if (!cat) return toast.error("Pilih kategori.");
    if (!itemName) return toast.error("Pilih item.");
    if (!method) return toast.error("Pilih metode pembayaran.");
    if (value <= 0) return toast.error("Isi nominal.");
    const shift = activeShiftOf(db);
    const meta = FINANCE_KINDS.find((k) => k.kind === kind)!;
    const now = new Date();
    const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const entry: FinanceEntry = {
      id: uid("fin"),
      code: `${meta.code}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      kind,
      createdAt: now.toISOString(),
      categoryId: cat.id,
      categoryName: cat.name,
      itemName,
      methodId: method.id,
      methodName: method.name,
      isCash: method.isCash,
      amount: value,
      note: note.trim(),
      userName: currentUser?.name ?? "Kasir",
      ...(shift ? { shiftId: shift.id } : {}),
    };
    update((cur) => ({ ...cur, financeEntries: [entry, ...(cur.financeEntries ?? [])] }));
    toast.success(`${meta.label} tercatat.`);
    onOpenChange(false);
    onPrint?.(meta.label, buildFinanceSlip(entry, db));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Finance</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {FINANCE_KINDS.map((k) => (
              <Button
                key={k.kind}
                size="sm"
                variant={kind === k.kind ? "default" : "secondary"}
                onClick={() => {
                  setKind(k.kind);
                  setCatId("");
                  setItemName("");
                }}
              >
                {k.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {FINANCE_KINDS.find((k) => k.kind === kind)?.hint}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="fin-cat">Kategori</Label>
            <select
              id="fin-cat"
              className={sel}
              value={catId}
              onChange={(e) => {
                setCatId(e.target.value);
                setItemName("");
              }}
            >
              <option value="">— Pilih kategori —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {cats.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Atur kategori di Pengaturan → Finance.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fin-item">Item</Label>
            <select
              id="fin-item"
              className={sel}
              value={itemName}
              disabled={!cat}
              onChange={(e) => setItemName(e.target.value)}
            >
              <option value="">— Pilih item —</option>
              {cat?.items.map((i) => (
                <option key={i.id} value={i.name}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fin-method">Metode pembayaran</Label>
            <select
              id="fin-method"
              className={sel}
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fin-amount">Nominal</Label>
            <Input
              id="fin-amount"
              inputMode="numeric"
              placeholder="0"
              className="tabular h-11 text-right text-lg font-bold"
              value={amount ? Number(amount).toLocaleString("id-ID") : ""}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fin-note">Keterangan</Label>
            <Input
              id="fin-note"
              value={note}
              placeholder="Opsional"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button className="h-11 w-full" onClick={submit}>
            Simpan & Cetak
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
