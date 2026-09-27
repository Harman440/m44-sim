import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import CommandCard, { CommandCardProps, Section } from "./commandCard";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import {
  EXTRA_SLOT,
  boostedLimits,
  OrderContext,
  canBuyExtraOrder,
  cardOrdersLeft,
  extraOrderablePositions,
  fallbackCard,
  moveLimits,
  orderSlots,
  orderablePositions,
  ordersLeft,
  sectionsOf,
  slotCost,
} from "./orderRules";
import { positionKey as key } from "./position";
import { Side } from "../types/hex";
import { Position, Scenario } from "../types/scenario";

const makeScenario = (units: Scenario["units"]["allies"]): Scenario => ({
  id: "test",
  name: "Test",
  description: "",
  initialHandSize: { allies: 3, axis: 3 },
  attacker: "Allies",
  tiles: {},
  units: { allies: units, axis: {} },
});

// One unit per section: (7,1) left, (7,3) left-center, (8,4) center tank,
// (8,6) center, (7,8) right-center, (8,11) right
const scenario = makeScenario({
  infantry: [
    { row: 7, col: 1 }, { row: 7, col: 3 }, { row: 8, col: 6 },
    { row: 7, col: 8 }, { row: 8, col: 11 },
  ],
  tank: [{ row: 8, col: 4 }],
});
const LEFT = { row: 7, col: 1 };
const LEFT_CENTER = { row: 7, col: 3 };
const CENTER = { row: 8, col: 6 };
const RIGHT = { row: 8, col: 11 };

const context = (
  props: CommandCardProps,
  { board = new BoardManager(scenario), orders = [], chosenSection = null, coins = 0 }: Partial<OrderContext> = {}
): OrderContext => ({ card: new CommandCard(props), board, orders, chosenSection, coins });

const orderable = (ctx: OrderContext) => orderablePositions(ctx).map(key).sort();

/** A hold order for the unit at `position`, counted against `section` */
const holdAt = (board: BoardManager, position: Position, section: Section | null = null, onTheMove = false) =>
  new Order({ unit: board.getHex(position)!.unit!, start: position, end: position, shots: 1, section, onTheMove });

const slotsAt = (ctx: OrderContext, position: Position) => {
  const hex = ctx.board.getHex(position)!;
  return orderSlots(ctx, hex.unit!, hex.getSide());
};

describe("sections", () => {
  it("uses the sections the test scenario expects", () => {
    const board = new BoardManager(scenario);
    const sideOf = (row: number, col: number) => board.getHex({ row, col })!.getSide();

    expect(sideOf(7, 1)).toBe(Side.LEFT);
    expect(sideOf(7, 3)).toBe(Side.LEFT_CENTER);
    expect(sideOf(8, 4)).toBe(Side.CENTER);
    expect(sideOf(7, 8)).toBe(Side.RIGHT_CENTER);
    expect(sideOf(8, 11)).toBe(Side.RIGHT);
  });

  it("puts a border hex in both of its sections", () => {
    expect(sectionsOf(Side.LEFT)).toEqual([Side.LEFT]);
    expect(sectionsOf(Side.LEFT_CENTER)).toEqual([Side.LEFT, Side.CENTER]);
    expect(sectionsOf(Side.RIGHT_CENTER)).toEqual([Side.CENTER, Side.RIGHT]);
  });
});

