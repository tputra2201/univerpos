import { createFileRoute } from "@tanstack/react-router";
import { fetchBranding } from "@/lib/pos/branding.server";

export const Route = createFileRoute("/app-icon.png")({
  server: {
    handlers: {
      GET: async () => {
        const b = await fetchBranding();
        const m = b.icon.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return new Response(null, { status: 302, headers: { location: "/icon-512.png" } });
        return new Response(new Uint8Array(Buffer.from(m[2] ?? "", "base64")), { headers: { "content-type": m[1] ?? "image/png", "cache-control": "public, max-age=300" } });
      },
    },
  },
});
