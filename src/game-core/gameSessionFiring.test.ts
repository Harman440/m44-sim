import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import Hex from "./hex";
import { SavedGame } from "./saveGame";
import { UnitSupplies } from "./unitSupplies";
import { hexDistance } from "./fireTargets";
import { turnedRound } from "./BoardManager";
import { STANDARD_BOARD } from "./boardSize";
import { samePosition } from "./position";
import { Equipment, Supply } from "../data/unitSupplies";
import { TARGET_INFANTRY } from "../data/fireQuestions";
import { FireAnswers } from "./fireRules";
import { HexType } from "../types/hex";
import { TurnPhase } from "../types/gameManager";
import { Faction } from "../types/faction";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

const INF: Position = { row: 7, col: 1 };
const TANK: Position = { row: 4, col: 6 };
const ARTILLERY: Position = { row: 8, col: 9 };
/** Forest next to the tank, and the open ground past it */
const FOREST: Position = new Hex(TANK, HexType.PLAINS).getNeighbors()[0]!;

const scenario: Scenario = {
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  initialHandSize: { allies: 3, axis: 3 },
  attacker: "Allies",
  tiles: { forest: [FOREST] },
  units: {
    allies: { infantry: [INF], tank: [TANK], artillery: [ARTILLERY] },
    axis: { infantry: [INF], tank: [TANK], artillery: [ARTILLERY] },
  },
};

/** Own tablets by default; `faction` Axis is the defender, a shot short */
const ordering = ({ faction = "Allies", figures = false, longRangeDie = false }: { faction?: Faction; figures?: boolean; longRangeDie?: boolean } = {}) => {
  const session = new GameSession({ scenario, faction, figures, longRangeDie, random: () => 0.5 });
  expect(session.pickCard(null)).toBe(true);
  return session;
};

const fight = (session: GameSession) => {
  expect(session.commitOrders()).toBe(true);
  expect(session.startBattle()).toBe(true);
  return session;
};

/** The unit at `position` given this action on the spot, then the battle */
const holding = (actionId: string, position: Position, options?: Parameters<typeof ordering>[0]) => {
  const session = ordering(options);
  expect(session.giveAction(position, actionId, position)).toBe(true);
  return fight(session);
};

const suppliesAt = (session: GameSession, position: Position): UnitSupplies =>
  session.getSnapshot().supplies.find((each) => samePosition(each.position, position))!.supplies;

const ammo = (session: GameSession, position: Position, supply = Supply.AMMO) => suppliesAt(session, position).amounts[supply];

/** An infantry target in the open, adjacent or 2 hexes away */
const at = (distance: 1 | 2): FireAnswers => ({
  distance: String(distance),
  ...(distance > 1 && { lineOfSight: "yes" }),
  targetType: TARGET_INFANTRY,
  targetTerrain: "plains",
  sandbags: "no",
  camouflage: "no",
  pinned: "no",
});

const restore = (saved: SavedGame) => GameSession.restore(JSON.parse(JSON.stringify(saved)), scenario);

/** The session saved and restored with the unit at `position` holding these amounts */
function withAmounts(session: GameSession, position: Position, amounts: Partial<Record<Supply, number>>): GameSession {
  const saved = session.save();
  const unit = saved.units.findIndex((each) => each.position && samePosition(each.position, position));
  const full = suppliesAt(session, position);
  saved.supplies = [
    ...saved.supplies.filter((each) => each.unit !== unit),
    { unit, amounts: { ...full.amounts, ...amounts }, equipment: { ...full.equipment } },
  ];
  return restore(saved);
}

const lastShot = (session: GameSession) => session.getSnapshot().shots.at(-1)!;
const stepKinds = (session: GameSession) => lastShot(session).steps.map((step) => step.kind);