describe("which units a card orders", () => {
  it.each<[string, CommandCardProps, string[], number]>([
    ["left", { sections: [Side.LEFT], orders: 2 }, ["7-1", "7-3"], 2],
    ["center", { sections: [Side.CENTER], orders: 3 }, ["7-3", "7-8", "8-4", "8-6"], 3],
    ["right", { sections: [Side.RIGHT], orders: 4 }, ["7-8", "8-11"], 2],
    ["every section", { orders: 6 }, ["7-1", "7-3", "7-8", "8-11", "8-4", "8-6"], 6],
    ["tanks", { unitTypes: [UnitType.TANK], orders: 4 }, ["8-4"], 1],
    ["artillery", { unitTypes: [UnitType.ARTILLERY], orders: 4 }, [], 0],
    ["infantry", { unitTypes: [UnitType.INFANTRY], orders: 2 }, ["7-1", "7-3", "7-8", "8-11", "8-6"], 2],
    ["tanks in the left", { sections: [Side.LEFT], unitTypes: [UnitType.TANK], orders: 2 }, [], 0],
  ])("%s: the right units, and orders capped at the units available", (_name, props, expected, left) => {
    const ctx = context(props);

    expect(orderable(ctx)).toEqual([...expected].sort());
    expect(ordersLeft(ctx)).toBe(left);
  });

  it("leaves out units already ordered", () => {
    const board = new BoardManager(scenario);
    const ctx = context({ sections: [Side.LEFT], orders: 2 }, { board, orders: [holdAt(board, LEFT)] });

    expect(orderable(ctx)).toEqual(["7-3"]);
    expect(ordersLeft(ctx)).toBe(1);
  });

  it("orders all the units in the section chosen on play", () => {
    const props: CommandCardProps = { sections: "chosen", orders: "all" };

    expect(orderable(context(props, { chosenSection: Side.RIGHT }))).toEqual(["7-8", "8-11"]);
    expect(ordersLeft(context(props, { chosenSection: Side.RIGHT }))).toBe(2);
    expect(ordersLeft(context(props, { chosenSection: Side.CENTER }))).toBe(4);
    expect(ordersLeft(context(props))).toBe(0);
  });
});

describe("orders per section", () => {
  const generalAdvance: CommandCardProps = { orders: 6, perSection: 2 };

  it("lets a border unit fill either section's quota", () => {
    const ctx = context(generalAdvance);

    expect(slotsAt(ctx, LEFT_CENTER)).toEqual([
      { section: Side.LEFT, onTheMove: false },
      { section: Side.CENTER, onTheMove: false },
    ]);
    expect(slotsAt(ctx, LEFT)).toEqual([{ section: Side.LEFT, onTheMove: false }]);
    expect(ordersLeft(ctx)).toBe(6);
  });

  it("counts the orders left from the sections the player picked", () => {
    const board = new BoardManager(scenario);
    // The border unit takes a center order: the left now only has 1 unit for its 2 orders
    const ctx = context(generalAdvance, { board, orders: [holdAt(board, LEFT_CENTER, Side.CENTER)] });

    expect(ordersLeft(ctx)).toBe(4);
  });

  it("stops ordering in a section once its quota is used", () => {
    const board = new BoardManager(scenario);
    const ctx = context({ orders: 3, perSection: 1 }, { board, orders: [holdAt(board, LEFT, Side.LEFT)] });

    expect(slotsAt(ctx, LEFT_CENTER)).toEqual([{ section: Side.CENTER, onTheMove: false }]);
    expect(ordersLeft(ctx)).toBe(2);
  });

  it("matches border units to sections instead of counting each section on its own", () => {
    // Only border units: each one fills one of its two sections, so 2 orders, not 3
    const bordersOnly = makeScenario({ infantry: [LEFT_CENTER, { row: 7, col: 8 }] });
    const ctx = context({ orders: 3, perSection: 1 }, { board: new BoardManager(bordersOnly) });

    expect(ordersLeft(ctx)).toBe(2);
  });
});

