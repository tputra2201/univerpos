import { useState } from "react";
import { Bluetooth, Printer } from "lucide-react";
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
import { bluetoothSupported, printViaBluetooth, printViaDialog } from "@/lib/pos/print";
import { usePos } from "@/lib/pos/store";

export function PrintPreview({
  open,
  onOpenChange,
  title,
  lines,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  lines: string[];
}) {
  const { db } = usePos();
  const [sending, setSending] = useState(false);

  async function sendBluetooth() {
    setSending(true);
    try {
      await printViaBluetooth(lines);
      toast.success("Data cetak terkirim ke printer.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim ke printer Bluetooth.");
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
            Lebar kertas {db.printer.paperWidth === 32 ? "58mm" : "80mm"}. Pilih cetak biasa atau
            kirim langsung ke printer Bluetooth.
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
            disabled={!bluetoothSupported() || sending}
            onClick={sendBluetooth}
          >
            <Bluetooth className="size-4" />
            {bluetoothSupported() ? "Printer Bluetooth" : "Bluetooth tak didukung"}
          </Button>
          <Button
            className="gap-2"
            onClick={() => printViaDialog(lines, db.printer.paperWidth)}
          >
            <Printer className="size-4" /> Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
