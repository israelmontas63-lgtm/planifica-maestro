import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import { execSync } from "node:child_process";

let commitHash = "cf";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {}

const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const buildVersion = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${commitHash}`;

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  resolve: {
    alias: {},
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-docx": ["docx"],
        },
      },
    },
  },
  plugins: [
    react(),
    process.env.ANALYZE === "true" &&
      visualizer({
        filename: "dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Planifica Maestro",
        short_name: "PlanificaMaestro",
        description: "Planificación docente con IA: dictado, foto y texto, alineada al currículo oficial MINERD y programa CON BASE.",
        lang: "es-DO",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#eef5f6",
        theme_color: "#12304a",
        orientation: "portrait",
        categories: ["education", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Nueva Planificación",
            short_name: "Planificar",
            description: "Crear una nueva planificación curricular",
            url: "/",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Consultar Currículo",
            short_name: "Currículo",
            description: "Consultar diseño curricular MINERD y CON BASE",
            url: "/?accion=curriculo",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Mis Planificaciones",
            short_name: "Guardadas",
            description: "Ver historial de planificaciones guardadas",
            url: "/?accion=historial",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          }
        ],
      },
      workbox: {
        cacheId: "planifica-maestro-v3",
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache-v3",
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkOnly",
            method: "GET",
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkOnly",
            method: "POST",
          },
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources-v3",
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets-v3",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ].filter(Boolean),
  server: {
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  preview: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
