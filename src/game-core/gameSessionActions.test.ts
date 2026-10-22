import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import Hex from "./hex";
import { SavedGame } from "./saveGame";
import { UnitSupplies } from "./unitSupplies";
import { hexDistance } from "./fireTargets";
import { positionKey, samePosition } from "./position";
import { Supply } from "../data/unitSupplies";
import { HexType } from "../types/hex";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

const INF: Position = { row: 7, col: 1 };
const OTHER_INF: Position = { row: 7, col: 3 };
const TANK: Position = { row: 4, col: 6 };
const ARTILLERY: Position = { row: 8, col: 9 };

// The tank is ringed by forest, which stops a move that enters it
const scenario: Scenario = {
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  initialHandSize: { allies: 3, axis: 3 },
  attacker: "Allies",
  tiles: { forest: new Hex(TANK, HexType.PLAINS).getNeighbors() },
  units: {
    allies: { infantry: [INF, OTHER_INF], tank: [TANK], artillery: [ARTILLERY] },
    axis: {},
  },
};

/** Pass and play (figures), giving orders */
const ordering = (options: { figures?: boolean } = {}) => {
  const session = new GameSession({ scenario, faction: "Allies", figures: options.figures ?? true });
  expect(session.pickCard(null)).toBe(true);
  return session;
};

const suppliesAt = (session: GameSession, position: Position): UnitSupplies =>
  session.getSnapshot().supplies.find((each) => samePosition(each.position, position))!.supplies;

const reload = (saved: SavedGame) => GameSession.restore(JSON.parse(JSON.stringify(saved)), scenario);

/** The session saved and restored with the unit at `position` holding these amounts */
function withAmounts(session: GameSession, position: Position, amounts: Partial<Record<Supply, number>>): GameSession {
  const saved = session.save();
  const unit = saved.units.findIndex((each) => each.position && samePosition(each.position, position));
  const full = suppliesAt(session, position);
  saved.supplies = [
    ...saved.supplies.filter((each) => each.unit !== unit),
    { unit, amounts: { ...full.amounts, ...amounts }, equipment: { ...full.equipment } },
  ];
  return reload(saved);
}

const actionIds = (session: GameSession, position: Position) => session.getActions(position)!.map(({ action }) => action.id);
const refusals = (session: GameSession, position: Position) =>
  Object.fromEntries(session.getActions(position)!.map(({ action, refusal }) => [action.id, refusal]));
const farthest = (moves: readonly Position[], from: Position) => Math.max(...moves.map((move) => hexDistance(move, from)));

