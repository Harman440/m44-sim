import { afterEach, describe, expect, it, vi } from "vitest";
import { isBrowserTooOld } from "./browserSupport";

describe("isBrowserTooOld", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("takes a browser with today's JavaScript and CSS as new enough", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    expect(isBrowserTooOld()).toBe(false);
  });

  it("finds a browser without color-mix() or container sizes too old (Safari before 16.2)", () => {
    vi.stubGlobal("CSS", { supports: (property: string) => property !== "color" });
    expect(isBrowserTooOld()).toBe(true);
    vi.stubGlobal("CSS", { supports: (property: string) => property !== "container-type" });
    expect(isBrowserTooOld()).toBe(true);
  });

  it("finds a browser without Array.at too old (Safari before 15.4)", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const at = Array.prototype.at;
    try {
      // @ts-expect-error: taken away, as in an old Safari
      delete Array.prototype.at;
      expect(isBrowserTooOld()).toBe(true);
    } finally {
      Array.prototype.at = at;
    }
  });
});
