import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Planifica Maestro",
        short_name: "PlanificaMaestro",
        description: "Planificacion docente con IA: dictado, foto y texto, para todos los niveles educativos.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#eef5f6",
        theme_color: "#12304a",
        orientation: "portrait",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/plan\/cuota/,
            handler: "NetworkFirst",
            options: {
              cacheName: "pm-cuotas-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
              },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^\/api\/.*/,
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
