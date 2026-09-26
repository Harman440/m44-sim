// Adds DOM matchers (toBeInTheDocument, etc.) to Vitest's expect
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when Vitest globals are enabled
afterEach(() => {
  cleanup();
});
