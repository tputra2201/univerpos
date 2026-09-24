import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  storeCode: z.string().min(1).max(40),
  activationKey: z.string().min(1).max(40),
  email: z.string().trim().email().max(255),
  userName: z.string().max(80),
  pin: z.string().regex(/^\d{4,6}$/),
  temporary: z.boolean(),
});

/** Kirim PIN ke email pengguna di latar belakang. Hanya perangkat dengan kode + kunci store yang valid. */
export const sendPinEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error } = await sb.rpc("store_devices_list", { _code: data.storeCode, _key: data.activationKey });
    if (error) return { ok: false as const, error: "Store tidak valid" };
    const { data: st } = await sb.rpc("check_store", { _code: data.storeCode });
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const r = await sendTemplateEmail("pin-code", data.email, {
        templateData: { storeName: data.storeCode, userName: data.userName, pin: data.pin, temporary: data.temporary },
        idempotencyKey: `pin-${data.storeCode}-${data.email}-${data.pin}`,
      });
      void st;
      if (!r.sent) return { ok: false as const, error: "Email ini tidak bisa menerima pesan (diblokir)." };
      return { ok: true as const };
    } catch (e) {
      console.error("sendPinEmail failed", e);
      return { ok: false as const, error: "Gagal mengirim email" };
    }
  });
