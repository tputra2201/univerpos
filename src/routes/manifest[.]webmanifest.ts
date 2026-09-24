import { createFileRoute } from "@tanstack/react-router";
import { fetchBranding } from "@/lib/pos/branding.server";

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        const b = await fetchBranding();
        const v = b.icon ? `?v=${b.icon.length}` : "";
        const icons = b.icon
          ? [
              { src: `/app-icon.png${v}`, sizes: "192x192", type: "image/png" },
              { src: `/app-icon.png${v}`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
            ]
          : [
              { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
              { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
            ];
        return new Response(
          JSON.stringify({ name: b.name, short_name: b.name.slice(0, 12), start_url: "/", scope: "/", display: "standalone", background_color: "#ffffff", theme_color: "#04585a", icons }),
          { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" } },
        );
      },
    },
  },
});