describe("GameSession giving actions", () => {
  it("lists a unit's actions, only while giving orders", () => {
    const session = new GameSession({ scenario, faction: "Allies", figures: true });
    expect(session.getActions(INF)).toBeNull();
    session.pickCard(null);

    expect(actionIds(session, TANK)).toEqual(["tank:firefight", "tank:assault", "tank:armorForward", "tank:mechanic", "tank:reload"]);
    expect(actionIds(session, INF)).toContain("infantry:moraleUp");
    // An unhurt unit has nothing for Medic to mend
    expect(refusals(session, INF)).toMatchObject({ "infantry:medic": "nothingToMend", "infantry:firefight": null });
    expect(Object.values(refusals(session, INF)).filter((refusal) => refusal !== null)).toHaveLength(1);
    expect(session.getActions({ row: 0, col: 0 })).toBeNull();
  });

  it("doesn't offer Morale Up on own tablets", () => {
    expect(actionIds(ordering({ figures: false }), INF)).not.toContain("infantry:moraleUp");
    expect(ordering({ figures: false }).giveAction(INF, "infantry:moraleUp", INF)).toBe(false);
  });

  it("gives an action, keeping its id on the order, and refuses another unit's or an unknown one", () => {
    const session = ordering();

    expect(session.giveAction(INF, "tank:firefight", INF)).toBe(false);
    expect(session.giveAction(INF, "infantry:nope", INF)).toBe(false);
    expect(session.giveAction(INF, "infantry:firefight", INF)).toBe(true);

    const [order] = session.getSnapshot().orders;
    expect(order!.action).toBe("infantry:firefight");
    expect(order!.shots).toBe(1);
  });

  it("offers the moves of each action, and refuses a hex beyond them", () => {
    const session = ordering();
    const moves = (id: string, from = INF) => session.getMoveOptions(from, id)!;

    expect(moves("infantry:firefight").moves.every((move) => samePosition(move, INF))).toBe(true);
    expect(farthest(moves("infantry:assault").moves, INF)).toBe(1);
    expect(farthest(moves("infantry:moveOut").moves, INF)).toBe(2);
    expect(moves("infantry:moveOut").moveAndFire).toEqual([]);
    expect(farthest(moves("infantry:motorized").moves, INF)).toBe(3);
    expect(farthest(moves("artillery:reposition", ARTILLERY).moves, ARTILLERY)).toBe(2);

    const two = moves("infantry:moveOut").moves.find((move) => hexDistance(move, INF) === 2)!;
    expect(session.giveAction(INF, "infantry:assault", two)).toBe(false);
    expect(session.giveAction(INF, "infantry:moveOut", two)).toBe(true);
    expect(session.getSnapshot().orders[0]).toMatchObject({ action: "infantry:moveOut", shots: 0 });
  });

  it("fires after an Assault, but not after Move Out or Reposition", () => {
    const session = ordering();
    const one = session.getMoveOptions(INF, "infantry:assault")!.moveAndFire.find((move) => hexDistance(move, INF) === 1)!;
    const away = session.getMoveOptions(ARTILLERY, "artillery:reposition")!.moves.find((move) => hexDistance(move, ARTILLERY) === 2)!;

    expect(session.giveAction(INF, "infantry:assault", one)).toBe(true);
    expect(session.giveAction(ARTILLERY, "artillery:reposition", away)).toBe(true);
    expect(session.getSnapshot().orders.map((order) => order.shots)).toEqual([1, 0]);
  });

  it("moves Armour Forward through terrain that stops an Assault", () => {
    const session = ordering();

    expect(farthest(session.getMoveOptions(TANK, "tank:assault")!.moves, TANK)).toBe(1);
    expect(farthest(session.getMoveOptions(TANK, "tank:armorForward")!.moves, TANK)).toBe(3);
    const far = session.getMoveOptions(TANK, "tank:armorForward")!.moves.find((move) => hexDistance(move, TANK) === 3)!;
    expect(session.giveAction(TANK, "tank:assault", far)).toBe(false);
    expect(session.giveAction(TANK, "tank:armorForward", far)).toBe(true);
  });

  it("turns a plain move into the action for it: Firefight to hold, Assault to fire after moving, Move Out or Motorized further", () => {
    const session = ordering();
    const options = session.getMoveOptions(INF)!;
    const at = (distance: number) => options.moves.find((move) => hexDistance(move, INF) === distance)!;

    expect(options.limits).toEqual({ maxMove: 3, moveAndFire: 1, holdShots: 1 });
    expect(session.issueOrder(INF, at(3))).toBe(true);
    expect(session.issueOrder(OTHER_INF, OTHER_INF)).toBe(true);
    expect(session.issueOrder(TANK, TANK)).toBe(true);
    expect(session.getSnapshot().orders.map((order) => order.action)).toEqual(["infantry:motorized", "infantry:firefight", "tank:firefight"]);
  });
});

describe("GameSession changing an action", () => {
  it("replaces a hold with another action, in its place", () => {
    const session = ordering();
    session.giveAction(INF, "infantry:firefight", INF);
    session.giveAction(TANK, "tank:firefight", TANK);

    expect(session.getSnapshot().orderable.map(positionKey)).not.toContain(positionKey(INF));
    expect(session.giveAction(INF, "infantry:fortify", INF)).toBe(true);
    expect(session.getSnapshot().orders.map((order) => order.action)).toEqual(["infantry:fortify", "tank:firefight"]);
  });

  it("lets a hold that isn't the last order change only to another hold", () => {
    const session = ordering();
    session.giveAction(INF, "infantry:firefight", INF);
    session.giveAction(TANK, "tank:firefight", TANK);
    const next = new Hex(INF, HexType.PLAINS).getNeighbors().find((p) => session.board.getHex(p) && !session.board.getHex(p)!.unit)!;

    expect(session.getMoveOptions(INF, "infantry:assault")!.limits.maxMove).toBe(0);
    expect(session.giveAction(INF, "infantry:assault", next)).toBe(false);
    expect(session.giveAction(INF, "infantry:closeAssault", INF)).toBe(true);
  });

  it("lets the last order's hold become a move", () => {
    const session = ordering();
    session.giveAction(INF, "infantry:firefight", INF);
    const far = session.getMoveOptions(INF, "infantry:moveOut")!.moves.find((move) => hexDistance(move, INF) === 2)!;

    expect(session.giveAction(INF, "infantry:moveOut", far)).toBe(true);
    expect(session.getSnapshot().orders).toHaveLength(1);
    expect(session.board.getHex(far)!.unit).toBeTruthy();
    expect(session.undoLastOrder()).toBe(true);
    expect(session.board.getHex(INF)!.unit).toBeTruthy();
  });

  it("doesn't change an order that moved: it's undone first", () => {
    const session = ordering();
    const far = session.getMoveOptions(INF, "infantry:moveOut")!.moves.find((move) => hexDistance(move, INF) === 2)!;
    session.giveAction(INF, "infantry:moveOut", far);

    expect(session.getActions(far)).toBeNull();
    expect(session.giveAction(far, "infantry:firefight", far)).toBe(false);
  });
});

