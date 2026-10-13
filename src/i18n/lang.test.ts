import { describe, expect, it } from "vitest";
import { textIn } from "./lang";

describe("textIn", () => {
  it("gives the text in the language asked for", () => {
    expect(textIn({ es: "Puente", en: "Bridge" }, "en")).toBe("Bridge");
  });

  it("falls back to another language when that one is empty", () => {
    expect(textIn({ es: "Mi mapa", en: "" }, "en")).toBe("Mi mapa");
    expect(textIn({ es: "", en: "" }, "es")).toBe("");
  });
});
