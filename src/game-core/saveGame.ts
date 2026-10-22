// game-core/saveGame.ts
// A GameSession as plain JSON, so the game survives a page reload or the
// tablet dropping the tab. Cards are saved by id, units by their index in
// `units`, so orders and battle edits keep pointing at the same objects.
import BoardManager from "./BoardManager";
import Order from "./order";
import Unit, { UnitType, isUnitType } from "./unit";
import { DIE_KINDS, DieFace } from "./dice";
import type { ShotTarget } from "../data/hitRules";
import { isKeptList } from "./rollResult";
import { positionKey } from "./position";
import { TurnPhase } from "../types/gameManager";
import { Faction } from "../types/faction";
import { Position } from "../types/scenario";
import type { BattleEdit, CardAttack, Shot, StandingCollisionRoll } from "./gameSession";
import { TurnRecord } from "./turnLog";
import type { ActionCard } from "./actionCard";
import { actionCardById } from "../data/actionCards";
import { actionById } from "../data/unitActions";
import type { UnitSupplies } from "./unitSupplies";
import { EQUIPMENT, SUPPLIES } from "../data/unitSupplies";

/** Bump when SavedGame changes shape (or what it means); older saves are dropped instead of misread */
export const SAVE_VERSION = 38;

interface SavedUnit {
  type: UnitType;
  /** An elite unit (the scenario's badge) */
  elite?: true;
  /** null for a unit removed in this turn's battle (an undo can bring it back) */
  position: Position | null;
}

export interface SavedGame {
  version: typeof SAVE_VERSION;
  scenarioId: string;
  faction: Faction;
  /** Shots at range roll the 8-sided long-range die */
  longRangeDie: boolean;
  /** Test mode: plenty of coins and no cooldown (the session's `testMode`) */
  testMode: boolean;
  /** Experimental rule: destroyed artillery turns into infantry (the session's `artilleryCrew`) */
  artilleryCrew: boolean;
  /** Pass and play: units have figures and take hits (the session's `figures`) */
  figures: boolean;
  /** Hits each damaged unit has taken, by unit index */
  hits: { unit: number; hits: number }[];
  /** Flags each unit took this turn (one pins it, each more makes it retreat), by unit index */
  retreatFlags: { unit: number; flags: number }[];
  /** Hexes each unit must still retreat now, by unit index */
  retreatsDue: { unit: number; flags: number }[];
  /** Hits each unit took this turn, by unit index; missing in older saves */
  turnHits?: { unit: number; hits: number }[];
  /** Units with the camouflage badge, by unit index */
  camouflaged: number[];
  /** What each unit that has spent something has left, by unit index; the others are full */
  supplies: ({ unit: number } & UnitSupplies)[];
  turn: number;
  phase: TurnPhase;
  /** The command card played this turn, by id, or null for none */
  playedCard: string | null;
  /** The turn each command card was last played, by id, for its cooldown */
  cardsPlayedOn: Record<string, number>;
  units: SavedUnit[];
  /** Hexes that still have barbed wire */
  wire: Position[];
  /** Hexes with sandbags */
  sandbags: Position[];
  orders: {
    unit: number;
    /** The action's id (data/unitActions.ts) */
    action: string;
    start: Position;
    end: Position;
    path: Position[] | null;
    shots: number;
    lostSandbags: Position[];
    /** Left out when false, and in saves from before tanks cleared wire */
    clearedWire?: boolean;
  }[];
  unmovedFireSkipped: boolean;
  battleEdits: ((
    | { kind: "remove"; position: Position; unit: number; replacement?: number; sandbags?: boolean }
    | { kind: "move"; from: Position; to: Position; unit: number; sandbags?: Position[]; clearedWire?: boolean; reposition?: boolean }
    | { kind: "add"; position: Position; unit: number }
    | { kind: "wire"; position: Position }
    | { kind: "sandbags"; position: Position; placed: boolean; fortify?: boolean }
  ) & { beforeOrders?: boolean })[];
  shots: Shot[];
  log: TurnRecord[];
  startCoins: number;
  coinAdjustments: number[];
  markers: Position[];
  cardAttacks: CardAttack[];
  standingCollisions: StandingCollisionRoll[];
  drops: Position[];
}

