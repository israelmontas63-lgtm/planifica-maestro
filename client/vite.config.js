import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      docx: path.resolve(__dirname, "../server/node_modules/docx"),
    },
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
        lang: "es",
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
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
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
