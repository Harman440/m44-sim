// data/scenarioRules.ts
// What a scenario gives each side, read from its file: its units, its big guns and its air.
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";

/** The side starts the scenario with units of this type (paratroopers included) */
export const hasUnits = (scenario: Scenario, faction: Faction, type: UnitType): boolean =>
  (scenario.units[faction === "Axis" ? "axis" : "allies"][type]?.length ?? 0) > 0 ||
  (scenario.paradrop?.faction === faction && scenario.paradrop.unitType === type);

/** Whether a side has big guns (Cortina de Fuego): both do unless the scenario lists the sides that have them */
export const hasBigGuns = (scenario: Scenario, faction: Faction): boolean => scenario.bigGuns?.includes(faction) ?? true;

/** Air sorties a side has in the scenario: 1 when the scenario doesn't say, 0 for none (no air cards) */
export const airSortiesOf = (scenario: Scenario, faction: Faction): number =>
  scenario.airPower?.[faction === "Axis" ? "axis" : "allies"] ?? 1;
