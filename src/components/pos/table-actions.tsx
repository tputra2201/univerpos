import { useState } from "react";
import { ArrowRightLeft, Combine, ListChecks, Split } from "lucide-react";
import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { uid } from "@/lib/pos/format";
import { getServiceTypes } from "@/lib/pos/seed";
import type { CartLine, HeldOrder, PosDatabase } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Nama meja tunggal dari nama gabungan "Meja 1 + Meja 2". */
export function tableParts(name: string | undefined) {
  return (name || "").split(" + ").map((s) => s.trim()).filter(Boolean);
}

/** Tandai item tanpa meja asal dengan meja pertama dari nama meja pesanan. */
export function tagLines(lines: CartLine[], tableName: string): CartLine[] {
  const first = tableParts(tableName)[0];
  return lines.map((l) => (l.tableName || !first ? l : { ...l, tableName: first }));
}

/** Kelompokkan item per meja asal; item tanpa tanda masuk ke meja pertama. */
export function splitLinesByTable(lines: CartLine[], tableName: string) {
  const parts = tableParts(tableName);
  const groups = new Map<string, CartLine[]>(parts.map((p) => [p, []]));
  for (const l of lines) {
    const key = l.tableName && groups.has(l.tableName) ? l.tableName : parts[0]!;
    groups.get(key)!.push({ ...l, tableName: undefined });
  }
  return groups;
}

interface CartLike {
  tableName: string;
  heldId?: string;
  lines: CartLine[];
  customerName: string;
  orderType: string;
  serviceId?: string | undefined;
  orderNo: string;
  note: string;
  sentToKitchen: boolean;
}

function heldFrom(cart: CartLike, items: CartLine[], tableName: string, extra: Partial<HeldOrder> = {}): HeldOrder {
  return {
    id: uid("hold"),
    label: [cart.orderNo, cart.orderType, tableName || cart.customerName].filter(Boolean).join(" • ") || "Pesanan",
    createdAt: new Date().toISOString(),
    items,
    tableName,
    customerName: cart.customerName,
    orderType: cart.orderType,
    serviceId: cart.serviceId,
    orderNo: cart.orderNo,
    note: "",
    sentToKitchen: items.some((i) => i.sentToKitchen),
    ...extra,
  };
}