describe("GameSession firing with ammo and shells", () => {
  it("spends 1 ammo on each shot, and gives it back when the shot is taken back", () => {
    const session = holding("infantry:firefight", INF);
    expect(ammo(session, INF)).toBe(2);

    expect(session.fire(0, at(2))).toBe(true);
    expect(ammo(session, INF)).toBe(1);
    expect(lastShot(session)).toMatchObject({ option: "infantry:normal", spent: { amounts: { [Supply.AMMO]: 1 } } });

    expect(session.undoShot(0)).toBe(true);
    expect(ammo(session, INF)).toBe(2);
  });

  it("fires Artillery Bombardment twice, a shell each, the second only with a shell left", () => {
    const attacker = holding("artillery:bombardment", ARTILLERY);
    expect(attacker.fire(0, at(2))).toBe(true);
    expect(attacker.fire(0, at(2))).toBe(true);
    expect(ammo(attacker, ARTILLERY, Supply.SHELLS)).toBe(0);

    // The defender's artillery starts a shell short: one shot, then it can't fire
    const defender = holding("artillery:bombardment", turnedRound(ARTILLERY, STANDARD_BOARD), { faction: "Axis" });
    expect(defender.fire(0, at(2))).toBe(true);
    expect(defender.shotsLeft(0)).toBe(0);
    expect(defender.fire(0, at(2))).toBe(false);
    expect(defender.fireOptions(0)).toEqual([]);
  });

  it("lists the unit's fire options, greying one it can't pay for", () => {
    const session = holding("infantry:firefight", INF);
    expect(session.fireOptions(0).map(({ option, refusal }) => [option.id, refusal])).toEqual([
      ["infantry:normal", null],
      ["infantry:explosives", null],
      ["infantry:suppressive", null],
    ]);
  });

  it("refuses an unknown fire option, or another unit type's", () => {
    const session = holding("infantry:firefight", INF);
    expect(session.fire(0, at(2), "tank:normal")).toBe(false);
    expect(session.fire(0, at(2), "infantry:nope")).toBe(false);
    expect(session.getSnapshot().shots).toEqual([]);
  });

  it("fires Explosives only in close assault, with 1 die more, using up the explosives", () => {
    const session = holding("infantry:firefight", INF);
    expect(session.fire(0, at(2), "infantry:explosives")).toBe(false);
    expect(session.fireTargetsFor(0, "infantry:explosives").every((target) => target.distance === 1)).toBe(true);

    expect(session.fire(0, at(1), "infantry:explosives")).toBe(true);
    // Infantry's close assault 3, +1 for the explosives
    expect(lastShot(session).dice).toBe(4);
    expect(stepKinds(session)).toContain("fireOption");
    expect(suppliesAt(session, INF).equipment[Equipment.EXPLOSIVES]).toBe(0);
    expect(ammo(session, INF)).toBe(1);

    // Taken back, the explosives come back too
    expect(session.undoShot(0)).toBe(true);
    expect(suppliesAt(session, INF).equipment[Equipment.EXPLOSIVES]).toBe(1);
  });

  it("rolls the suppressive die with Suppressive Fire, the 8-sided one at range with the long-range die", () => {
    const session = holding("infantry:firefight", INF);
    expect(session.fire(0, at(1), "infantry:suppressive")).toBe(true);
    expect(lastShot(session).target.die).toBe("suppressive");
    // The step says so, though it adds no dice
    expect(lastShot(session).steps.find((step) => step.kind === "fireOption")).toMatchObject({ dice: 0, die: "suppressive" });

    const longRange = holding("infantry:firefight", INF, { longRangeDie: true });
    expect(longRange.fire(0, at(2), "infantry:suppressive")).toBe(true);
    expect(lastShot(longRange).target.die).toBe("longRangeSuppressive");
  });

  it("gives armour's normal fire 1 die more in close assault only when it didn't move", () => {
    const held = holding("tank:firefight", TANK);
    expect(held.fire(0, at(1))).toBe(true);
    expect(lastShot(held).dice).toBe(4);
    expect(held.getSnapshot().shots[0]!.steps.map((step) => step.kind)).toEqual(["base", "fireOption"]);

    const moved = ordering();
    const to = new Hex(TANK, HexType.PLAINS).getNeighbors().find((p) => !samePosition(p, FOREST))!;
    expect(moved.giveAction(TANK, "tank:assault", to)).toBe(true);
    fight(moved);
    expect(moved.fire(0, at(1))).toBe(true);
    expect(lastShot(moved).dice).toBe(3);
  });

  it("fires Close Assault only at an adjacent enemy, with 1 die more", () => {
    const session = holding("infantry:closeAssault", INF);
    expect(session.orderSummaries()[0]!.closeAssaultOnly).toBe(true);
    expect(session.fire(0, at(2))).toBe(false);
    expect(session.fire(0, at(1))).toBe(true);
    expect(lastShot(session).dice).toBe(4);
    expect(stepKinds(session)).toEqual(["base", "action"]);
  });

  it("keeps each shot's fire option and what it spent in a save", () => {
    const session = holding("infantry:firefight", INF);
    expect(session.fire(0, at(1), "infantry:explosives")).toBe(true);

    const restored = restore(session.save());
    expect(lastShot(restored)).toMatchObject({ option: "infantry:explosives" });
    expect(restored.undoShot(0)).toBe(true);
    expect(suppliesAt(restored, INF).equipment[Equipment.EXPLOSIVES]).toBe(1);

    const saved = session.save();
    saved.shots[0] = { ...saved.shots[0]!, option: "infantry:nope" };
    expect(() => restore(saved)).toThrow("Unknown fire option");
  });

  it("reloads when the orders are confirmed: the ammo is back for the next turn", () => {
    const session = withAmounts(ordering(), INF, { [Supply.AMMO]: 0 });
    expect(session.giveAction(INF, "infantry:firefight", INF)).toBe(false);
    expect(session.giveAction(INF, "infantry:reload", INF)).toBe(true);
    fight(session);
    expect(ammo(session, INF)).toBe(2);
    expect(session.orderSummaries()[0]!.shotsLeft).toBe(0);
  });
});

