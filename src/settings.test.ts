import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";

describe("normalizeSettings", () => {
  it("keeps valid settings", () => {
    expect(normalizeSettings({ look: "box", sound: true })).toEqual({ look: "box", sound: true });
  });

  it("falls back to the defaults for anything missing or unknown", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ look: "neon", sound: "yes" })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ look: "field" })).toEqual({ ...DEFAULT_SETTINGS, look: "field" });
  });
});