describe("units on the move", () => {
  const probe: CommandCardProps = { sections: [Side.LEFT], orders: 2, onTheMove: 1 };

  it("adds a unit anywhere on the board", () => {
    const ctx = context(probe);

    expect(orderable(ctx)).toHaveLength(6);
    expect(ordersLeft(ctx)).toBe(3);
    expect(slotsAt(ctx, RIGHT)).toEqual([{ section: null, onTheMove: true }]);
    expect(slotsAt(ctx, LEFT)).toEqual([
      { section: null, onTheMove: false },
      { section: null, onTheMove: true },
    ]);
  });

  it("keeps it apart from the card's own orders", () => {
    const board = new BoardManager(scenario);
    const ctx = context(probe, { board, orders: [holdAt(board, LEFT), holdAt(board, LEFT_CENTER)] });

    expect(ordersLeft(ctx)).toBe(1);
    expect(slotsAt(ctx, CENTER)).toEqual([{ section: null, onTheMove: true }]);

    const done = context(probe, { board, orders: [...ctx.orders, holdAt(board, CENTER, null, true)] });
    expect(ordersLeft(done)).toBe(0);
    expect(orderable(done)).toEqual([]);
  });

  it("needs a unit left over for it", () => {
    const oneUnit = makeScenario({ infantry: [LEFT] });

    expect(ordersLeft(context(probe, { board: new BoardManager(oneUnit) }))).toBe(1);
  });
});

describe("orders paid in coins (Finest Hour)", () => {
  const TANK = { row: 8, col: 4 };
  const finestHour: CommandCardProps = {
    orders: 4,
    coinCost: { [UnitType.INFANTRY]: 1, [UnitType.TANK]: 2, [UnitType.ARTILLERY]: 2 },
  };

  it("makes the orders optional, so none are still owed", () => {
    expect(ordersLeft(context(finestHour, { coins: 10 }))).toBe(0);
    expect(cardOrdersLeft(context(finestHour, { coins: 10 }))).toBe(4);
  });

  it("orders only the units the player can pay for", () => {
    expect(orderable(context(finestHour, { coins: 0 }))).toEqual([]);
    expect(orderable(context(finestHour, { coins: 1 }))).not.toContain(key(TANK));
    expect(orderable(context(finestHour, { coins: 2 }))).toContain(key(TANK));
  });

  it("stops at 4 orders however many coins are left", () => {
    const board = new BoardManager(scenario);
    const orders = [holdAt(board, LEFT), holdAt(board, LEFT_CENTER), holdAt(board, CENTER), holdAt(board, RIGHT)];
    const ctx = context(finestHour, { board, orders, coins: 20 });

    expect(cardOrdersLeft(ctx)).toBe(0);
    expect(orderable(ctx)).toEqual([]);
  });

  it("charges the card's cost for its orders, and nothing on the move", () => {
    const card = new CommandCard(finestHour);
    const tank = new Unit(UnitType.TANK);

    expect(slotCost(card, tank, { section: null, onTheMove: false })).toBe(2);
    expect(slotCost(card, new Unit(UnitType.INFANTRY), { section: null, onTheMove: false })).toBe(1);
    expect(slotCost(new CommandCard({ orders: 1 }), tank, { section: null, onTheMove: false })).toBe(0);
    expect(slotCost(card, tank, { section: null, onTheMove: true })).toBe(0);
  });
});

describe("extra orders bought with coins", () => {
  it("lets any unit not yet ordered take one, with 4 coins", () => {
    const board = new BoardManager(scenario);
    const unit = board.getHex(LEFT)!.unit!;

    expect(canBuyExtraOrder(context({ orders: 1 }, { board, coins: 3 }), unit)).toBe(false);
    expect(canBuyExtraOrder(context({ orders: 1 }, { board, coins: 4 }), unit)).toBe(true);
    expect(canBuyExtraOrder(context({ orders: 1 }, { board, coins: 4, orders: [holdAt(board, LEFT)] }), unit)).toBe(false);
    expect(extraOrderablePositions(context({ orders: 1, sections: [Side.RIGHT] }, { board, coins: 4 }))).toHaveLength(6);
  });

  it("doesn't use up the card's orders", () => {
    const board = new BoardManager(scenario);
    const extra = new Order({ unit: board.getHex(LEFT)!.unit!, start: LEFT, end: LEFT, shots: 1, extra: true, cost: 4 });

    expect(ordersLeft(context({ orders: 1 }, { board, orders: [extra] }))).toBe(1);
  });

  it("costs 4 coins and moves like the unit, with none of the card's benefits", () => {
    const card = new CommandCard({ noMove: true, moveBonus: 1, holdShots: 2 });

    expect(slotCost(card, new Unit(UnitType.TANK), EXTRA_SLOT)).toBe(4);
    expect(moveLimits(card, new Unit(UnitType.INFANTRY), EXTRA_SLOT)).toEqual({ maxMove: 2, moveAndFire: 1, holdShots: 1 });
  });
});

