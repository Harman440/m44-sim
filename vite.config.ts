// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Installable app that works offline at the table. "prompt": a new version
    // waits until the player taps "Actualizar", so it never reloads mid-game.
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png", "icons/favicon-32.png"],
      manifest: {
        name: "Memoir '44 Sim",
        short_name: "M'44",
        description: "Compañero para jugar Memoir '44 con turnos simultáneos junto al tablero.",
        lang: "es",
        display: "fullscreen",
        orientation: "any",
        background_color: "#16150f",
        theme_color: "#16150f",
        icons: [
          { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Everything the game needs offline; woff (only a fallback for woff2) is left out
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,ogg}"],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own chunks: they load in parallel, and an app
        // update only replaces the app's own chunks in the tablet's cache
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/(@mui|@emotion|stylis)/.test(id)) return "mui";
          if (/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return "motion";
          if (/node_modules\/(three|@react-three)\//.test(id)) return "three";
        },
      },
    },
  },
  server: {
    port: 3000,
    watch: {
        usePolling: true,
        interval: 300,
    }
  },
});