/** Everything a GameSession keeps between actions, apart from the board's units */
export interface SessionState {
  turn: number;
  phase: TurnPhase;
  /** The command card played this turn, or null for none */
  playedCard: ActionCard | null;
  /** The turn each command card was last played, by id */
  cardsPlayedOn: Readonly<Record<string, number>>;
  orders: Order[];
  unmovedFireSkipped: boolean;
  battleEdits: BattleEdit[];
  shots: Shot[];
  log: TurnRecord[];
  /** Coins at the start of this turn */
  startCoins: number;
  coinAdjustments: number[];
  /** Hexes marked for the card played */
  markers: Position[];
  cardAttacks: CardAttack[];
  /** Pass and play: collision rolls of units without an order */
  standingCollisions: readonly StandingCollisionRoll[];
  /** Pass and play: hits taken, by unit (it keeps them from turn to turn) */
  hits: ReadonlyMap<Unit, number>;
  /** Pass and play: flags the unit took this turn (one pins it) */
  retreatFlags: ReadonlyMap<Unit, number>;
  /** Pass and play: hexes the unit must still retreat now */
  retreatsDue: ReadonlyMap<Unit, number>;
  /** Pass and play: hits taken this turn, by unit */
  turnHits: ReadonlyMap<Unit, number>;
  /** Units with the camouflage badge, kept from turn to turn */
  camouflaged: ReadonlySet<Unit>;
  /** What each unit has left, kept from turn to turn; a unit missing is full */
  supplies: ReadonlyMap<Unit, UnitSupplies>;
  /** Paratroopers placed before the first turn, in order (the units are on the board) */
  drops: Position[];
}

const isPosition = (value: unknown): value is Position =>
  typeof value === "object" &&
  value !== null &&
  Number.isInteger((value as Position).row) &&
  Number.isInteger((value as Position).col);

function readPositions(positions: unknown, what: string): Position[] {
  if (!Array.isArray(positions) || !positions.every(isPosition)) throw new Error(`${what} are not a list of hexes`);
  return positions.map(({ row, col }) => ({ row, col }));
}

const isShotTarget = (target: ShotTarget | undefined): boolean =>
  typeof target?.infantry === "boolean" && typeof target.closeAssault === "boolean" && DIE_KINDS.includes(target.die);

