/**
 * Dua jalur cetak dari satu sumber teks struk:
 * 1. Dialog cetak perangkat (selalu tersedia, termasuk iPhone).
 * 2. Kirim langsung ke printer thermal Bluetooth ESC/POS (Web Bluetooth).
 */

const SPP_SERVICE = "00001101-0000-1000-8000-00805f9b34fb";

type BluetoothLike = {
  requestDevice: (options: unknown) => Promise<any>;
  getAvailability?: () => Promise<boolean>;
};

function bt(): BluetoothLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { bluetooth?: BluetoothLike };
  return nav.bluetooth ?? null;
}

export function bluetoothSupported(): boolean {
  return bt() !== null;
}

function encodeCp437(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    bytes.push(code < 128 ? code : 63); // karakter di luar ASCII -> '?'
  }
  return bytes;
}

export function escposBytes(lines: string[], autoCut = true): Uint8Array {
  const out: number[] = [];
  out.push(0x1b, 0x40); // ESC @ init
  out.push(0x1b, 0x74, 0x00); // pilih code page CP437
  for (const line of lines) {
    out.push(...encodeCp437(line), 0x0a);
  }
  out.push(0x0a, 0x0a);
  if (autoCut) out.push(0x1d, 0x56, 0x42, 0x00); // GS V B 0 (auto-cutter)
  return new Uint8Array(out);
}

let cachedDevice: any = null;

export async function pickBluetoothPrinter(): Promise<string> {
  const bluetooth = bt();
  if (!bluetooth) throw new Error("Perangkat/browser ini tidak mendukung Bluetooth langsung.");
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SPP_SERVICE, 0x18f0, "000018f0-0000-1000-8000-00805f9b34fb"],
  });
  cachedDevice = device;
  return device.name ?? "Printer Bluetooth";
}

async function writableCharacteristic(device: any) {
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const c of chars) {
      if (c.properties?.write || c.properties?.writeWithoutResponse) return c;
    }
  }
  throw new Error("Printer tidak menyediakan jalur tulis data.");
}

export async function printViaBluetooth(lines: string[]): Promise<void> {
  const bluetooth = bt();
  if (!bluetooth) throw new Error("Perangkat/browser ini tidak mendukung Bluetooth langsung.");
  if (!cachedDevice) await pickBluetoothPrinter();
  const characteristic = await writableCharacteristic(cachedDevice);
  const data = escposBytes(lines);
  const chunkSize = 180;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }
}

export function printViaDialog(lines: string[], paperWidth: 32 | 48): void {
  if (typeof window === "undefined") return;
  const mm = paperWidth === 32 ? 58 : 80;
  const fontSize = paperWidth === 32 ? 11 : 12;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  const escaped = lines
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("\n");
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Struk</title><style>
      @page { size: ${mm}mm auto; margin: 2mm; }
      body { margin: 0; }
      pre { font-family: "Courier New", ui-monospace, monospace; font-size: ${fontSize}px; line-height: 1.35; white-space: pre-wrap; margin: 0; }
    </style></head><body><pre>${escaped}</pre></body></html>`,
  );
  doc.close();
  const win = frame.contentWindow;
  setTimeout(() => {
    win?.focus();
    win?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 120);
}
