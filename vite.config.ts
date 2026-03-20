import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "placeholder.svg", "sw-push-handler.js", "icons/*.png"],
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}", "icons/ddg_icon_48.png", "icons/ddg_icon_72.png", "icons/ddg_icon_96.png", "icons/ddg_icon_144.png", "icons/ddg_icon_192.png", "icons/ddg_icon_512.png"],
        navigateFallbackDenylist: [/^\/~oauth/],
        additionalManifestEntries: [
          { url: "/sw-push-handler.js", revision: null },
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Due Date Guardian",
        short_name: "DDG",
        description: "Track credit card due dates, bill payments, and get escalating alerts. By Legacy Growth Solutions.",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/icons/ddg_icon_48.png",  sizes: "48x48",   type: "image/png" },
          { src: "/icons/ddg_icon_72.png",  sizes: "72x72",   type: "image/png" },
          { src: "/icons/ddg_icon_96.png",  sizes: "96x96",   type: "image/png" },
          { src: "/icons/ddg_icon_144.png", sizes: "144x144", type: "image/png" },
          { src: "/icons/ddg_icon_192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/ddg_icon_512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/ddg_icon_512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
