import { useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRINTER_ROLE_LABEL, printerFor, sendToPrinter } from "@/lib/pos/printers";
import { usePos } from "@/lib/pos/store";
import type { PrinterRole } from "@/lib/pos/types";

export function PrintPreview({
  open,
  onOpenChange,
  title,
  lines,
  role = "report",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  lines: string[];
  role?: PrinterRole;
}) {
  const { db } = usePos();
  const [sending, setSending] = useState(false);
  const cfg = printerFor(db, role);

  async function send(mode: "dialog" | "bluetooth") {
    setSending(true);
    try {
      await sendToPrinter({ ...cfg, mode }, lines);
      if (mode === "bluetooth") toast.success(`Terkirim ke ${cfg.deviceName || cfg.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencetak.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Printer: {cfg.name} · {PRINTER_ROLE_LABEL[role].split(" (")[0]} ·{" "}
            {cfg.paperWidth === 32 ? "58mm" : "80mm"} ·{" "}
            {cfg.mode === "bluetooth" ? "Bluetooth" : "Dialog cetak"}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[45vh] overflow-auto rounded-lg border bg-muted/40 p-3">
          <pre className="font-mono text-[11px] leading-snug whitespace-pre-wrap">
            {lines.join("\n")}
          </pre>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="secondary"
            className="gap-2"
            disabled={sending}
            onClick={() => send(cfg.mode === "bluetooth" ? "dialog" : "bluetooth")}
          >
            {cfg.mode === "bluetooth" ? "Dialog cetak" : "Via Bluetooth"}
          </Button>
          <Button className="gap-2" disabled={sending} onClick={() => send(cfg.mode)}>
            <Printer className="size-4" /> {sending ? "Mengirim…" : `Cetak ke ${cfg.name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
