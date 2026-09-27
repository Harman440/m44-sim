// game-core/orderRules.ts
// Which units the card played this turn lets the player order, how far they
// move, and how many orders are left. Worked out from the card and the orders
// given so far, so undoing an order frees its place again.
import BoardManager from "./BoardManager";
import CommandCard, { SECTIONS, Section } from "./commandCard";
import Order from "./order";
import Unit from "./unit";
import { Side } from "../types/hex";
import { Position } from "../types/scenario";

/** The sections a hex's side belongs to: a border hex is in both */
export function sectionsOf(side: Side): Section[] {
  switch (side) {
    case Side.LEFT_CENTER:
      return [Side.LEFT, Side.CENTER];
    case Side.RIGHT_CENTER:
      return [Side.CENTER, Side.RIGHT];
    default:
      return [side];
  }
}

/** What an order counts against: one of the card's orders (in a section, for cards with quotas) or the unit on the move */
export interface OrderSlot {
  /** The section quota it uses; null when the card has no orders per section, and for the unit on the move */
  section: Section | null;
  onTheMove: boolean;
}

export const sameSlot = (a: OrderSlot, b: OrderSlot) => a.section === b.section && a.onTheMove === b.onTheMove;

/** The turn so far: the card played (with its chosen section) and the orders given */
export interface OrderContext {
  card: CommandCard;
  /** For cards whose section is picked on play */
  chosenSection: Section | null;
  board: BoardManager;
  orders: readonly Order[];
}

/** How far a unit may move with an order, and how many shots the order gives it */
export interface MoveLimits {
  maxMove: number;
  /** Moving at most this far it can still fire (0: it can only fire if it holds) */
  moveAndFire: number;
  /** Shots when it holds */
  holdShots: number;
}

export function moveLimits(card: CommandCard, unit: Unit, slot: OrderSlot): MoveLimits {
  if (slot.onTheMove) return { maxMove: unit.getMaxMove(), moveAndFire: 0, holdShots: 0 };
  if (card.noMove) return { maxMove: 0, moveAndFire: 0, holdShots: card.holdShots };

  const moveAndFire = unit.getMoveAndFire();
  return {
    maxMove: card.maxMove ?? unit.getMaxMove() + card.moveBonus,
    // A unit that can't move and fire still can't with a bonus
    moveAndFire: moveAndFire > 0 ? moveAndFire + card.moveBonus : 0,
    holdShots: card.holdShots,
  };
}

/**
 * What a unit-type card orders when none of its unit types are on the board:
 * 1 unit of any type, anywhere, with none of the card's bonuses. Null when the
 * card applies as it is.
 */
export function fallbackCard(card: CommandCard, board: BoardManager): CommandCard | null {
  const { unitTypes } = card;
  if (!unitTypes) return null;
  if (board.getAllHexes().some((hex) => hex.unit && unitTypes.includes(hex.unit.getUnitType()))) return null;
  return new CommandCard({
    id: card.id,
    name: card.name,
    description: "No tienes unidades de este tipo: da una orden a 1 unidad cualquiera, sin bonificaciones.",
    orders: 1,
  });
}

/** Every order slot this unit can still take, the card's own orders first */
export function orderSlots(context: OrderContext, unit: Unit, side: Side): OrderSlot[] {
  if (context.orders.some((order) => order.unit === unit)) return [];
  const limits = remaining(context);

  const cardSlots: OrderSlot[] = [];
  if (limits.cardOrders >= context.card.costOf(unit.getUnitType()) && fitsCard(context, unit)) {
    const sections = sectionsOf(side).filter((section) => cardSections(context).includes(section));
    if (context.card.perSection === null) {
      if (sections.length > 0) cardSlots.push({ section: null, onTheMove: false });
    } else {
      sections
        .filter((section) => limits.quota(section) > 0)
        .forEach((section) => cardSlots.push({ section, onTheMove: false }));
    }
  }
  const onTheMove = limits.onTheMove > 0 ? [{ section: null, onTheMove: true }] : [];
  return [...cardSlots, ...onTheMove];
}

/** The positions of the units that can still be ordered */
export function orderablePositions(context: OrderContext): Position[] {
  return context.board
    .getAllHexes()
    .filter((hex) => hex.unit && orderSlots(context, hex.unit, hex.getSide()).length > 0)
    .map((hex) => hex.getPosition());
}

/**
 * The most orders the player can still give with the units left. A border
 * unit can fill either section's quota, so the card's orders are matched to
 * units; with costs, the cheapest units are counted first. The units on the
 * move can be any of the rest. (No card has both quotas and costs.)
 */
export function ordersLeft(context: OrderContext): number {
  const { card } = context;
  const limits = remaining(context);
  const ordered = new Set(context.orders.map((order) => order.unit));
  const free = context.board.getAllHexes().filter((hex) => hex.unit && !ordered.has(hex.unit));

  const fitting = free
    .filter((hex) => fitsCard(context, hex.unit!))
    .map((hex) => ({
      sections: sectionsOf(hex.getSide()).filter((section) => cardSections(context).includes(section)),
      cost: card.costOf(hex.unit!.getUnitType()),
    }))
    .filter(({ sections }) => sections.length > 0);

  let cardOrders = 0;
  if (card.perSection !== null) {
    cardOrders = Math.min(limits.cardOrders, maxMatching(fitting.map((unit) => unit.sections), limits.quota));
  } else {
    let points = limits.cardOrders;
    for (const cost of fitting.map((unit) => unit.cost).sort((a, b) => a - b)) {
      if (cost > points) break;
      points -= cost;
      cardOrders++;
    }
  }
  return cardOrders + Math.min(limits.onTheMove, free.length - cardOrders);
}

// --- internals

function cardSections(context: OrderContext): readonly Section[] {
  const { sections } = context.card;
  if (sections !== "chosen") return sections;
  return context.chosenSection ? [context.chosenSection] : [];
}

function fitsCard(context: OrderContext, unit: Unit): boolean {
  const { unitTypes } = context.card;
  return !unitTypes || unitTypes.includes(unit.getUnitType());
}

/** What's left of the card's orders (points, with costs), its quota in each section and its units on the move */
function remaining({ card, orders }: OrderContext) {
  const cardOrders = orders.filter((order) => !order.onTheMove);
  const used = cardOrders.reduce((sum, order) => sum + card.costOf(order.unit.getUnitType()), 0);
  return {
    cardOrders: card.orders === "all" ? Infinity : card.orders - used,
    quota: (section: Section) =>
      (card.perSection ?? Infinity) - cardOrders.filter((order) => order.section === section).length,
    onTheMove: card.onTheMove - (orders.length - cardOrders.length),
  };
}

/**
 * The most units that fit a section with quota left, each unit in one of its
 * sections (augmenting paths; the board has a few dozen units at most).
 */
function maxMatching(units: Section[][], quota: (section: Section) => number): number {
  const slots = SECTIONS.flatMap((section) =>
    Array.from({ length: Math.max(0, Math.min(quota(section), units.length)) }, () => section)
  );
  const slotUnit: (number | null)[] = slots.map(() => null);

  const place = (unit: number, seen: Set<number>): boolean =>
    slots.some((section, slot) => {
      if (seen.has(slot) || !units[unit]!.includes(section)) return false;
      seen.add(slot);
      const holder = slotUnit[slot] ?? null;
      if (holder !== null && !place(holder, seen)) return false;
      slotUnit[slot] = unit;
      return true;
    });

  return units.filter((_, unit) => place(unit, new Set())).length;
}
