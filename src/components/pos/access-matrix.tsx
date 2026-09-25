import { toast } from "sonner";
import { usePos } from "@/lib/pos/store";
import { ROLE_LABEL } from "@/lib/pos/roles";
import {
  ALL_PERMS,
  DEFAULT_PERMS,
  LIMITED_ROLES,
  PERM_GROUPS,
  permsFor,
  type LimitedRole,
  type PermKey,
} from "@/lib/pos/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export function AccessMatrix() {
  const { db, update } = usePos();

  function setRole(role: LimitedRole, perms: PermKey[]) {
    update((d) => ({
      ...d,
      settings: { ...d.settings, rolePermissions: { ...d.settings.rolePermissions, [role]: perms } },
    }));
  }

  function toggle(role: LimitedRole, key: PermKey, on: boolean) {
    const cur = permsFor(db.settings, role);
    setRole(role, on ? [...new Set([...cur, key])] : cur.filter((k) => k !== key));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hak Akses per Level</CardTitle>
        <CardDescription>
          Pemilik selalu punya akses penuh. Centang izin untuk setiap level lainnya; perubahan langsung tersimpan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {LIMITED_ROLES.map((role) => {
          const perms = permsFor(db.settings, role);
          return (
            <div key={role} className="rounded-lg border p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{ROLE_LABEL[role]}</p>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setRole(role, [...ALL_PERMS])}>Pilih semua</Button>
                  <Button size="sm" variant="outline" onClick={() => setRole(role, [])}>Kosongkan</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRole(role, [...DEFAULT_PERMS[role]]);
                      toast.success(`Hak akses ${ROLE_LABEL[role]} dikembalikan ke standar.`);
                    }}
                  >
                    Reset standar
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {PERM_GROUPS.map((g) => (
                  <div key={g.title} className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">{g.title}</p>
                    {g.items.map((it) => (
                      <label key={it.key} className="flex cursor-pointer items-start gap-2 text-sm">
                        <Checkbox
                          checked={perms.includes(it.key)}
                          onCheckedChange={(v) => toggle(role, it.key, v === true)}
                          className="mt-0.5"
                        />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
