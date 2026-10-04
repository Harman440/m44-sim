import { describe, expect, it } from "vitest";
import { enemyTargetKinds, onlyTargetKind } from "./hitRules";
import { UnitType } from "../game-core/unit";
import { DieFace } from "../game-core/dice";
import { Scenario } from "../types/scenario";
import GameSession from "../game-core/gameSession";
import CommandCard from "../game-core/commandCard";
import { TurnPhase } from "../types/gameManager";

const scenario = (axis: Scenario["units"]["axis"], extra: Partial<Scenario> = {}): Scenario => ({
  id: "test",
  name: "Test",
  description: "",
  initialHandSize: { allies: 1, axis: 1 },
  attacker: "Allies",
  tiles: {},
  units: { allies: { infantry: [{ row: 7, col: 1 }] }, axis },
  ...extra,
});

const NO_REINFORCEMENTS = {
  [DieFace.INFANTRY]: null,
  [DieFace.TANK]: null,
  [DieFace.GRENADE]: null,
  [DieFace.SUPPLY]: null,
  [DieFace.FLAG]: null,
};

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

  it("counts the enemy's paratroopers, but not the units the map's reinforcements could bring", () => {
    const paratroopers = scenario({ tank: [{ row: 1, col: 1 }] }, { paradrop: { faction: "Axis", unitType: UnitType.INFANTRY, units: 2 } });
    expect(enemyTargetKinds(paratroopers, "Allies")).toEqual({ infantry: true, other: true });

    const reinforced = scenario(
      { infantry: [{ row: 1, col: 1 }] },
      { reinforcements: { ...NO_REINFORCEMENTS, [DieFace.TANK]: UnitType.TANK } }
    );
    expect(enemyTargetKinds(reinforced, "Allies")).toEqual({ infantry: true, other: false });
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
    const card = new CommandCard({ id: "all", orders: 6 });
    const session = new GameSession({
      scenario: scenario({ infantry: [{ row: 1, col: 1 }] }),
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
    });
    expect(session.targetKinds).toEqual({ infantry: true, other: false });

    session.pickCard(card);
    session.issueOrder({ row: 7, col: 1 }, { row: 7, col: 1 });
    session.commitOrders();
    session.startMovement();
    session.startBattle();
    expect(session.getSnapshot().phase).toBe(TurnPhase.BATTLE);

    const answers = { distance: "2", lineOfSight: "yes", targetTerrain: "plains", sandbags: "no" };
    expect(session.fire(0, { ...answers, targetType: "tank" })).toBe(false);
    expect(session.fire(0, { ...answers, targetType: "other" })).toBe(true);
    expect(session.getSnapshot().shots[0]!.target.infantry).toBe(false);
  });
});
