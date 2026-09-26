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
        name: "Memoir '44 · Turnos simultáneos",
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
  server: {
    port: 3000,
    watch: {
        usePolling: true,
        interval: 300,
    }
  },
});
