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
} from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/", label: "Kasir", icon: ShoppingCart, ownerOnly: false },
  { to: "/produk", label: "Produk", icon: Package, ownerOnly: true },
  { to: "/transaksi", label: "Transaksi", icon: ReceiptText, ownerOnly: false },
  { to: "/laporan", label: "Laporan", icon: BarChart3, ownerOnly: false },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings, ownerOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { db, currentUser, signOut } = usePos();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [online, setOnline] = useState(true);

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

  const items = NAV.filter((n) => !n.ownerOnly || currentUser?.role === "owner");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div>
          <div className="mb-6 px-2">
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
            {online ? "Online — data tetap di perangkat" : "Offline — tetap bisa berjualan"}
          </div>
          <div className="text-sm">
            <p className="font-semibold">{currentUser?.name}</p>
            <p className="text-xs text-sidebar-foreground/60">
              {currentUser?.role === "owner" ? "Pemilik" : "Kasir"}
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
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div>
            <p className="font-bold leading-tight">{db.settings.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Keluar">
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 backdrop-blur md:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
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
