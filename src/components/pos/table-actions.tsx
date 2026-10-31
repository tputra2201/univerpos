import { useState } from "react";
import { ArrowRightLeft, Combine } from "lucide-react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import type { CartLine, HeldOrder } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Nama meja tunggal dari nama gabungan "Meja 1 + Meja 2". */
export function tableParts(name: string | undefined) {
  return (name || "").split(" + ").map((s) => s.trim()).filter(Boolean);
}

interface CartLike {
  tableName: string;
  heldId?: string;
  lines: CartLine[];
}

export function TableActions<T extends CartLike>({
  cart,
  setCart,
}: {
  cart: T;
  setCart: React.Dispatch<React.SetStateAction<T>>;
}) {
  const { db, update } = usePos();
  const [mode, setMode] = useState<"move" | "merge" | null>(null);
  const mine = tableParts(cart.tableName);

  const heldAt = (name: string): HeldOrder | undefined =>
    db.heldOrders.find((h) => h.id !== cart.heldId && tableParts(h.tableName).includes(name));

  function pick(name: string) {
    const other = heldAt(name);
    if (mode === "move") {
      if (other) {
        toast.error(`${name} sedang terisi. Gunakan Gabung Meja.`);
        return;
      }
      setCart((p) => ({ ...p, tableName: name }));
      if (cart.heldId) {
        update((c) => ({
          ...c,
          heldOrders: c.heldOrders.map((h) => (h.id === cart.heldId ? { ...h, tableName: name } : h)),
        }));
      }
      toast.success(`Pindah ke ${name}`);
    } else if (mode === "merge") {
      const names = [...mine];
      for (const n of other ? tableParts(other.tableName) : [name]) if (!names.includes(n)) names.push(n);
      const joined = names.join(" + ");
      setCart((p) => ({ ...p, tableName: joined, lines: other ? [...p.lines, ...other.items] : p.lines }));
      update((c) => ({
        ...c,
        heldOrders: c.heldOrders
          .filter((h) => !other || h.id !== other.id)
          .map((h) =>
            h.id === cart.heldId
              ? { ...h, tableName: joined, items: other ? [...h.items, ...other.items] : h.items }
              : h,
          ),
      }));
      toast.success(other ? `Pesanan ${name} digabung` : `Digabung: ${joined}`);
    }
    setMode(null);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {cart.tableName || <span className="text-muted-foreground">Belum pilih meja</span>}
      </span>
      <Button size="sm" variant="secondary" className="h-8 gap-1" onClick={() => setMode("move")}>
        <ArrowRightLeft className="size-4" /> {cart.tableName ? "Pindah" : "Pilih"}
      </Button>
      {cart.tableName && (
        <Button size="sm" variant="secondary" className="h-8 gap-1" onClick={() => setMode("merge")}>
          <Combine className="size-4" /> Gabung
        </Button>
      )}
      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === "merge" ? "Gabung Meja" : "Pindah Meja"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {db.tables
              .filter((t) => !mine.includes(t.name))
              .map((t) => {
                const held = heldAt(t.name);
                const blocked = mode === "move" && !!held;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(t.name)}
                    className={
                      "flex min-h-16 flex-col items-center justify-center rounded-lg border p-2 disabled:opacity-40 " +
                      (held ? "border-accent bg-accent text-accent-foreground" : "hover:bg-muted")
                    }
                  >
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-xs">
                      {held ? `Terisi • ${held.items.filter((i) => !i.voided).reduce((s, i) => s + i.qty, 0)} item` : "Kosong"}
                    </span>
                  </button>
                );
              })}
          </div>
          {mode === "merge" && (
            <p className="text-xs text-muted-foreground">
              Meja terisi: pesanannya disatukan ke pesanan ini. Meja kosong: ditambahkan sebagai meja tambahan.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
