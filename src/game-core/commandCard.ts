// game-core/commandCard.ts
import { Side } from "../types/hex";
import { UnitType } from "./unit";

/** The board's three sections; a unit on a border hex is in two of them */
export type Section = Side.LEFT | Side.CENTER | Side.RIGHT;
export const SECTIONS: readonly Section[] = [Side.LEFT, Side.CENTER, Side.RIGHT];

export const isSection = (value: unknown): value is Section => SECTIONS.includes(value as Section);

/** Dice a card adds (or takes away) when one of its units fires */
export interface FireBonus {
  dice: number;
  /** true: only in close assault; false: only at range; omitted: both */
  closeAssault?: boolean;
  /** Only for these unit types; omitted: every type */
  unitTypes?: readonly UnitType[];
}

/**
 * What a card lets the player order. The rules for applying it live in
 * orderRules.ts; the cards themselves in data/commandCards.ts.
 */
export interface CommandCardProps {
  id?: string;
  name?: string;
  description?: string;
  /** A tactic card (drawn differently); otherwise a section card */
  tactic?: boolean;
  /** Sections it orders units in, or "chosen": one section the player picks when playing it. Defaults to all three. */
  sections?: readonly Section[] | "chosen";
  /**
   * Only units of these types; omitted: every type. With none of them on the
   * board, the card orders 1 unit of any type anywhere instead, with no bonus.
   */
  unitTypes?: readonly UnitType[];
  /** How many units it orders, or "all" of the units that fit; with `orderCost`, the points to spend */
  orders?: number | "all";
  /** Points each unit type costs out of `orders` (Finest Hour: infantry 1, tank and artillery 2); 1 when omitted */
  orderCost?: Partial<Record<UnitType, number>>;
  /** At most this many orders in each section (General Advance: 2); a border unit counts for the section the player picks */
  perSection?: number;
  /** Extra units anywhere on the board that may move but can't fire (Probe, Recon) */
  onTheMove?: number;
  /** Its units can't move; they hold (Firefight) */
  noMove?: boolean;
  /** Hexes added to how far its units move, and to how far they move and still fire */
  moveBonus?: number;
  /** Its units may move this far instead of their usual move (Artillery Bombardment: 3) */
  maxMove?: number;
  /** Shots for a unit that holds (Artillery Bombardment: 2); a unit that moved fires at most once */
  holdShots?: number;
  fireBonus?: readonly FireBonus[];
  /** No orders: in the battle, the player marks each unit adjacent to an enemy and it fires in close assault (Close Assault) */
  closeAssaultOnly?: boolean;
}

class CommandCard {
  private static counter = 1;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tactic: boolean;
  readonly sections: readonly Section[] | "chosen";
  readonly unitTypes: readonly UnitType[] | null;
  readonly orders: number | "all";
  readonly orderCost: Partial<Record<UnitType, number>>;
  readonly perSection: number | null;
  readonly onTheMove: number;
  readonly noMove: boolean;
  readonly moveBonus: number;
  readonly maxMove: number | null;
  readonly holdShots: number;
  readonly fireBonus: readonly FireBonus[];
  readonly closeAssaultOnly: boolean;

  constructor({
    id = `command-card-${CommandCard.counter++}`,
    name = "",
    description = "",
    tactic = false,
    sections = SECTIONS,
    unitTypes,
    orders = 0,
    orderCost = {},
    perSection,
    onTheMove = 0,
    noMove = false,
    moveBonus = 0,
    maxMove,
    holdShots = 1,
    fireBonus = [],
    closeAssaultOnly = false,
  }: CommandCardProps) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.tactic = tactic;
    this.sections = sections;
    this.unitTypes = unitTypes ?? null;
    this.orders = orders;
    this.orderCost = orderCost;
    this.perSection = perSection ?? null;
    this.onTheMove = onTheMove;
    this.noMove = noMove;
    this.moveBonus = moveBonus;
    this.maxMove = maxMove ?? null;
    this.holdShots = holdShots;
    this.fireBonus = fireBonus;
    this.closeAssaultOnly = closeAssaultOnly;
  }

  /** Points an order for this unit type uses out of the card's orders */
  costOf(unitType: UnitType): number {
    return this.orderCost[unitType] ?? 1;
  }

  /** The player picks the card's section when playing it */
  get choosesSection(): boolean {
    return this.sections === "chosen";
  }

  /** Extra dice for one of its units firing, in close assault or at range */
  fireBonusFor(unitType: UnitType, closeAssault: boolean): number {
    return this.fireBonus
      .filter((bonus) => bonus.closeAssault === undefined || bonus.closeAssault === closeAssault)
      .filter((bonus) => !bonus.unitTypes || bonus.unitTypes.includes(unitType))
      .reduce((sum, bonus) => sum + bonus.dice, 0);
  }
}

export default CommandCard;
