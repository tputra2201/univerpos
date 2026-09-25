import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { PrintPreview } from "@/components/pos/print-sheet";
import { ShiftPanel } from "@/components/pos/shift-panel";

export const Route = createFileRoute("/shift")({
  head: () => ({
    meta: [
      { title: "Shift Kasir — POS UKM" },
      { name: "description", content: "Check-in, close out kasir, dan End of Day." },
      { property: "og:title", content: "Shift Kasir — POS UKM" },
      { property: "og:description", content: "Check-in, close out kasir, dan End of Day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <ShiftPage />
      </AppShell>
    </PosGate>
  ),
});

function ShiftPage() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [title, setTitle] = useState("Laporan");
  return (
    <div>
      <PageHeader title="Shift Kasir" description="Check-in, close out, dan End of Day" />
      <div className="p-4 md:p-6">
        <ShiftPanel
          onPrint={(t, l) => {
            setTitle(t);
            setLines(l);
          }}
        />
      </div>
      <PrintPreview
        open={lines !== null}
        onOpenChange={(v) => !v && setLines(null)}
        title={title}
        lines={lines ?? []}
      />
    </div>
  );
}
