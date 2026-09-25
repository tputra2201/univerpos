/** Pengaturan → Finance: kategori dan item per jenis transaksi. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { uid } from "@/lib/pos/format";
import { FINANCE_KINDS, financeCategoriesOf } from "@/lib/pos/finance";
import type { FinanceCategory, FinanceKind } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FinanceSettings() {
  const { db, update } = usePos();
  const cats = financeCategoriesOf(db);

  function save(fn: (list: FinanceCategory[]) => FinanceCategory[]) {
    update((cur) => ({ ...cur, financeCategories: fn(financeCategoriesOf(cur)) }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {FINANCE_KINDS.map((k) => (
        <KindCard
          key={k.kind}
          kind={k.kind}
          title={k.label}
          hint={k.hint}
          cats={cats.filter((c) => c.kind === k.kind)}
          save={save}
        />
      ))}
    </div>
  );
}

function KindCard({
  kind,
  title,
  hint,
  cats,
  save,
}: {
  kind: FinanceKind;
  title: string;
  hint: string;
  cats: FinanceCategory[];
  save: (fn: (l: FinanceCategory[]) => FinanceCategory[]) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {cats.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kategori.</p>}
        {cats.map((c) => (
          <CategoryBlock key={c.id} cat={c} save={save} />
        ))}
        <div className="flex gap-2">
          <Input
            value={name}
            placeholder="Kategori baru"
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            className="gap-1"
            onClick={() => {
              if (!name.trim()) return;
              save((l) => [...l, { id: uid("fc"), kind, name: name.trim(), items: [] }]);
              setName("");
            }}
          >
            <Plus className="size-4" /> Kategori
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryBlock({
  cat,
  save,
}: {
  cat: FinanceCategory;
  save: (fn: (l: FinanceCategory[]) => FinanceCategory[]) => void;
}) {
  const [item, setItem] = useState("");
  const patch = (fn: (c: FinanceCategory) => FinanceCategory) =>
    save((l) => l.map((c) => (c.id === cat.id ? fn(c) : c)));
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex gap-2">
        <Input
          value={cat.name}
          className="font-semibold"
          onChange={(e) => patch((c) => ({ ...c, name: e.target.value }))}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label="Hapus kategori"
          onClick={() => {
            if (window.confirm(`Hapus kategori ${cat.name}?`))
              save((l) => l.filter((c) => c.id !== cat.id));
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cat.items.map((it) => (
          <span
            key={it.id}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
          >
            {it.name}
            <button
              aria-label={`Hapus ${it.name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => patch((c) => ({ ...c, items: c.items.filter((x) => x.id !== it.id) }))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={item}
          placeholder="Item baru"
          className="h-9"
          onChange={(e) => setItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && item.trim()) {
              patch((c) => ({ ...c, items: [...c.items, { id: uid("fi"), name: item.trim() }] }));
              setItem("");
            }
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (!item.trim()) return;
            patch((c) => ({ ...c, items: [...c.items, { id: uid("fi"), name: item.trim() }] }));
            setItem("");
          }}
        >
          Tambah
        </Button>
      </div>
    </div>
  );
}
