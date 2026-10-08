// Adds DOM matchers (toBeInTheDocument, etc.) to Vitest's expect
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when Vitest globals are enabled
afterEach(() => {
  cleanup();
});

// Tests read the Spanish UI unless they pick English: settings default to the browser's language
Object.defineProperty(window.navigator, "language", { value: "es-ES", configurable: true });
