import { useEffect, useMemo, useState } from "react";
import type { Modifier, Product } from "@/lib/pos/types";
import { rupiah } from "@/lib/pos/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Group {
  key: string;
  title: string;
  required: boolean;
  multiple: boolean;
  options: { id: string; name: string; price: number }[];
}

export function productHasOptions(p: Product, modifiers: Modifier[]) {
  return (
    p.variants.length > 0 ||
    (p.sizes?.length ?? 0) > 0 ||
    (p.toppings?.length ?? 0) > 0 ||
    (p.modifierIds ?? []).some((id) => modifiers.some((m) => m.id === id && m.options.length))
  );
}

export function OptionPicker({
  product,
  modifiers,
  onClose,
  onAdd,
}: {
  product: Product | null;
  modifiers: Modifier[];
  onClose: () => void;
  onAdd: (label: string, extra: number) => void;
}) {
  const groups = useMemo<Group[]>(() => {
    if (!product) return [];
    const g: Group[] = [];
    const mapV = (v: { id: string; name: string; priceDelta: number }) => ({
      id: v.id,
      name: v.name,
      price: v.priceDelta,
    });
    if (product.variants.length)
      g.push({ key: "var", title: "Varian", required: true, multiple: false, options: product.variants.map(mapV) });
    if (product.sizes?.length)
      g.push({ key: "size", title: "Ukuran", required: true, multiple: false, options: product.sizes.map(mapV) });
    if (product.toppings?.length)
      g.push({ key: "top", title: "Topping", required: false, multiple: true, options: product.toppings.map(mapV) });
    for (const id of product.modifierIds ?? []) {
      const m = modifiers.find((x) => x.id === id);
      if (m && m.options.length)
        g.push({ key: m.id, title: m.name, required: m.required, multiple: m.multiple, options: m.options });
    }
    return g;
  }, [product, modifiers]);

  const [sel, setSel] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups) init[g.key] = g.required && !g.multiple && g.options[0] ? [g.options[0].id] : [];
    setSel(init);
  }, [groups]);

  if (!product) return null;

  function toggle(g: Group, id: string) {
    setSel((prev) => {
      const cur = prev[g.key] ?? [];
      if (g.multiple) return { ...prev, [g.key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
      if (cur[0] === id && !g.required) return { ...prev, [g.key]: [] };
      return { ...prev, [g.key]: [id] };
    });
  }

  const chosen = groups.flatMap((g) => g.options.filter((o) => (sel[g.key] ?? []).includes(o.id)));
  const extra = chosen.reduce((s, o) => s + o.price, 0);
  const missing = groups.some((g) => g.required && !(sel[g.key] ?? []).length);
  const label = chosen.map((o) => o.name).join(", ");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Pilih opsi pesanan.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 space-y-4 overflow-auto px-1">
          {groups.map((g) => (
            <div key={g.key} className="space-y-2">
              <p className="text-sm font-semibold">
                {g.title}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {g.required ? "Wajib" : "Opsional"} · {g.multiple ? "boleh beberapa" : "pilih satu"}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {g.options.map((o) => {
                  const on = (sel[g.key] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g, o.id)}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                        on ? "border-primary bg-primary/10 font-semibold" : "bg-card",
                      )}
                    >
                      <span className="min-w-0 break-words">{o.name}</span>
                      {o.price > 0 && <span className="tabular text-xs">+{rupiah(o.price)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button className="h-12 w-full justify-between" disabled={missing} onClick={() => onAdd(label, extra)}>
            <span>Tambah</span>
            <span className="tabular">{rupiah(product.price + extra)}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
