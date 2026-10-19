// vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// The folders with no React or DOM: their tests run in plain Node, which starts
// much faster than jsdom
const PURE = "src/{game-core,data,boardArt,i18n,labels}/**/*.test.ts";

// MUI and Emotion bundled once for the UI tests instead of read file by file (import time
// 60 s → 16 s). Every MUI path the app imports must be listed, or that path gets its own copy
// of MUI and its components lose the theme ("Cannot read properties of null (reading 'breakpoints')")
const BUNDLED = [
  "@mui/material",
  "@mui/material/styles",
  "@mui/material/CssBaseline",
  "@mui/material/CircularProgress",
  "@emotion/react",
  "@emotion/styled",
];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // The computer-player games and the App flows take a few seconds each, more with every file running at once
      testTimeout: 20_000,
      projects: [
        { extends: true, test: { name: "core", environment: "node", include: [PURE] } },
        {
          extends: true,
          test: {
            name: "ui",
            environment: "jsdom",
            include: ["src/**/*.test.{ts,tsx}"],
            exclude: [PURE],
            setupFiles: ["./src/test/setup.ts"],
            deps: { optimizer: { client: { enabled: true, include: BUNDLED } } },
          },
        },
      ],
    },
  })
);
