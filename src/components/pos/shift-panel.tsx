/** Prosedur check-in kasir, cash close out, dan End of Day (tutup hari usaha). */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ClipboardCheck, LogIn, Wallet, CalendarCheck2, Printer } from "lucide-react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { dateTime, rupiah, uid } from "@/lib/pos/format";
import { buildReport } from "@/lib/pos/receipt";
import { hasPerm } from "@/lib/pos/permissions";
import { roleLabel } from "@/lib/pos/roles";
import {
  activeBusinessDayOf,
  activeShiftOf,
  salesOfShift,
  suggestedStartCash,
  summarize, financeOfShift, needsAutoEod, nextShiftNumber,
} from "@/lib/pos/shift";
import type { FinanceKind, Shift } from "@/lib/pos/types";
import { FinanceForm } from "@/components/pos/finance-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function num(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function MoneyInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      value={value ? num(value).toLocaleString("id-ID") : ""}
      placeholder="0"
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      className="tabular h-11 text-right text-lg font-bold"
    />
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "good" | "bad" | undefined;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`tabular truncate text-base font-bold ${
          tone === "primary"
            ? "text-primary"
            : tone === "good"
              ? "text-emerald-600"
              : tone === "bad"
                ? "text-destructive"
                : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ShiftPanel({
  onPrint,
}: {
  onPrint: (title: string, lines: string[]) => void;
}) {
  const { db, update, currentUser } = usePos();
  const navigate = useNavigate();
  const shift = activeShiftOf(db);
  const day = activeBusinessDayOf(db);
  const canShift = hasPerm(db.settings, currentUser?.role, "shift.manage");
  const canEod = hasPerm(db.settings, currentUser?.role, "eod.close");
  const who = currentUser?.name ?? "Kasir";

  const suggested = useMemo(() => suggestedStartCash(db.shifts), [db.shifts]);
  const [startCash, setStartCash] = useState("");
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [nextStart, setNextStart] = useState("");
  const [nextEdited, setNextEdited] = useState(false);
  const [dayNote, setDayNote] = useState("");
  const [finKind, setFinKind] = useState<FinanceKind | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const canFinance = hasPerm(db.settings, currentUser?.role, "finance.manage");

  const sum = shift ? summarize(shift, salesOfShift(db, shift), financeOfShift(db, shift)) : null;
  const balance = sum ? num(actual) - sum.expected : 0;

  const dayShifts = day ? db.shifts.filter((s) => s.openedAt >= day.openedAt) : [];
  const dayOpen = dayShifts.some((s) => !s.closedAt);

  function checkIn() {
    const cash = num(startCash || String(suggested));
    const now = new Date().toISOString();
    let autoClosed = false;
    let shiftNo = 1;
    update((cur) => {
      let days = cur.businessDays ?? [];
      if (needsAutoEod(cur, now)) {
        const label = `End of Day : ${dateTime(now)} by System`;
        days = days.map((d) => (!d.closedAt ? { ...d, closedAt: now, closedBy: "System", note: label } : d));
        autoClosed = true;
      }
      let open = days.find((d) => !d.closedAt);
      if (!open) {
        open = { id: uid("bday"), openedAt: now, closedAt: null, openedBy: who };
        days = [open, ...days];
      }
      shiftNo = nextShiftNumber(cur, open.id, open.openedAt);
      const row: Shift = {
        id: uid("shf"),
        openedAt: now,
        closedAt: null,
        openingCash: cash,
        closingCash: null,
        userName: who,
        businessDayId: open.id,
        shiftNumber: shiftNo,
      };
      return { ...cur, businessDays: days, shifts: [row, ...cur.shifts] };
    });
    setStartCash("");
    const willClose = needsAutoEod(db, now);
    const no = willClose || !day ? 1 : nextShiftNumber(db, day.id, day.openedAt);
    void autoClosed; void shiftNo;
    if (willClose) toast.success(`Hari usaha sebelumnya ditutup otomatis (End of Day by System). Shift 1 ${who} dimulai.`);
    else toast.success(`Shift ${no} ${who} dimulai.`);
    navigate({ to: "/" });
  }

  function closeOut() {
    if (!shift || !sum) return;
    if (!actual.trim()) {
      toast.error("Isi jumlah kas fisik di laci.");
      return;
    }
    const cashActual = num(actual);
    const diff = cashActual - sum.expected;
    if (diff !== 0 && !note.trim()) {
      toast.error("Ada selisih kas, isi catatan selisih dulu.");
      return;
    }
    const closedAt = new Date().toISOString();
    const next = nextEdited ? num(nextStart) : cashActual;
    update((cur) => ({
      ...cur,
      shifts: cur.shifts.map((s) =>
        s.id === shift.id
          ? {
              ...s,
              closedAt,
              closingCash: cashActual,
              expectedCash: sum.expected,
              balanceNote: note,
              nextStartCash: next,
              closedBy: who,
            }
          : s,
      ),
    }));
    onPrint(
      "Laporan Close Out (Z)",
      buildReport(
        {
          title: "CASH CLOSE OUT (Z)",
          from: dateTime(shift.openedAt),
          to: dateTime(closedAt),
          sales: salesOfShift(db, shift),
          openingCash: shift.openingCash,
          extra: [
            { label: "Kasir", value: shift.userName },
            { label: "Kas Awal", value: rupiah(shift.openingCash) },
            { label: "Penjualan Tunai", value: rupiah(sum.cashSales) },
            { label: "Non-Tunai", value: rupiah(sum.nonCashSales) },
            { label: "Mutasi Kas Finance", value: rupiah(sum.financeCash) },
            { label: "Kas Seharusnya", value: rupiah(sum.expected) },
            { label: "Kas Fisik", value: rupiah(cashActual) },
            { label: "Selisih", value: rupiah(diff) },
            { label: "Modal Berikutnya", value: rupiah(next) },
            ...(note.trim() ? [{ label: "Catatan", value: note.trim() }] : []),
          ],
        },
        db,
      ),
    );
    setActual("");
    setNote("");
    setNextStart("");
    setNextEdited(false);
    toast.success("Shift ditutup.");
  }

  function endOfDay() {
    if (!day) return;
    if (dayOpen) {
      toast.error("Masih ada shift yang belum di-close out.");
      return;
    }
    const closedAt = new Date().toISOString();
    const sales = db.sales.filter(
      (s) => s.status === "paid" && s.createdAt >= day.openedAt && s.createdAt <= closedAt,
    );
    const cash = dayShifts.reduce((a, s) => a + (s.closingCash ?? 0), 0);
    const diff = dayShifts.reduce(
      (a, s) => a + ((s.closingCash ?? 0) - (s.expectedCash ?? s.openingCash)),
      0,
    );
    update((cur) => ({
      ...cur,
      businessDays: (cur.businessDays ?? []).map((d) =>
        d.id === day.id ? { ...d, closedAt, closedBy: who, note: dayNote } : d,
      ),
    }));
    onPrint(
      "Laporan End of Day",
      buildReport(
        {
          title: "END OF DAY",
          from: dateTime(day.openedAt),
          to: dateTime(closedAt),
          sales,
          extra: [
            { label: "Jumlah Shift", value: String(dayShifts.length) },
            { label: "Total Kas Fisik", value: rupiah(cash) },
            { label: "Total Selisih Kas", value: rupiah(diff) },
            { label: "Ditutup oleh", value: who },
            ...(dayNote.trim() ? [{ label: "Catatan", value: dayNote.trim() }] : []),
          ],
        },
        db,
      ),
    );
    setDayNote("");
    toast.success("Hari usaha ditutup.");
  }

  const sortedShifts = useMemo(
    () => [...db.shifts].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1)),
    [db.shifts],
  );

  return (
    <div className="space-y-4">
      <FinanceForm
        open={finKind !== null}
        kind={finKind ?? "expense"}
        onOpenChange={(v) => !v && setFinKind(null)}
        onPrint={onPrint}
      />
      {day && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hari Usaha Berjalan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <Field label="Dibuka" value={dateTime(day.openedAt)} />
            <Field label="Jumlah shift" value={`${dayShifts.length} shift`} />
            <Field label="Dibuka oleh" value={day.openedBy} tone="primary" />
          </CardContent>
        </Card>
      )}

      {!canShift && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Akun Anda tidak berhak melakukan check-in atau close out kasir.
          </CardContent>
        </Card>
      )}

      {canShift && !shift && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LogIn className="size-4 text-primary" /> Check-in Kasir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Nama kasir" value={who} />
              <Field
                label="Level"
                value={currentUser ? roleLabel(currentUser.role) : "Kasir"}
              />
              <Field
                label="Kas yang harus ada di laci"
                value={rupiah(suggested)}
                tone="primary"
              />
            </div>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="start-cash">Kas awal (hitung fisik laci)</Label>
              <MoneyInput
                id="start-cash"
                value={startCash || String(suggested || "")}
                onChange={setStartCash}
              />
            </div>
            <Button className="gap-2" onClick={checkIn}>
              <Wallet className="size-4" /> Mulai Shift
            </Button>
          </CardContent>
        </Card>
      )}

      {canShift && shift && sum && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4 text-primary" /> Cash Close Out
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Nama kasir" value={shift.userName} />
              <Field label="Buka kasir" value={dateTime(shift.openedAt)} />
              <Field label="Sekarang" value={dateTime(new Date().toISOString())} />
              <Field label="Kas awal" value={rupiah(shift.openingCash)} />
              <Field label="Jumlah transaksi" value={String(sum.count)} />
              <Field label="Total Sales" value={rupiah(sum.omzet)} />
              <Field label="Penjualan tunai" value={rupiah(sum.cashSales)} />
              <Field label="Penjualan non-tunai" value={rupiah(sum.nonCashSales)} />
              <Field label="Mutasi kas Finance" value={rupiah(sum.financeCash)} />
              <Field label="Kas seharusnya" value={rupiah(sum.expected)} tone="primary" />
            </div>
            {canFinance && (
              <div className="flex flex-wrap gap-2">
                {(["paidin", "paidout", "expense", "income"] as FinanceKind[]).map((k) => (
                  <Button key={k} size="sm" variant="secondary" onClick={() => setFinKind(k)}>
                    + {k === "paidin" ? "Paid-In" : k === "paidout" ? "Paid-Out" : k === "expense" ? "Expense" : "Other Income"}
                  </Button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cash-actual">Kas fisik di laci</Label>
                <MoneyInput
                  id="cash-actual"
                  value={actual}
                  onChange={(v) => {
                    setActual(v);
                    if (!nextEdited) setNextStart(v);
                  }}
                />
              </div>
              <Field
                label="Selisih kas (fisik − seharusnya)"
                value={rupiah(balance)}
                tone={balance === 0 ? undefined : balance > 0 ? "good" : "bad"}
              />
              <div className="space-y-1.5">
                <Label htmlFor="balance-note">Catatan selisih</Label>
                <Input
                  id="balance-note"
                  value={note}
                  placeholder="Alasan selisih kas"
                  onChange={(e) => setNote(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="next-start">Modal untuk shift berikutnya</Label>
                <MoneyInput
                  id="next-start"
                  value={nextStart}
                  onChange={(v) => {
                    setNextStart(v);
                    setNextEdited(true);
                  }}
                />
              </div>
            </div>
            <Button
              className="gap-2"
              onClick={() => {
                if (!actual.trim()) { toast.error("Isi jumlah kas fisik di laci."); return; }
                if (balance !== 0 && !note.trim()) { toast.error("Ada selisih kas, isi catatan selisih dulu."); return; }
                setConfirmClose(true);
              }}
            >
              <Printer className="size-4" /> Close Out & Cetak
            </Button>
            <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tutup shift sekarang?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Shift {shift.userName} akan ditutup dan laporan Z dicetak. Tindakan ini tidak bisa dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="Kas seharusnya" value={rupiah(sum.expected)} />
                  <Field label="Kas fisik" value={rupiah(num(actual))} tone="primary" />
                  <Field label="Selisih" value={rupiah(balance)} tone={balance === 0 ? undefined : balance > 0 ? "good" : "bad"} />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={closeOut}>Ya, close out</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {canEod && day && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck2 className="size-4 text-primary" /> End of Day
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Tutup hari usaha setelah seluruh shift kasir selesai close out.
              {dayOpen && " Masih ada shift yang berjalan."}
            </p>
            <div className="space-y-1.5 sm:max-w-md">
              <Label htmlFor="day-note">Catatan hari usaha</Label>
              <Input
                id="day-note"
                value={dayNote}
                placeholder="Opsional"
                onChange={(e) => setDayNote(e.target.value)}
                className="h-11"
              />
            </div>
            <Button className="gap-2" disabled={dayOpen} onClick={endOfDay}>
              <CalendarCheck2 className="size-4" /> Tutup Hari Usaha
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Riwayat Shift</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {sortedShifts.length === 0 && (
            <p className="text-muted-foreground">Belum ada shift tercatat.</p>
          )}
          {sortedShifts.slice(0, 20).map((s) => {
            const sm = summarize(s, salesOfShift(db, s), financeOfShift(db, s));
            const expected = s.expectedCash ?? sm.expected;
            const diff = s.closedAt ? (s.closingCash ?? 0) - expected : 0;
            return (
              <div key={s.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <span>{s.userName}</span>
                    {!s.closedAt && <Badge variant="secondary">Sedang bertugas</Badge>}
                  </div>
                  <p className="break-words text-xs text-muted-foreground">
                    {dateTime(s.openedAt)}
                    {s.closedAt ? ` → ${dateTime(s.closedAt)}` : " → berjalan"}
                    {s.balanceNote ? ` · ${s.balanceNote}` : ""}
                  </p>
                </div>
                <div className="tabular text-right text-xs">
                  <p>{sm.count} transaksi · Total Sales {rupiah(sm.omzet)}</p>
                  <p>Tunai {rupiah(sm.cashSales)} · Non-tunai {rupiah(sm.nonCashSales)}</p>
                  <p>Awal {rupiah(s.openingCash)}</p>
                  <p>
                    Sistem {rupiah(expected)}
                    {s.closedAt && ` · Fisik ${rupiah(s.closingCash ?? 0)}`}
                  </p>
                  {s.closedAt && (
                    <p
                      className={
                        diff === 0
                          ? "font-semibold"
                          : diff > 0
                            ? "font-semibold text-emerald-600"
                            : "font-semibold text-destructive"
                      }
                    >
                      Selisih {rupiah(diff)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