describe("GameSession firing order of the actions", () => {
  it("fires No Respite with the units that didn't move, though it moved", () => {
    const session = ordering();
    const to = { row: 6, col: 1 };
    expect(hexDistance(to, INF)).toBe(1);
    expect(session.giveAction(INF, "infantry:noRespite", to)).toBe(true);
    expect(session.giveAction(ARTILLERY, "artillery:firefight", ARTILLERY)).toBe(true);
    fight(session);

    const [noRespite] = session.orderSummaries();
    expect(noRespite).toMatchObject({ hold: false, unmovedGroup: true, firesFirst: false, waiting: false });
  });

  it("fires Behind Enemy Lines before anyone, without waiting for the units that didn't move", () => {
    const session = ordering();
    const to = { row: 5, col: 1 };
    expect(session.giveAction(INF, "infantry:behindEnemyLines", to)).toBe(true);
    expect(session.giveAction(ARTILLERY, "artillery:firefight", ARTILLERY)).toBe(true);
    fight(session);

    const [infiltrators, artillery] = session.orderSummaries();
    expect(infiltrators).toMatchObject({ firesFirst: true, unmovedGroup: false, waiting: false, shotsLeft: 1 });
    expect(artillery).toMatchObject({ unmovedGroup: true, waiting: false });
    expect(session.fire(0, at(2))).toBe(true);
  });

  it("doesn't fire Armour Forward from a hex its terrain doesn't let it fire from", () => {
    const into = ordering();
    expect(into.giveAction(TANK, "tank:armorForward", FOREST)).toBe(true);
    expect(into.getSnapshot().orders[0]!.shots).toBe(0);

    // Through the forest and out the other side, it fires
    const past = new Hex(FOREST, HexType.PLAINS)
      .getNeighbors()
      .find((p) => hexDistance(p, TANK) === 2 && !samePosition(p, FOREST))!;
    const through = ordering();
    expect(through.getMoveOptions(TANK, "tank:armorForward")!.moveAndFire).toContainEqual(past);
    expect(through.giveAction(TANK, "tank:armorForward", past)).toBe(true);
    expect(through.getSnapshot().orders[0]!.shots).toBe(1);
  });

  it("doesn't fire with an action that has no fire", () => {
    const session = holding("infantry:fortify", INF);
    expect(session.orderSummaries()[0]).toMatchObject({ canFire: false, shotsLeft: 0 });
    expect(session.fire(0, at(2))).toBe(false);
  });
});

