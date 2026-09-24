import { sendPinEmail } from "@/lib/pin-email.functions";
export function randomPin(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0]! % 1000000).padStart(6, "0");
}

export function normalizeWa(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "62");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function pinMessage(storeName: string, userName: string, pin: string, temporary: boolean): string {
  return `Halo ${userName}, PIN ${temporary ? "sementara" : "default"} Anda untuk kasir ${storeName} adalah: ${pin}\n\nGunakan PIN ini untuk masuk, lalu Anda akan diminta membuat PIN baru. Jangan berikan PIN ini kepada siapa pun.`;
}

/** Buka WhatsApp / email untuk mengirim PIN ke pengguna. */
export function sendPin(opts: { email?: string | undefined; whatsapp?: string | undefined; subject: string; message: string }) {
  if (opts.whatsapp) {
    window.open(`https://wa.me/${normalizeWa(opts.whatsapp)}?text=${encodeURIComponent(opts.message)}`, "_blank");
  } else if (opts.email) {
    window.location.href = `mailto:${opts.email}?subject=${encodeURIComponent(opts.subject)}&body=${encodeURIComponent(opts.message)}`;
  }
}

/** Kirim PIN: email dikirim otomatis di latar belakang, WhatsApp lewat tautan. */
export async function deliverPin(opts: {
  email?: string | undefined; whatsapp?: string | undefined; subject: string; message: string;
  storeCode?: string | undefined; activationKey?: string | undefined; storeName: string; userName: string; pin: string; temporary: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (opts.whatsapp || !opts.email) { sendPin(opts); return { ok: true }; }
  if (!opts.storeCode || !opts.activationKey) return { ok: false, error: "Store belum diaktifkan dengan kunci aktivasi." };
  try {
    return await sendPinEmail({ data: { storeCode: opts.storeCode, activationKey: opts.activationKey, email: opts.email, userName: opts.userName, storeName: opts.storeName, pin: opts.pin, temporary: opts.temporary } });
  } catch {
    return { ok: false, error: "Tidak ada koneksi internet." };
  }
}
