import { createFileRoute } from "@tanstack/react-router";
import { fetchBranding } from "@/lib/pos/branding.server";

export const Route = createFileRoute("/app-icon.png")({
  server: {
    handlers: {
      GET: async () => {
        const b = await fetchBranding();
        const m = b.icon.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return Response.redirect("/icon-512.png", 302);
        return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "public, max-age=300" } });
      },
    },
  },
});