describe("GameSession collisions with supplies", () => {
  /** Pass and play: the infantry has an order (Move Out), the tank none; the movement phase */
  const moving = (session = ordering({ figures: true })) => {
    expect(session.giveAction(INF, "infantry:assault", { row: 6, col: 1 })).toBe(true);
    expect(session.commitOrders()).toBe(true);
    expect(session.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
    return session;
  };

  it("spends 1 ammo or shell on a collision roll", () => {
    const session = moving();
    expect(session.rollCollision({ row: 6, col: 1 }, true, 0)).toBe(true);
    expect(ammo(session, { row: 6, col: 1 })).toBe(1);

    expect(session.rollCollision(TANK, true, null)).toBe(true);
    expect(ammo(session, TANK, Supply.SHELLS)).toBe(1);
    expect(session.getSnapshot().standingCollisions[0]!.spent).toEqual({ amounts: { [Supply.SHELLS]: 1 } });
  });

  it("doesn't roll a collision with no ammo or shells left, nor at morale 0", () => {
    const empty = withAmounts(moving(), TANK, { [Supply.SHELLS]: 0 });
    expect(empty.canRollCollision(TANK, null)).toBe(false);
    expect(empty.rollCollision(TANK, true, null)).toBe(false);

    const shaken = withAmounts(moving(), { row: 6, col: 1 }, { [Supply.MORALE]: 0 });
    expect(shaken.canRollCollision({ row: 6, col: 1 }, 0)).toBe(false);
    expect(shaken.rollCollision({ row: 6, col: 1 }, true, 0)).toBe(false);
  });

  it("on own tablets, doesn't roll a collision with no ammo left", () => {
    const session = ordering();
    expect(session.giveAction(INF, "infantry:assault", { row: 6, col: 1 })).toBe(true);
    const empty = withAmounts(fight(session), { row: 6, col: 1 }, { [Supply.AMMO]: 0 });
    expect(empty.fireCollision(0, true)).toBe(false);
  });
});

describe("GameSession luck", () => {
  /** Own tablets, every die drawn at `draw` */
  const firing = (draw: number, actionId = "infantry:firefight") => {
    const session = new GameSession({ scenario, faction: "Allies", random: () => draw });
    expect(session.pickCard(null)).toBe(true);
    expect(session.giveAction(INF, actionId, INF)).toBe(true);
    return fight(session);
  };

  it("moves the unit's luck as its dice miss or hit, and keeps it in a save", () => {
    // The start of the flag side: two misses at infantry, each +0.5
    const session = firing(5 / 6);
    expect(session.luckAt(INF)).toBe(0);
    expect(session.fire(0, at(2))).toBe(true);
    expect(lastShot(session).faces).toEqual(["flag", "flag"]);
    expect(session.luckAt(INF)).toBeCloseTo(1);
    expect(restore(session.save()).luckAt(INF)).toBeCloseTo(1);
  });

  it("puts the luck back when the shot is taken back", () => {
    const session = firing(5 / 6);
    expect(session.fire(0, at(2))).toBe(true);
    expect(session.undoShot(0)).toBe(true);
    expect(session.luckAt(INF)).toBe(0);
  });

  it("turns a die at the top of a miss into a hit once the unit's luck is up", () => {
    // The first die misses (luck +0.5), and the second, drawn as high, is turned
    const session = firing(0.999);
    expect(session.fire(0, at(2))).toBe(true);
    const [first, second] = lastShot(session).faces;
    expect(first).toBe("flag");
    expect(["infantry", "grenade"]).toContain(second);
  });

  it("moves with a collision roll too", () => {
    const session = new GameSession({ scenario, faction: "Allies", figures: true, random: () => 5 / 6 });
    expect(session.pickCard(null)).toBe(true);
    expect(session.giveAction(INF, "infantry:assault", { row: 6, col: 1 })).toBe(true);
    expect(session.commitOrders()).toBe(true);
    expect(session.rollCollision({ row: 6, col: 1 }, true, 0)).toBe(true);
    expect(session.luckAt({ row: 6, col: 1 })).toBeGreaterThan(0);
  });

  it("drops a save with luck past its limits", () => {
    const saved = firing(5 / 6).save();
    saved.luck = [{ unit: 0, luck: 4 }];
    expect(() => restore(saved)).toThrow("Unknown unit luck");
  });
});
