import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BOX = 256;
const OUT = 512;

export function IconCropper({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => { setImg(i); setZoom(1); setPos({ x: 0, y: 0 }); };
    i.src = src;
  }, [src]);

  const base = img ? Math.max(BOX / img.width, BOX / img.height) : 1;
  const w = img ? img.width * base * zoom : 0;
  const h = img ? img.height * base * zoom : 0;
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(p.x, (BOX - w) / 2), (w - BOX) / 2),
    y: Math.min(Math.max(p.y, (BOX - h) / 2), (h - BOX) / 2),
  });
  const cur = clamp(pos);

  function apply() {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = c.height = OUT;
    const k = OUT / BOX;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, ((BOX - w) / 2 + cur.x) * k, ((BOX - h) / 2 + cur.y) * k, w * k, h * k);
    onDone(c.toDataURL("image/png"));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Atur Ikon</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Geser gambar untuk mengatur posisi, gunakan slider untuk zoom.</p>
        <div
          className="relative mx-auto touch-none overflow-hidden rounded-2xl border bg-muted"
          style={{ width: BOX, height: BOX, cursor: "grab" }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: cur.x, py: cur.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPos({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }); }}
          onPointerUp={() => { drag.current = null; setPos(cur); }}
        >
          {img && (
            <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none"
              style={{ width: w, height: h, left: (BOX - w) / 2 + cur.x, top: (BOX - h) / 2 + cur.y }} />
          )}
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <Slider min={1} max={4} step={0.01} value={[zoom]} onValueChange={(v) => setZoom(v[0] ?? 1)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Batal</Button>
          <Button onClick={apply} disabled={!img}>Pakai</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
