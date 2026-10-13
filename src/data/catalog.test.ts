import { describe, expect, it } from "vitest";
import { catalogScenarios } from "./catalog";
import { toScenarioFile } from "../game-core/scenarioFile";
import { scenarios } from "./scenarios";

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
