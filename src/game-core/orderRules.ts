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

/** Every order slot this unit can still take, the card's own orders first */
export function orderSlots(context: OrderContext, unit: Unit, side: Side): OrderSlot[] {
  if (context.orders.some((order) => order.unit === unit)) return [];
  const limits = remaining(context);

  const cardSlots: OrderSlot[] = [];
  if (limits.cardOrders > 0 && fitsCard(context, unit)) {
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
 * units; the units on the move can be any of the rest.
 */
export function ordersLeft(context: OrderContext): number {
  const limits = remaining(context);
  const ordered = new Set(context.orders.map((order) => order.unit));
  const free = context.board.getAllHexes().filter((hex) => hex.unit && !ordered.has(hex.unit));

  const fitting = free
    .filter((hex) => fitsCard(context, hex.unit!))
    .map((hex) => sectionsOf(hex.getSide()).filter((section) => cardSections(context).includes(section)))
    .filter((sections) => sections.length > 0);
  const cardUnits =
    context.card.perSection === null ? fitting.length : maxMatching(fitting, limits.quota);
  const cardOrders = Math.min(limits.cardOrders, cardUnits);
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

/** What's left of the card's orders, its quota in each section and its units on the move */
function remaining({ card, orders }: OrderContext) {
  const cardOrders = orders.filter((order) => !order.onTheMove);
  return {
    cardOrders: card.orders === "all" ? Infinity : card.orders - cardOrders.length,
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