/** Simpan isi keranjang terbuka ke pesanan tertahan (bila ada). */
function syncHeld(c: PosDatabase, heldId: string | undefined, patch: Partial<HeldOrder>) {
  if (!heldId) return c.heldOrders;
  return c.heldOrders.map((h) => (h.id === heldId ? { ...h, ...patch } : h));
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
      // Pindah seluruh pesanan: tanda meja asal ikut berganti bila hanya satu meja.
      const lines = mine.length > 1 ? cart.lines : cart.lines.map((l) => ({ ...l, tableName: undefined }));
      setCart((p) => ({ ...p, tableName: name, lines }));
      update((c) => ({ ...c, heldOrders: syncHeld(c, cart.heldId, { tableName: name, items: lines }) }));
      toast.success(`Pindah ke ${name}`);
    } else if (mode === "merge") {
      const names = [...mine];
      for (const n of other ? tableParts(other.tableName) : [name]) if (!names.includes(n)) names.push(n);
      const joined = names.join(" + ");
      const lines = [...tagLines(cart.lines, cart.tableName), ...(other ? tagLines(other.items, other.tableName) : [])];
      setCart((p) => ({ ...p, tableName: joined, lines }));
      update((c) => ({
        ...c,
        heldOrders: syncHeld(
          { ...c, heldOrders: c.heldOrders.filter((h) => !other || h.id !== other.id) },
          cart.heldId,
          { tableName: joined, items: lines },
        ),
      }));
      toast.success(other ? `Pesanan ${name} digabung` : `Digabung: ${joined}`);
    }
    setMode(null);
  }

  function splitTables() {
    const groups = splitLinesByTable(cart.lines, cart.tableName);
    const [first, ...rest] = [...groups.entries()];
    if (!first) return;
    const created = rest.filter(([, items]) => items.length > 0).map(([t, items]) => heldFrom(cart, items, t));
    setCart((p) => ({ ...p, tableName: first[0], lines: first[1] }));
    update((c) => ({
      ...c,
      heldOrders: [...created, ...syncHeld(c, cart.heldId, { tableName: first[0], items: first[1] })],
    }));
    toast.success(
      `Meja dipisah. ${created.length} pesanan dikembalikan ke mejanya (lihat Pesanan Tertahan).`,
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
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
      {mine.length > 1 && (
        <Button size="sm" variant="secondary" className="h-8 gap-1" onClick={splitTables}>
          <Split className="size-4" /> Pisah
        </Button>
      )}
      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === "merge" ? "Gabung Meja" : "Pindah Meja"}</DialogTitle>
          </DialogHeader>
          <TableGrid
            exclude={mine}
            heldAt={heldAt}
            blockOccupied={mode === "move"}
            onPick={pick}
          />
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

function TableGrid({
  exclude,
  heldAt,
  blockOccupied,
  onPick,
}: {
  exclude: string[];
  heldAt: (name: string) => HeldOrder | undefined;
  blockOccupied: boolean;
  onPick: (name: string) => void;
}) {
  const { db } = usePos();
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {db.tables
        .filter((t) => !exclude.includes(t.name))
        .map((t) => {
          const held = heldAt(t.name);
          return (
            <button
              key={t.id}
              type="button"
              disabled={blockOccupied && !!held}
              onClick={() => onPick(t.name)}
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
  );
}

/** Pilih item untuk dipindah ke meja lain / Take Out, atau dibayar terpisah. */
export function ItemActions<T extends CartLike>({
  cart,
  setCart,
  onPaySelected,
}: {
  cart: T;
  setCart: React.Dispatch<React.SetStateAction<T>>;
  onPaySelected: (lineIds: string[]) => void;
}) {
  const { db, update } = usePos();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState(false);
  const lines = cart.lines.filter((l) => !l.voided);
  const takeout = getServiceTypes(db).find((s) => s.kind === "takeout" && s.active !== false);
  const heldAt = (name: string) =>
    db.heldOrders.find((h) => h.id !== cart.heldId && tableParts(h.tableName).includes(name));

  function close() {
    setOpen(false);
    setTarget(false);
    setPicked([]);
  }

  function guard() {
    if (picked.length === 0) {
      toast.error("Pilih item terlebih dahulu.");
      return false;
    }
    if (picked.length === lines.length) {
      toast.error("Semua item terpilih. Gunakan Pindah Meja / Bayar biasa.");
      return false;
    }
    return true;
  }

  function moveOut(dest: { table?: string; takeout?: boolean }) {
    const moved = cart.lines.filter((l) => picked.includes(l.lineId)).map((l) => ({ ...l, tableName: undefined }));
    const keep = cart.lines.filter((l) => !picked.includes(l.lineId));
    const existing = dest.table ? heldAt(dest.table) : undefined;
    update((c) => {
      let held = syncHeld(c, cart.heldId, { items: keep });
      if (existing) {
        held = held.map((h) =>
          h.id === existing.id
            ? { ...h, items: [...h.items, ...(tableParts(h.tableName).length > 1 ? moved.map((m) => ({ ...m, tableName: dest.table })) : moved)] }
            : h,
        );
      } else if (dest.takeout) {
        const extra: Partial<HeldOrder> = {
          tableName: "",
          orderType: takeout?.name ?? "Take Out",
          serviceId: takeout?.id,
          orderNo: "",
        };
        held = [heldFrom({ ...cart, ...extra, orderNo: "" } as CartLike, moved, "", extra), ...held];
      } else if (dest.table) {
        held = [heldFrom(cart, moved, dest.table), ...held];
      }
      return { ...c, heldOrders: held };
    });
    setCart((p) => ({ ...p, lines: keep }));
    toast.success(
      `${moved.length} item dipindah ke ${dest.takeout ? "Take Out" : dest.table} (lihat Pesanan Tertahan).`,
    );
    close();
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        disabled={lines.length < 2}
        onClick={() => setOpen(true)}
      >
        <ListChecks className="size-3.5" /> Pilih item
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{target ? "Transfer ke meja" : "Pilih item"}</DialogTitle>
          </DialogHeader>
          {target ? (
            <TableGrid exclude={tableParts(cart.tableName)} heldAt={heldAt} blockOccupied={false} onPick={(t) => moveOut({ table: t })} />
          ) : (
            <ul className="space-y-1">
              {lines.map((l) => (
                <li key={l.lineId}>
                  <label className="flex items-center gap-3 rounded-lg border p-2">
                    <Checkbox
                      checked={picked.includes(l.lineId)}
                      onCheckedChange={(v) =>
                        setPicked((p) => (v ? [...p, l.lineId] : p.filter((x) => x !== l.lineId)))
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {l.qty}× {l.name}
                      {l.variantName ? ` (${l.variantName})` : ""}
                    </span>
                    {l.tableName && <span className="text-xs font-semibold text-primary">{l.tableName}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {target ? (
              <Button variant="secondary" onClick={() => setTarget(false)}>Kembali</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => guard() && setTarget(true)}>Transfer ke meja</Button>
                <Button variant="secondary" onClick={() => guard() && moveOut({ takeout: true })}>Jadikan Take Out</Button>
                <Button
                  onClick={() => {
                    if (!guard()) return;
                    onPaySelected(picked);
                    close();
                  }}
                >
                  Bayar terpisah
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
