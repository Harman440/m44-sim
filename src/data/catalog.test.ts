import { describe, expect, it } from "vitest";
import { catalogFile, catalogScenarios, formatJson } from "./catalog";
import { parseScenario, toScenarioFile } from "../game-core/scenarioFile";
import { scenarios } from "./scenarios";
import boardsText from "../../scripts/boards.json?raw";
import arracourtText from "./boards/arracourt.json?raw";

const pegasus = scenarios.find((s) => s.id === "pegasus-bridge")!;
const file = (changes: Record<string, unknown> = {}) => ({ ...JSON.parse(JSON.stringify(toScenarioFile(pegasus))), ...changes });

describe("catalogScenarios", () => {
  it("reads each file with the board art named after its id", () => {
    const [scenario] = catalogScenarios(
      { "./catalog/pegasus-bridge.json": file() },
      { "../assets/scenarios/pegasus-bridge.webp": "/assets/pegasus-bridge-1a2b.webp", "../assets/scenarios/Other.webp": "/other.webp" },
    );

    expect(scenario).toEqual({ ...pegasus, image: "/assets/pegasus-bridge-1a2b.webp" });
  });

  it("leaves a file without art without an image", () => {
    expect(catalogScenarios({ "./catalog/pegasus-bridge.json": file() }, {})[0]!.image).toBeUndefined();
  });

  it("keeps them in the order of their file names", () => {
    const ids = catalogScenarios(
      { "./catalog/omaha.json": file({ id: "omaha" }), "./catalog/arnhem.json": file({ id: "arnhem" }) },
      {},
    ).map((s) => s.id);

    expect(ids).toEqual(["arnhem", "omaha"]);
  });

  it("stops at a broken file, naming it", () => {
    expect(() => catalogScenarios({ "./catalog/broken.json": file({ id: "broken", attacker: "Soviets" }) }, {})).toThrow(
      /\.\/catalog\/broken\.json:\n"attacker" must be "Allies" or "Axis"/,
    );
  });

  it("stops at a file not named after its id", () => {
    expect(() => catalogScenarios({ "./catalog/pegasus.json": file() }, {})).toThrow("the file must be named pegasus-bridge.json");
  });
});

describe("catalogFile", () => {
  // A map exported from Mis mapas
  const exported = () => file({ id: "puente", name: { es: "Puente", en: "Bridge" } });

  it("keeps the map as exported, with the format's schema", () => {
    const kept = catalogFile(exported());

    expect(kept.$schema).toBe("../../game-core/scenarioFile.schema.json");
    expect(parseScenario(kept)).toEqual(parseScenario(exported()));
    expect(kept.tiles).toEqual(pegasus.tiles);
    expect(kept.units).toEqual(pegasus.units);
  });

  it("stops at a map that can't be played, saying why", () => {
    expect(() => catalogFile(file({ id: "puente", units: { allies: {}, axis: pegasus.units.axis } }))).toThrow("The Allies have no units");
    expect(() => catalogFile("not a map")).toThrow();
  });

  it("won't take a built-in's id", () => {
    expect(() => catalogFile(file(), { reserved: ["pegasus-bridge"] })).toThrow(/"pegasus-bridge" is a built-in scenario's id/);
  });

  it("keeps the notes of the file it replaces, unless it has its own", () => {
    const replacing = { ...exported(), notes: "From the official sheet" };

    expect(catalogFile(exported(), { replacing }).notes).toBe("From the official sheet");
    expect(catalogFile({ ...exported(), notes: "Redrawn" }, { replacing }).notes).toBe("Redrawn");
    expect(catalogFile(exported()).notes).toBeUndefined();
  });
});

describe("formatJson", () => {
  it("writes the repo's data files as they are", () => {
    expect(formatJson(JSON.parse(arracourtText))).toBe(arracourtText);
    expect(formatJson(JSON.parse(boardsText), Infinity)).toBe(boardsText);
  });

  it("puts what fits on one line, and opens up the rest", () => {
    const text = formatJson({ name: { es: "Puente", en: "Bridge" }, hexes: [{ row: 0, col: 1 }], long: { text: "x".repeat(100) }, empty: [], gone: undefined });

    expect(text).toBe(
      [
        "{",
        '  "name": { "es": "Puente", "en": "Bridge" },',
        '  "hexes": [',
        '    { "row": 0, "col": 1 }',
        "  ],",
        '  "long": {',
        `    "text": "${"x".repeat(100)}"`,
        "  },",
        '  "empty": []',
        "}",
        "",
      ].join("\n"),
    );
  });
});
