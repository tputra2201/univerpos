import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const credSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(80),
});

/** Membuat akun developer pertama. Hanya berhasil bila belum ada developer sama sekali. */
export const bootstrapDeveloper = createServerFn({ method: "POST" })
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "developer");
    if ((count ?? 0) > 0) throw new Error("Developer sudah terdaftar. Silakan masuk.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Gagal membuat akun");
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: "developer",
      display_name: data.name,
      email: data.email,
    });
    if (roleErr) throw new Error(roleErr.message);
    return { ok: true };
  });

async function assertDeveloper(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("has_role", { _user_id: userId, _role: "developer" });
  if (!ok) throw new Error("Hanya developer yang boleh melakukan ini.");
}

export const listInstallers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("id, user_id, role, display_name, email, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    credSchema.extend({ role: z.enum(["installer", "developer"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Gagal membuat akun");
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: data.role,
      display_name: data.name,
      email: data.email,
    });
    if (roleErr) throw new Error(roleErr.message);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDeveloper(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Tidak bisa menghapus akun sendiri.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Memperbarui nama dan email akun (developer/installer). */
export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error) throw new Error(error.message);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .update({ display_name: data.name, email: data.email })
      .eq("user_id", data.userId);
    if (roleErr) throw new Error(roleErr.message);
    return { ok: true };
  });

export const resetAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
