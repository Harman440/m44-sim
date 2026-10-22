// game-core/turnLog.ts
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { DieFace } from "./dice";
import { DiceStep } from "./fireRules";
import { Position } from "../types/scenario";
import type { BattleEdit, CardAttack, Shot } from "./gameSession";
import type { ShotTarget } from "../data/hitRules";
import type { CoinEntry } from "./coins";
import type { Localized } from "../i18n/lang";

/**
 * One finished turn as plain JSON: what was played, ordered, rolled and
 * changed on the map. Positions are the app's own (flipped for Axis), like
 * the save. Units are named by type and badge (`elite`, left out when false
 * and in turns saved before it was logged), since the log outlives the unit objects.
 */
export interface TurnRecord {
  turn: number;
  /** The command card played, or null for none */
  card: { id: string; name: Localized } | null;
  orders: {
    unit: UnitType;
    elite?: boolean;
    start: Position;
    end: Position;
    /** Hexes crossed, start and end included */
    path: Position[];
    canFire: boolean;
  }[];
  shots: {
    /** Index into this record's orders */
    order: number;
    unit: UnitType;
    elite?: boolean;
    dice: number;
    /** How the dice were worked out (empty in turns saved from before the quick roll was removed) */
    steps: DiceStep[];
    faces: DieFace[];
    /** The dice whose results were applied (indexes into `faces`); null for all of them */
    kept: number[] | null;
    notes: Localized[];
    /** Rolled for a collision in the movement phase */
    collision: boolean;
    /** What it was rolled against */
    target: ShotTarget;
    /** Instead of firing, the unit removed the barbed wire on this hex */
    removedWire?: Position;
  }[];
  /** Casualties and retreats mirrored from the table, in the order they were made */
  battleEdits: (
    /** `replacedBy`: the infantry an artillery's crew left on the hex (experimental rule) */
    | { kind: "remove"; unit: UnitType; elite?: boolean; position: Position; replacedBy?: UnitType }
    | { kind: "move"; unit: UnitType; elite?: boolean; from: Position; to: Position }
    | { kind: "add"; unit: UnitType; position: Position }
    | { kind: "wire"; position: Position }
    /** Sandbags put down (`placed`) or taken away; `fortify`: on this side's unit, for the Fortify card */
    | { kind: "sandbags"; position: Position; placed: boolean; fortify?: boolean }
  )[];
  /** How the turn earned and spent coins */
  coins: CoinEntry[];
  /** Coins at the end of the turn */
  coinsAfter: number;
  /** Hexes marked for the card played */
  markers: Position[];
  /** The attack card's rolls on the marked hexes */
  cardAttacks: CardAttack[];
}

interface TurnState {
  turn: number;
  card: { id: string; name: Localized } | null;
  orders: readonly Order[];
  shots: readonly Shot[];
  battleEdits: readonly BattleEdit[];
  coins: readonly CoinEntry[];
  coinsAfter: number;
  markers: readonly Position[];
  cardAttacks: readonly CardAttack[];
}

/** Record a turn at its end, before the orders and edits are cleared */
export function recordTurn({
  turn,
  card,
  orders,
  shots,
  battleEdits,
  coins,
  coinsAfter,
  markers,
  cardAttacks,
}: TurnState): TurnRecord {
  return {
    turn,
    card: card && { id: card.id, name: card.name },
    orders: orders.map((order) => ({
      unit: order.unit.getUnitType(),
      ...eliteOf(order.unit),
      start: { ...order.start },
      end: { ...order.end },
      path: (order.path ?? [order.start, order.end]).map((p) => ({ ...p })),
      canFire: order.canFire,
    })),
    shots: shots.map((shot) => ({
      order: shot.orderIndex,
      unit: orders[shot.orderIndex]!.unit.getUnitType(),
      ...eliteOf(orders[shot.orderIndex]!.unit),
      dice: shot.dice,
      steps: shot.steps.map((step) => ({ ...step })),
      faces: [...shot.faces],
      kept: shot.kept && [...shot.kept],
      notes: [...shot.notes],
      collision: shot.collision,
      target: { ...shot.target },
      ...(shot.removedWire && { removedWire: { ...shot.removedWire } }),
    })),
    battleEdits: battleEdits.map((edit): TurnRecord["battleEdits"][number] => {
      if (edit.kind === "wire") return { kind: "wire", position: { ...edit.position } };
      if (edit.kind === "sandbags") {
        return { kind: "sandbags", position: { ...edit.position }, placed: edit.placed, ...(edit.fortify && { fortify: true }) };
      }
      const { unit } = edit;
      if (edit.kind === "move") {
        return { kind: "move", unit: unit.getUnitType(), ...eliteOf(unit), from: { ...edit.from }, to: { ...edit.to } };
      }
      return {
        kind: edit.kind,
        unit: unit.getUnitType(),
        ...(edit.kind === "remove" && eliteOf(unit)),
        position: { ...edit.position },
        ...(edit.kind === "remove" && edit.replacement && { replacedBy: edit.replacement.getUnitType() }),
      };
    }),
    coins: coins.map((entry) => ({ ...entry })),
    coinsAfter,
    markers: markers.map((p) => ({ ...p })),
    cardAttacks: cardAttacks.map((attack) => ({
      ...attack,
      target: attack.target && { ...attack.target },
      faces: [...attack.faces],
    })),
  };
}

/** `elite: true` for a unit with the scenario's badge, nothing otherwise */
const eliteOf = (unit: Unit): { elite?: true } => (unit.elite ? { elite: true } : {});
