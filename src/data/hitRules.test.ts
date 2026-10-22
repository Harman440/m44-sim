import { describe, expect, it } from "vitest";
import { enemyTargetKinds, onlyTargetKind } from "./hitRules";
import { UnitType } from "../game-core/unit";
import { Scenario } from "../types/scenario";
import GameSession from "../game-core/gameSession";
import { TurnPhase } from "../types/gameManager";
import { same } from "../i18n/lang";

const scenario = (axis: Scenario["units"]["axis"], extra: Partial<Scenario> = {}): Scenario => ({
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  attacker: "Allies",
  tiles: {},
  units: { allies: { infantry: [{ row: 7, col: 1 }] }, axis },
  ...extra,
});

describe("enemyTargetKinds", () => {
  it("reads the enemy's starting units", () => {
    expect(enemyTargetKinds(scenario({ infantry: [{ row: 1, col: 1 }] }), "Allies")).toEqual({ infantry: true, other: false });
    expect(enemyTargetKinds(scenario({ tank: [{ row: 1, col: 1 }] }), "Allies")).toEqual({ infantry: false, other: true });
    expect(enemyTargetKinds(scenario({ artillery: [{ row: 1, col: 1 }] }), "Allies")).toEqual({ infantry: false, other: true });
    expect(
      enemyTargetKinds(scenario({ infantry: [{ row: 1, col: 1 }], artillery: [{ row: 1, col: 2 }] }), "Allies")
    ).toEqual({ infantry: true, other: true });
  });

  it("reads the other side for the Axis", () => {
    expect(enemyTargetKinds(scenario({ tank: [{ row: 1, col: 1 }] }), "Axis")).toEqual({ infantry: true, other: false });
  });

  it("counts the enemy's paratroopers", () => {
    const paratroopers = scenario({ tank: [{ row: 1, col: 1 }] }, { paradrop: { faction: "Axis", unitType: UnitType.INFANTRY, units: 2 } });
    expect(enemyTargetKinds(paratroopers, "Allies")).toEqual({ infantry: true, other: true });
  });

  it("offers both when the enemy has no units at all", () => {
    expect(enemyTargetKinds(scenario({}), "Allies")).toEqual({ infantry: true, other: true });
  });
});

describe("onlyTargetKind", () => {
  it("gives the only kind, or null when both are possible", () => {
    expect(onlyTargetKind({ infantry: true, other: false })).toBe(true);
    expect(onlyTargetKind({ infantry: false, other: true })).toBe(false);
    expect(onlyTargetKind({ infantry: true, other: true })).toBeNull();
  });
});

describe("GameSession target kinds", () => {
  it("knows what the enemy started with, but fires at either kind (reinforcements can bring a new one)", () => {
    const session = new GameSession({
      scenario: scenario({ infantry: [{ row: 1, col: 1 }] }),
      faction: "Allies",
    });
    expect(session.targetKinds).toEqual({ infantry: true, other: false });

    session.pickCard(null);
    session.issueOrder({ row: 7, col: 1 }, { row: 7, col: 1 });
    session.commitOrders();
    session.startBattle();
    expect(session.getSnapshot().phase).toBe(TurnPhase.BATTLE);

    const answers = { distance: "2", lineOfSight: "yes", targetTerrain: "plains", sandbags: "no", camouflage: "no" };
    expect(session.fire(0, { ...answers, targetType: "tank" })).toBe(false);
    expect(session.fire(0, { ...answers, targetType: "other" })).toBe(true);
    expect(session.getSnapshot().shots[0]!.target.infantry).toBe(false);
  });
});
