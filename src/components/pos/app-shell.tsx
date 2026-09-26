import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ShoppingCart,
  Package,
  ReceiptText,
  BarChart3,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  Clock,
  Wallet,
  Users,

} from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { BrandIcon, useBranding } from "@/lib/pos/branding";
import { useSyncStatus } from "@/lib/pos/sync";
import { roleLabel } from "@/lib/pos/roles";
import { hasPerm, type PermKey } from "@/lib/pos/permissions";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { KeyRound, UserPen } from "lucide-react";
import { EditUserForm } from "@/components/pos/edit-user";
import { ChangePinForm } from "@/components/pos/change-pin";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NAV: { to: string; label: string; icon: typeof ShoppingCart; perm: PermKey }[] = [
  { to: "/", label: "Kasir", icon: ShoppingCart, perm: "pos.access" },
  { to: "/shift", label: "Shift", icon: Clock, perm: "shift.manage" },
  { to: "/keuangan", label: "Finance", icon: Wallet, perm: "finance.manage" },
  { to: "/produk", label: "Produk", icon: Package, perm: "product.manage" },
  { to: "/member", label: "Member", icon: Users, perm: "member.manage" },
  { to: "/transaksi", label: "Transaksi", icon: ReceiptText, perm: "transaction.view" },

  { to: "/laporan", label: "Laporan", icon: BarChart3, perm: "report.view" },
  { to: "/pengaturan", label: "Setup", icon: Settings, perm: "settings.manage" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { db, currentUser, signOut } = usePos();
  const brand = useBranding();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [online, setOnline] = useState(true);
  const sync = useSyncStatus();
  const central = db.settings.storeMode === "online";
  const syncLabel =
    sync.state === "syncing"
      ? "Menyinkronkan…"
      : sync.state === "error"
        ? "Sinkron gagal"
        : sync.pending > 0
          ? `${sync.pending} perubahan menunggu internet`
          : sync.lastSync
            ? "Tersinkron"
            : "Menunggu sinkron";

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const items = NAV.filter((n) => hasPerm(db.settings, currentUser?.role, n.perm));
  const here = NAV.find((n) => n.to === pathname);
  const blocked = !!here && !hasPerm(db.settings, currentUser?.role, here.perm);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div>
          <div className="mb-6 px-2">
            <div className="mb-3 flex items-center gap-2">
              <BrandIcon className="size-8 rounded-lg object-cover" />
              <span className="truncate text-sm font-bold">{brand.name}</span>
            </div>
            <p className="text-lg font-extrabold leading-tight">{db.settings.name}</p>
            <p className="text-xs uppercase tracking-wide text-sidebar-foreground/60">
              {db.settings.businessType === "kuliner"
                ? "Kuliner"
                : db.settings.businessType === "retail"
                  ? "Retail"
                  : "Jasa"}
            </p>
          </div>
          <nav className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="space-y-3 px-2">
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {central
              ? online ? "Online — data terpusat" : "Offline — tetap bisa berjualan"
              : online ? "Online — data tetap di perangkat" : "Offline — tetap bisa berjualan"}
          </div>
          {central && <p className="text-xs text-sidebar-foreground/60">{syncLabel}</p>}
          <div className="text-sm">
            <p className="font-semibold">{currentUser?.name}</p>
            <p className="text-xs text-sidebar-foreground/60">
              {currentUser ? roleLabel(currentUser.role) : "Kasir"}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={signOut}
          >
            <LogOut className="size-4" /> Keluar
          </Button>
          <ChangePinButton full />
          <EditProfileButton full />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
          <BrandIcon className="size-8 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{db.settings.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`inline-block size-2 rounded-full ${online ? "bg-primary" : "bg-destructive"}`}
                aria-hidden
              />
              {online ? "Online" : "Offline"}
              {central ? ` · ${syncLabel}` : ""} · {currentUser?.name}
            </p>
          </div>
          </div>
          <div className="flex items-center">
          <EditProfileButton />
          <ChangePinButton />
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Keluar">
            <LogOut className="size-4" />
          </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          {blocked ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Anda tidak punya akses ke halaman ini. Hubungi pemilik store untuk mengatur hak akses.
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 backdrop-blur md:hidden">
        {items.filter((n) => n.to !== "/produk").map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || (item.to === "/pengaturan" && pathname === "/produk");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-card px-4 py-4 md:px-6">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function ChangePinButton({ full }: { full?: boolean }) {
  const { currentUser, update, signIn } = usePos();
  const [open, setOpen] = useState(false);
  if (!currentUser) return null;
  return (
    <>
      {full ? (
        <Button variant="ghost" size="sm" className="mt-1 w-full justify-start gap-2" onClick={() => setOpen(true)}>
          <KeyRound className="size-4" /> Ganti PIN
        </Button>
      ) : (
        <Button variant="ghost" size="icon" aria-label="Ganti PIN" onClick={() => setOpen(true)}>
          <KeyRound className="size-4" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti PIN</DialogTitle>
          </DialogHeader>
          <ChangePinForm
            oldPin={currentUser.pin}
            onCancel={() => setOpen(false)}
            onSave={(pin) => {
              const next = { ...currentUser, pin, mustChangePin: false };
              update((cur) => ({ ...cur, users: cur.users.map((u) => (u.id === next.id ? next : u)) }));
              signIn(next);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditProfileButton({ full }: { full?: boolean }) {
  const { currentUser, update, signIn } = usePos();
  const [open, setOpen] = useState(false);
  if (!currentUser) return null;
  return (
    <>
      {full ? (
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setOpen(true)}>
          <UserPen className="size-4" /> Profil Saya
        </Button>
      ) : (
        <Button variant="ghost" size="icon" aria-label="Profil Saya" onClick={() => setOpen(true)}>
          <UserPen className="size-4" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profil Saya</DialogTitle>
          </DialogHeader>
          <EditUserForm
            self
            user={currentUser}
            onCancel={() => setOpen(false)}
            onSave={(next) => {
              update((cur) => ({ ...cur, users: cur.users.map((u) => (u.id === next.id ? next : u)) }));
              signIn(next);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
