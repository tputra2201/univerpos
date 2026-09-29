import { createFileRoute } from "@tanstack/react-router";
import { PosGate } from "@/components/pos/pos-gate";
import { AppShell, PageHeader } from "@/components/pos/app-shell";
import { StockSettings } from "@/components/pos/stock-settings";

export const Route = createFileRoute("/stok")({
  head: () => ({
    meta: [
      { title: "Stok — POS UKM" },
      {
        name: "description",
        content: "Pantau stok bahan & kemasan, catat barang masuk, dan lakukan stok opname.",
      },
      { property: "og:title", content: "Stok — POS UKM" },
      { property: "og:description", content: "Pantau stok bahan & kemasan store Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PosGate>
      <AppShell>
        <PageHeader title="Stok" description="Stok bahan & kemasan, barang masuk, dan stok opname." />
        <div className="space-y-4 p-4 md:p-6">
          <StockSettings />
        </div>
      </AppShell>
    </PosGate>
  ),
});
