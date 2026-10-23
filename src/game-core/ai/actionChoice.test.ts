import { describe, expect, it } from "vitest";
import GameSession from "../gameSession";
import { AiView, SeenEnemy } from "./aiStep";
import { chooseAction, chooseCard, chooseMark } from "./actionChoice";
import { samePosition } from "../position";
import { UnitType } from "../unit";
import { Supply } from "../../data/unitSupplies";
import { actionCardById } from "../../data/actionCards";
import { Position, Scenario } from "../../types/scenario";
import { same } from "../../i18n/lang";

const INF: Position = { row: 7, col: 8 };
const ARTILLERY: Position = { row: 7, col: 4 };
const ENEMY: Position = { row: 3, col: 4 };

// The computer plays the Allies, the attacker (full shells): artillery in range of the enemy infantry, infantry out of it
const scenario: Scenario = {
  id: "test",
  name: same("Test"),
  description: same(""),
  attacker: "Allies",
  tiles: {},
  units: {
    allies: { infantry: [INF], artillery: [ARTILLERY] },
    axis: { infantry: [ENEMY] },
  },
};

const enemy: SeenEnemy = { position: ENEMY, unitType: UnitType.INFANTRY, figures: 1 };

/** The Allies giving orders, the unit at `position` holding these amounts */
function ordering(position: Position | null = null, amounts: Partial<Record<Supply, number>> = {}): GameSession {
  const session = new GameSession({ scenario, faction: "Allies", figures: true });
  if (position) {
    const saved = session.save();
    const unit = saved.units.findIndex((each) => each.position && samePosition(each.position, position));
    saved.supplies = saved.supplies.map((each) => (each.unit === unit ? { ...each, amounts: { ...each.amounts, ...amounts } } : each));
    const restored = GameSession.restore(JSON.parse(JSON.stringify(saved)), scenario);
    expect(restored.pickCard(null)).toBe(true);
    return restored;
  }
  expect(session.pickCard(null)).toBe(true);
  return session;
}

const viewOf = (session: GameSession, enemies: readonly SeenEnemy[] = [enemy]): AiView => ({ side: "Allies", session, enemies, random: () => 0 });

describe("the computer's actions", () => {
  it("rallies infantry at morale 0", () => {
    const session = ordering(INF, { [Supply.MORALE]: 0 });
    expect(chooseAction(viewOf(session), INF, INF)).toEqual({ action: "infantry:moraleUp", to: INF });
  });

  it("rests tired infantry with nothing to fire at", () => {
    const session = ordering(INF, { [Supply.ENERGY]: 1 });
    expect(chooseAction(viewOf(session), INF, INF)).toBe("rest");
    expect(chooseAction(viewOf(ordering()), INF, INF)).toBeNull();
  });

  it("bombards with artillery for a good shot, and fires plainly for a poor one", () => {
    const session = ordering();
    expect(chooseAction(viewOf(session), ARTILLERY, ARTILLERY)).toEqual({ action: "artillery:bombardment", to: ARTILLERY });
    expect(chooseAction(viewOf(session, []), ARTILLERY, ARTILLERY)).toBeNull();
  });
});

describe("the computer's cards", () => {
  it("plays no card it can't pay for", () => {
    const session = new GameSession({ scenario, faction: "Allies", figures: true });
    expect(chooseCard(viewOf(session))).toBeNull();
  });

  it("marks an attack on the enemy, and a reinforcement's cross away from it", () => {
    const session = ordering();
    const away = { row: 8, col: 0 };
    const next = { row: 4, col: 4 };
    const barrage = actionCardById("barrage")!;
    const reinforcements = actionCardById("reinforcements")!;
    expect(chooseMark(viewOf(session), [next, ENEMY], { card: barrage, rule: barrage.marker!, marked: 0 })).toEqual(ENEMY);
    expect(chooseMark(viewOf(session), [next, away], { card: reinforcements, rule: reinforcements.marker!, marked: 0 })).toEqual(away);
  });
});
