// game-core/turnLog.ts
import BoardManager from "./BoardManager";
import CommandCard from "./commandCard";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { DieFace } from "./dice";
import { DiceStep } from "./fireRules";
import { positionKey } from "./position";
import { Position } from "../types/scenario";
import type { AmbushShot, BattleEdit, CardAttack, ReinforcementRoll, Shot } from "./gameSession";
import type { ShotTarget } from "../data/hitRules";
import type { CoinEntry, RewardChoice } from "./coins";
import type { CombatCard } from "./combatCard";

/**
 * One finished turn as plain JSON: what was played, ordered, rolled and
 * changed on the map. Positions are the app's own (flipped for Axis), like
 * the save. Units are named by type, since the log outlives the unit objects.
 */
export interface TurnRecord {
  turn: number;
  card: { id: string; name: string };
  orders: {
    unit: UnitType;
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
    dice: number;
    /** How the dice were worked out (empty in turns saved from before the quick roll was removed) */
    steps: DiceStep[];
    faces: DieFace[];
    /** The dice whose results were applied (indexes into `faces`); null for all of them */
    kept: number[] | null;
    notes: string[];
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
    | { kind: "remove"; unit: UnitType; position: Position; replacedBy?: UnitType }
    | { kind: "move"; unit: UnitType; from: Position; to: Position }
    | { kind: "add"; unit: UnitType; position: Position }
    | { kind: "wire"; position: Position }
    /** Sandbags put down (`placed`) or taken away; `fortify`: on this side's unit, for the Fortify card */
    | { kind: "sandbags"; position: Position; placed: boolean; fortify?: boolean }
  )[];
  /** How the turn earned and spent coins */
  coins: CoinEntry[];
  /** Coins at the end of the turn */
  coinsAfter: number;
  /** Final phase: 2 coins or a combat card; null in the extra turn or after a card with its own reward */
  reward: RewardChoice | null;
  /** Combat cards played this turn (with the orders, then in the battle) */
  combatCardsPlayed: { id: string; name: string }[];
  /** The combat card drawn in the final phase */
  combatCardDrawn: { id: string; name: string } | null;
  /** Hexes marked for the order combat card */
  markers: Position[];
  /** The attack combat card's rolls on the marked hexes */
  cardAttacks: CardAttack[];
  /** The Reinforcements card's roll and the unit it brought */
  reinforcement: ReinforcementRoll | null;
  /** The Ambush card's shot (missing in turns saved before Ambush fired in the app) */
  ambush?: AmbushShot | null;
}

interface TurnState {
  turn: number;
  card: CommandCard;
  orders: readonly Order[];
  shots: readonly Shot[];
  battleEdits: readonly BattleEdit[];
  /** The board after the battle edits, to find which unit each move was */
  board: BoardManager;
  coins: readonly CoinEntry[];
  coinsAfter: number;
  reward: RewardChoice | null;
  combatCardsPlayed: readonly CombatCard[];
  combatCardDrawn: CombatCard | null;
  markers: readonly Position[];
  cardAttacks: readonly CardAttack[];
  ambush: AmbushShot | null;
  reinforcement: ReinforcementRoll | null;
}

/** Record a turn at its end, before the orders and edits are cleared */
export function recordTurn({
  turn,
  card,
  orders,
  shots,
  battleEdits,
  board,
  coins,
  coinsAfter,
  reward,
  combatCardsPlayed,
  combatCardDrawn,
  markers,
  cardAttacks,
  ambush,
  reinforcement,
}: TurnState): TurnRecord {
  return {
    turn,
    card: { id: card.id, name: card.name },
    orders: orders.map((order) => ({
      unit: order.unit.getUnitType(),
      start: { ...order.start },
      end: { ...order.end },
      path: (order.path ?? [order.start, order.end]).map((p) => ({ ...p })),
      canFire: order.canFire,
    })),
    shots: shots.map((shot) => ({
      order: shot.orderIndex,
      unit: orders[shot.orderIndex]!.unit.getUnitType(),
      dice: shot.dice,
      steps: shot.steps.map((step) => ({ ...step })),
      faces: [...shot.faces],
      kept: shot.kept && [...shot.kept],
      notes: [...shot.notes],
      collision: shot.collision,
      target: { ...shot.target },
      ...(shot.removedWire && { removedWire: { ...shot.removedWire } }),
    })),
    battleEdits: editedUnits(battleEdits, board).map((unit, i): TurnRecord["battleEdits"][number] => {
      const edit = battleEdits[i]!;
      if (edit.kind === "wire") return { kind: "wire", position: { ...edit.position } };
      if (edit.kind === "sandbags") {
        return { kind: "sandbags", position: { ...edit.position }, placed: edit.placed, ...(edit.fortify && { fortify: true }) };
      }
      if (edit.kind === "move") return { kind: "move", unit: unit!, from: { ...edit.from }, to: { ...edit.to } };
      return {
        kind: edit.kind,
        unit: unit!,
        position: { ...edit.position },
        ...(edit.kind === "remove" && edit.replacement && { replacedBy: edit.replacement.getUnitType() }),
      };
    }),
    coins: coins.map((entry) => ({ ...entry })),
    coinsAfter,
    reward,
    combatCardsPlayed: combatCardsPlayed.map(({ id, name }) => ({ id, name })),
    combatCardDrawn: combatCardDrawn && { id: combatCardDrawn.id, name: combatCardDrawn.name },
    markers: markers.map((p) => ({ ...p })),
    cardAttacks: cardAttacks.map((attack) => ({
      ...attack,
      target: attack.target && { ...attack.target },
      faces: [...attack.faces],
    })),
    reinforcement: reinforcement && { ...reinforcement },
    ambush: ambush && copyAmbush(ambush),
  };
}

/** A copy of an Ambush shot as plain data */
export const copyAmbush = (ambush: AmbushShot): AmbushShot => ({
  ...ambush,
  from: { ...ambush.from },
  targetPosition: { ...ambush.targetPosition },
  steps: ambush.steps.map((step) => ({ ...step })),
  faces: [...ambush.faces],
  kept: ambush.kept && [...ambush.kept],
  notes: [...ambush.notes],
  target: { ...ambush.target },
});

/**
 * The unit type each edit applied to (null for wire and sandbags). A move only knows its
 * hexes, so the edits are undone one by one, newest first, on a copy of the board.
 */
function editedUnits(edits: readonly BattleEdit[], board: BoardManager): (UnitType | null)[] {
  const units = new Map<string, Unit>();
  board.getAllHexes().forEach((hex) => {
    if (hex.unit) units.set(positionKey(hex.getPosition()), hex.unit);
  });

  const types: (UnitType | null)[] = [];
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i]!;
    if (edit.kind === "remove") {
      units.set(positionKey(edit.position), edit.unit);
      types[i] = edit.unit.getUnitType();
    } else if (edit.kind === "add") {
      units.delete(positionKey(edit.position));
      types[i] = edit.unit.getUnitType();
    } else if (edit.kind === "wire" || edit.kind === "sandbags") {
      types[i] = null;
    } else {
      const unit = units.get(positionKey(edit.to));
      if (!unit) throw new Error(`No unit at ${positionKey(edit.to)} to undo a move`);
      units.delete(positionKey(edit.to));
      units.set(positionKey(edit.from), unit);
      types[i] = unit.getUnitType();
    }
  }
  return types;
}