describe("GameSession unit supplies", () => {
  it("starts every unit full, and pays the actions' costs when the orders are confirmed", () => {
    const session = ordering();
    const far = session.getMoveOptions(INF, "infantry:motorized")!.moves.find((move) => hexDistance(move, INF) === 3)!;
    session.giveAction(INF, "infantry:motorized", far);
    const tankTo = session.getMoveOptions(TANK, "tank:armorForward")!.moves.find((move) => hexDistance(move, TANK) === 2)!;
    session.giveAction(TANK, "tank:armorForward", tankTo);
    session.giveAction(ARTILLERY, "artillery:fortify", ARTILLERY);

    expect(suppliesAt(session, far).amounts[Supply.ENERGY]).toBe(5);
    expect(session.commitOrders()).toBe(true);
    expect(suppliesAt(session, far).amounts[Supply.ENERGY]).toBe(3);
    expect(suppliesAt(session, tankTo).amounts[Supply.FUEL]).toBe(3);
    expect(suppliesAt(session, ARTILLERY).amounts[Supply.FUEL]).toBe(0);
    expect(suppliesAt(session, OTHER_INF).amounts[Supply.ENERGY]).toBe(5);
  });

  it("gives infantry 1 energy back at the end of the turn, or 2 when it rested, never past full", () => {
    let session = withAmounts(ordering(), INF, { [Supply.ENERGY]: 1 });
    session = withAmounts(session, OTHER_INF, { [Supply.ENERGY]: 1 });
    session.giveAction(INF, "infantry:firefight", INF);
    session.giveAction(TANK, "tank:firefight", TANK);
    session.commitOrders();
    session.startBattle();
    session.endBattle();
    expect(session.endTurn()).toBe(true);

    expect(suppliesAt(session, INF).amounts[Supply.ENERGY]).toBe(1);
    expect(suppliesAt(session, OTHER_INF).amounts[Supply.ENERGY]).toBe(3);
    expect(suppliesAt(session, TANK).amounts).toEqual({ [Supply.FUEL]: 5, [Supply.SHELLS]: 2 });
  });

  it("refuses an action the unit can't pay for, and a unit with nothing it can pay for rests", () => {
    const session = withAmounts(ordering(), INF, { [Supply.ENERGY]: 0 });

    expect(refusals(session, INF)["infantry:firefight"]).toBe(Supply.ENERGY);
    expect(refusals(session, INF)["infantry:reload"]).toBeNull();
    expect(session.issueOrder(INF, INF)).toBe(false);
    expect(session.giveAction(INF, "infantry:reload", INF)).toBe(true);

    const shaken = withAmounts(ordering(), INF, { [Supply.MORALE]: 0, [Supply.ENERGY]: 0 });
    expect(shaken.getSnapshot().orderable.map(positionKey)).not.toContain(positionKey(INF));
    expect(shaken.getActions(INF)!.every(({ refusal }) => refusal !== null)).toBe(true);
  });

  it("at morale 0 offers only Morale Up", () => {
    const session = withAmounts(ordering(), INF, { [Supply.MORALE]: 0 });
    const allowed = session.getActions(INF)!.filter(({ refusal }) => refusal === null).map(({ action }) => action.id);

    expect(allowed).toEqual(["infantry:moraleUp"]);
    expect(session.getMoveOptions(INF)).toBeNull();
  });

  it("keeps the supplies and each order's action in a save", () => {
    const session = ordering();
    session.giveAction(INF, "infantry:fortify", INF);
    session.commitOrders();

    const restored = reload(session.save());
    expect(restored.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
    expect(restored.getSnapshot().orders[0]!.action).toBe("infantry:fortify");
    expect(suppliesAt(restored, INF)).toEqual(suppliesAt(session, INF));
    expect(suppliesAt(restored, INF).amounts[Supply.ENERGY]).toBe(3);
  });

  it("drops a save with an unknown action", () => {
    const session = ordering();
    session.giveAction(INF, "infantry:firefight", INF);
    const saved = session.save();
    saved.orders[0]!.action = "infantry:nope";

    expect(() => reload(saved)).toThrow("Unknown action");
  });
});
