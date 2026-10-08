import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";

describe("normalizeSettings", () => {
  it("keeps valid settings", () => {
    expect(normalizeSettings({ look: "box", sound: true, language: "en" })).toEqual({ look: "box", sound: true, language: "en" });
  });

  it("starts in the browser's language: Spanish for any Spanish, English otherwise", () => {
    const language = (browser: string) => {
      vi.spyOn(navigator, "language", "get").mockReturnValue(browser);
      return normalizeSettings(undefined).language;
    };
    expect(language("es-AR")).toBe("es");
    expect(language("en-GB")).toBe("en");
    expect(language("fr-FR")).toBe("en");
    vi.restoreAllMocks();
    expect(normalizeSettings({ language: "de" }).language).toBe("es");
  });

  it("falls back to the defaults for anything missing or unknown", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ look: "neon", sound: "yes" })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ look: "field" })).toEqual({ ...DEFAULT_SETTINGS, look: "field" });
  });
});
