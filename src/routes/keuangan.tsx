import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { FinanceForm } from "@/components/pos/finance-form";
import { FinanceReport, RangePicker } from "@/components/pos/reports";
import { usePos } from "@/lib/pos/store";
import { hasPerm } from "@/lib/pos/permissions";
import { FINANCE_KINDS } from "@/lib/pos/finance";
import { defaultRange, rangeLabel, type ReportRange } from "@/lib/pos/report-range";
import type { FinanceKind } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/keuangan")({
  head: () => ({
    meta: [
      { title: "Finance — POS UKM" },
      { name: "description", content: "Catat Other Income, Expense, Paid-In dan Paid-Out store." },
      { property: "og:title", content: "Finance — POS UKM" },
      { property: "og:description", content: "Catat Other Income, Expense, Paid-In dan Paid-Out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <FinancePage />
      </AppShell>
    </PosGate>
  ),
});

function FinancePage() {
  const { db, currentUser } = usePos();
  const [range, setRange] = useState<ReportRange>(() => defaultRange(db.settings));
  const [kind, setKind] = useState<FinanceKind | null>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const [title, setTitle] = useState("Finance");

  if (!hasPerm(db.settings, currentUser?.role, "finance.manage"))
    return <p className="p-6 text-sm text-muted-foreground">Akun Anda tidak berhak membuka Finance.</p>;

  return (
    <div>
      <PageHeader
        title="Finance"
        description={rangeLabel(range)}
        action={
          <div className="flex flex-wrap gap-2">
            {FINANCE_KINDS.map((k) => (
              <Button key={k.kind} size="sm" className="gap-1" onClick={() => setKind(k.kind)}>
                <Plus className="size-4" /> {k.label}
              </Button>
            ))}
          </div>
        }
      />
      <div className="space-y-4 p-4 md:p-6">
        <RangePicker range={range} onChange={setRange} />
        <FinanceReport range={range} />
      </div>
      <FinanceForm
        open={kind !== null}
        kind={kind ?? "expense"}
        onOpenChange={(v) => !v && setKind(null)}
        onPrint={(t, l) => {
          setTitle(t);
          setLines(l);
        }}
      />
      <PrintPreview
        open={lines !== null}
        onOpenChange={(v) => !v && setLines(null)}
        title={title}
        lines={lines ?? []}
      />
    </div>
  );
}