describe("fallbackCard", () => {
  it("orders 1 unit of any type when none of the card's unit types are on the board", () => {
    const board = new BoardManager(scenario);
    const artillery = new CommandCard({ id: "arty", name: "Artillería", unitTypes: [UnitType.ARTILLERY], orders: "all", holdShots: 2 });

    const fallback = fallbackCard(artillery, board)!;

    expect(fallback).toMatchObject({ id: "arty", name: "Artillería", orders: 1, unitTypes: null, holdShots: 1 });
    expect(ordersLeft({ card: fallback, board, orders: [], chosenSection: null, coins: 0 })).toBe(1);
  });

  it("keeps the card when a unit of its type is on the board, or it isn't a unit-type card", () => {
    const board = new BoardManager(scenario);

    expect(fallbackCard(new CommandCard({ unitTypes: [UnitType.TANK], orders: 4 }), board)).toBeNull();
    expect(fallbackCard(new CommandCard({ orders: 4 }), board)).toBeNull();
  });
});

describe("moveLimits", () => {
  const infantry = new Unit(UnitType.INFANTRY);
  const artillery = new Unit(UnitType.ARTILLERY);
  const cardOrder = { section: null, onTheMove: false };
  const limits = (props: CommandCardProps, unit: Unit, slot = cardOrder) =>
    moveLimits(new CommandCard(props), unit, slot);

  it("uses the unit's own movement by default", () => {
    expect(limits({}, infantry)).toEqual({ maxMove: 2, moveAndFire: 1, holdShots: 1 });
  });

  it("lets a unit on the move move but never fire", () => {
    expect(limits({}, infantry, { section: null, onTheMove: true })).toEqual({
      maxMove: 2,
      moveAndFire: 0,
      holdShots: 0,
    });
  });

  it("holds units for a card that can't move", () => {
    expect(limits({ noMove: true }, infantry)).toEqual({ maxMove: 0, moveAndFire: 0, holdShots: 1 });
  });

  it("adds a move bonus, but not to firing for a unit that can't move and fire", () => {
    expect(limits({ moveBonus: 1 }, infantry)).toEqual({ maxMove: 3, moveAndFire: 2, holdShots: 1 });
    expect(limits({ moveBonus: 1 }, artillery)).toEqual({ maxMove: 2, moveAndFire: 0, holdShots: 1 });
  });

  it("fires twice when holding, or moves further (Artillery Bombardment)", () => {
    expect(limits({ maxMove: 3, holdShots: 2 }, artillery)).toEqual({ maxMove: 3, moveAndFire: 0, holdShots: 2 });
  });
});

describe("boostedLimits", () => {
  const limits = { maxMove: 2, moveAndFire: 1, holdShots: 1 };

  it("adds a move bonus to moving and to moving and firing", () => {
    expect(boostedLimits(limits, { kind: "move", units: 3, moveBonus: 1 })).toEqual({ maxMove: 3, moveAndFire: 2, holdShots: 1 });
    expect(boostedLimits({ ...limits, moveAndFire: 0 }, { kind: "move", units: 3, moveBonus: 1 }).moveAndFire).toBe(0);
  });

  it("replaces the move, and lets it fire when it can fire into the card's terrain", () => {
    expect(boostedLimits(limits, { kind: "move", units: 1, maxMove: 3, fireInto: [] })).toMatchObject({ maxMove: 3, moveAndFire: 3 });
  });

  it("leaves a unit that can't move as it is", () => {
    const noMove = { maxMove: 0, moveAndFire: 0, holdShots: 1 };
    expect(boostedLimits(noMove, { kind: "move", units: 3, moveBonus: 1 })).toEqual(noMove);
  });
});