function readStandingCollisions(rolls: unknown): StandingCollisionRoll[] {
  if (!Array.isArray(rolls)) throw new Error("Collision rolls are not a list");
  const faces = new Set<string>(Object.values(DieFace));
  return rolls.map((roll: StandingCollisionRoll) => {
    if (!isPosition(roll?.from) || !isUnitType(roll.unitType) || !isShotTarget(roll.target)) {
      throw new Error("Unknown collision roll");
    }
    if (!Array.isArray(roll.faces) || !roll.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
    if (roll.kept !== null && !isKeptList(roll.kept, roll.faces.length)) throw new Error("Unknown kept dice");
    return roll;
  });
}

/** A count per unit (hits taken, flags to retreat) */
function readUnits(indexes: unknown, what: string, unit: (index: number) => Unit): Set<Unit> {
  if (!Array.isArray(indexes) || !indexes.every(Number.isInteger)) throw new Error(`${what} are not a list of units`);
  return new Set(indexes.map(unit));
}

function readUnitCounts<K extends "hits" | "flags">(
  entries: unknown,
  key: K,
  unit: (index: number) => Unit
): Map<Unit, number> {
  if (!Array.isArray(entries)) throw new Error(`Unit ${key} are not a list`);
  return new Map(
    entries.map((entry: { unit: number } & Record<K, number>) => {
      if (!Number.isInteger(entry?.[key]) || entry[key] < 0) throw new Error(`Unknown unit ${key}`);
      return [unit(entry.unit), entry[key]] as const;
    })
  );
}

function readSupplies(entries: unknown, unit: (index: number) => Unit): Map<Unit, UnitSupplies> {
  if (!Array.isArray(entries)) throw new Error("Unit supplies are not a list");
  const isCounts = (counts: unknown, keys: readonly string[]) =>
    typeof counts === "object" &&
    counts !== null &&
    Object.entries(counts).every(([key, count]) => keys.includes(key) && Number.isInteger(count) && count >= 0);
  return new Map(
    entries.map((entry: { unit: number } & UnitSupplies) => {
      if (!isCounts(entry?.amounts, SUPPLIES) || !isCounts(entry.equipment, EQUIPMENT)) throw new Error("Unknown unit supplies");
      return [unit(entry.unit), { amounts: { ...entry.amounts }, equipment: { ...entry.equipment } }] as const;
    })
  );
}

function readCardAttacks(attacks: unknown, markerCount: number): CardAttack[] {
  if (!Array.isArray(attacks)) throw new Error("Card attacks are not a list");
  const faces = new Set<string>(Object.values(DieFace));
  return attacks.map((attack: CardAttack) => {
    if (!Number.isInteger(attack.marker) || attack.marker < 0 || attack.marker >= markerCount) {
      throw new Error(`Attack on unknown marker ${attack.marker}`);
    }
    if (attack.target !== null && !isShotTarget(attack.target)) throw new Error("Unknown attack target");
    if (!attack.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
    return attack;
  });
}

/** The per-game rule settings a save keeps */
export type SavedRules = Pick<SavedGame, "longRangeDie" | "testMode" | "artilleryCrew" | "figures">;

export function writeSave(
  scenarioId: string,
  faction: Faction,
  rules: SavedRules,
  board: BoardManager,
  state: SessionState
): SavedGame {
  const units: Unit[] = [];
  const savedUnits: SavedUnit[] = [];
  const addUnit = (unit: Unit, position: Position | null) => {
    units.push(unit);
    savedUnits.push({ type: unit.getUnitType(), position, ...(unit.elite && { elite: true as const }) });
  };
  const unitIndex = (unit: Unit) => {
    if (!units.includes(unit)) addUnit(unit, null);
    return units.indexOf(unit);
  };
  board.getAllHexes().forEach((hex) => {
    if (hex.unit) addUnit(hex.unit, hex.getPosition());
  });

  return {
    version: SAVE_VERSION,
    scenarioId,
    faction,
    ...rules,
    turn: state.turn,
    phase: state.phase,
    playedCard: state.playedCard?.id ?? null,
    cardsPlayedOn: { ...state.cardsPlayedOn },
    // Orders and edits first, so units they reference get indexes; the list is read after
    orders: state.orders.map((order) => ({
      unit: unitIndex(order.unit),
      action: order.action,
      start: order.start,
      end: order.end,
      path: order.path ?? null,
      shots: order.shots,
      lostSandbags: order.lostSandbags,
      ...(order.clearedWire && { clearedWire: true }),
    })),
    battleEdits: state.battleEdits.map((edit): SavedGame["battleEdits"][number] => {
      if (edit.kind === "wire" || edit.kind === "sandbags") return edit;
      if (edit.kind === "move") return { ...edit, unit: unitIndex(edit.unit) };
      const beforeOrders = edit.beforeOrders && { beforeOrders: true };
      if (edit.kind === "add") return { kind: "add", position: edit.position, unit: unitIndex(edit.unit), ...beforeOrders };
      return {
        kind: "remove",
        position: edit.position,
        unit: unitIndex(edit.unit),
        ...(edit.replacement && { replacement: unitIndex(edit.replacement) }),
        ...(edit.sandbags && { sandbags: true }),
        ...beforeOrders,
      };
    }),
    unmovedFireSkipped: state.unmovedFireSkipped,
    shots: state.shots.map((shot) => ({
      ...shot,
      steps: [...shot.steps],
      faces: [...shot.faces],
      kept: shot.kept && [...shot.kept],
      notes: [...shot.notes],
      target: { ...shot.target },
    })),
    // Records are plain data that is never mutated, so they can be shared
    log: [...state.log],
    startCoins: state.startCoins,
    coinAdjustments: [...state.coinAdjustments],
    markers: state.markers.map((p) => ({ ...p })),
    cardAttacks: state.cardAttacks.map((attack) => ({
      ...attack,
      target: attack.target && { ...attack.target },
      faces: [...attack.faces],
    })),
    standingCollisions: state.standingCollisions.map((roll) => ({
      ...roll,
      from: { ...roll.from },
      steps: roll.steps.map((step) => ({ ...step })),
      faces: [...roll.faces],
      target: { ...roll.target },
      kept: roll.kept && [...roll.kept],
      notes: [...roll.notes],
    })),
    drops: state.drops.map((p) => ({ ...p })),
    hits: [...state.hits].map(([unit, hits]) => ({ unit: unitIndex(unit), hits })),
    retreatFlags: [...state.retreatFlags].map(([unit, flags]) => ({ unit: unitIndex(unit), flags })),
    retreatsDue: [...state.retreatsDue].map(([unit, flags]) => ({ unit: unitIndex(unit), flags })),
    turnHits: [...state.turnHits].map(([unit, hits]) => ({ unit: unitIndex(unit), hits })),
    camouflaged: [...state.camouflaged].map(unitIndex),
    supplies: [...state.supplies].map(([unit, supplies]) => ({
      unit: unitIndex(unit),
      amounts: { ...supplies.amounts },
      equipment: { ...supplies.equipment },
    })),
    units: savedUnits,
    wire: board.wirePositions(),
    sandbags: board.sandbagPositions(),
  };
}

/**
 * Read a save back, putting its units on `board` in place of the scenario's.
 * Throws on anything that doesn't fit the cards or this version.
 */
export function readSave(saved: SavedGame, board: BoardManager): SessionState {
  if (saved.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version ${(saved as { version: unknown }).version}`);
  }
  if (typeof saved.longRangeDie !== "boolean") throw new Error("Long-range die setting is missing");
  if (typeof saved.testMode !== "boolean") throw new Error("Test mode setting is missing");
  if (typeof saved.artilleryCrew !== "boolean") throw new Error("Artillery crew setting is missing");
  if (typeof saved.figures !== "boolean") throw new Error("Figures setting is missing");
  if (!Object.values(TurnPhase).some((phase) => typeof phase === "number" && phase === saved.phase)) {
    throw new Error(`Unknown phase ${saved.phase}`);
  }

  const card = (id: string) => {
    const found = actionCardById(id);
    if (!found) throw new Error(`Unknown card ${id}`);
    return found;
  };
  const playedOn = saved.cardsPlayedOn;
  if (typeof playedOn !== "object" || playedOn === null) throw new Error("Cards played are missing");
  Object.entries(playedOn).forEach(([id, turn]) => {
    card(id);
    if (!Number.isInteger(turn)) throw new Error(`Unknown turn for card ${id}`);
  });

  board.getAllHexes().forEach((hex) => hex.removeUnit());
  const units = saved.units.map((savedUnit) => {
    if (!isUnitType(savedUnit.type)) throw new Error(`Unknown unit type ${savedUnit.type}`);
    const unit = new Unit(savedUnit.type, savedUnit.elite === true);
    if (savedUnit.position && !board.placeUnitAt(savedUnit.position, unit)) {
      throw new Error(`Can't place unit at ${positionKey(savedUnit.position)}`);
    }
    return unit;
  });
  const unit = (index: number) => {
    if (!units[index]) throw new Error(`Unknown unit ${index}`);
    return units[index];
  };

  board.getAllHexes().forEach((hex) => hex.setWire(false));
  readPositions(saved.wire, "Barbed wire").forEach((position) => {
    const hex = board.getHex(position);
    if (!hex) throw new Error(`No hex for barbed wire at ${positionKey(position)}`);
    hex.setWire(true);
  });
  board.getAllHexes().forEach((hex) => hex.setSandbags(false));
  readPositions(saved.sandbags, "Sandbags").forEach((position) => {
    const hex = board.getHex(position);
    if (!hex) throw new Error(`No hex for sandbags at ${positionKey(position)}`);
    hex.setSandbags(true);
  });

  const orders = saved.orders.map((order) => {
    if (!actionById(order.action)) throw new Error(`Unknown action ${order.action}`);
    return new Order({
      unit: unit(order.unit),
      action: order.action,
      start: order.start,
      end: order.end,
      path: order.path,
      shots: order.shots,
      lostSandbags: readPositions(order.lostSandbags, "Sandbags lost"),
      clearedWire: order.clearedWire === true,
    });
  });

  const faces = new Set<string>(Object.values(DieFace));
  const shots = saved.shots.map((shot) => {
    if (!orders[shot.orderIndex]) throw new Error(`Shot for unknown order ${shot.orderIndex}`);
    if (!shot.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
    if (!isShotTarget(shot.target)) throw new Error("Unknown shot target");
    if (shot.kept !== null && !isKeptList(shot.kept, shot.faces.length)) throw new Error("Unknown kept dice");
    if (shot.removedWire !== undefined && !isPosition(shot.removedWire)) throw new Error("Unknown wire removed");
    if (shot.placed !== undefined && !Number.isInteger(shot.placed)) throw new Error("Unknown dice placed");
    if (shot.pushedBack !== undefined && typeof shot.pushedBack !== "boolean") throw new Error("Unknown push back");
    return shot;
  });

  if (!Array.isArray(saved.log)) throw new Error("Turn log is not a list");
  saved.log.forEach((record) => {
    if (!record.shots.every((shot) => shot.faces.every((face) => faces.has(face)))) {
      throw new Error(`Unknown die face in turn ${record.turn}`);
    }
  });

  const isCount = (value: unknown) => Number.isInteger(value);
  if (!isCount(saved.startCoins)) throw new Error("Coins are not a number");
  if (!Array.isArray(saved.coinAdjustments) || !saved.coinAdjustments.every(isCount)) {
    throw new Error("Coin adjustments are not a list of numbers");
  }

  return {
    turn: saved.turn,
    phase: saved.phase,
    playedCard: saved.playedCard === null ? null : card(saved.playedCard),
    cardsPlayedOn: { ...playedOn },
    orders,
    unmovedFireSkipped: saved.unmovedFireSkipped,
    battleEdits: saved.battleEdits.map((edit): BattleEdit => {
      if (edit.kind === "wire" || edit.kind === "sandbags") return edit;
      if (edit.kind === "move") return { ...edit, unit: unit(edit.unit) };
      const beforeOrders = edit.beforeOrders === true && { beforeOrders: true };
      if (edit.kind === "add") return { kind: "add", position: edit.position, unit: unit(edit.unit), ...beforeOrders };
      return {
        kind: "remove",
        position: edit.position,
        unit: unit(edit.unit),
        ...(edit.replacement !== undefined && { replacement: unit(edit.replacement) }),
        ...(edit.sandbags === true && { sandbags: true }),
        ...beforeOrders,
      };
    }),
    shots,
    log: saved.log,
    startCoins: saved.startCoins,
    coinAdjustments: [...saved.coinAdjustments],
    markers: readPositions(saved.markers, "Markers"),
    cardAttacks: readCardAttacks(saved.cardAttacks, saved.markers.length),
    standingCollisions: readStandingCollisions(saved.standingCollisions),
    hits: readUnitCounts(saved.hits, "hits", unit),
    retreatFlags: readUnitCounts(saved.retreatFlags, "flags", unit),
    retreatsDue: readUnitCounts(saved.retreatsDue, "flags", unit),
    turnHits: readUnitCounts(saved.turnHits ?? [], "hits", unit),
    camouflaged: readUnits(saved.camouflaged, "Camouflaged units", unit),
    supplies: readSupplies(saved.supplies, unit),
    drops: readPositions(saved.drops, "Paradrops"),
  };
}
