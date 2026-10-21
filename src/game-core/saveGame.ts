// game-core/saveGame.ts
// A GameSession as plain JSON, so the game survives a page reload or the
// tablet dropping the tab. Cards are saved by id, units by their index in
// `units`, so orders and battle edits keep pointing at the same objects.
import BoardManager from "./BoardManager";
import CommandCard, { Section, isSection } from "./commandCard";
import Order from "./order";
import Unit, { UnitType, isUnitType } from "./unit";
import { DIE_KINDS, DieFace } from "./dice";
import type { ShotTarget } from "../data/hitRules";
import { isKeptList } from "./rollResult";
import { positionKey } from "./position";
import { TurnPhase } from "../types/gameManager";
import { Faction } from "../types/faction";
import { Position } from "../types/scenario";
import type { Assignment, BattleEdit, CardAttack, SectionPlay, Shot, StandingCollisionRoll } from "./gameSession";
import { TurnRecord } from "./turnLog";
import { RewardChoice, isRewardChoice } from "./coins";
import type { CombatCard } from "./combatCard";

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
  /** Test mode: every combat card in hand (the session's `testMode`) */
  testMode: boolean;
  /** Experimental rule: destroyed artillery turns into infantry (the session's `artilleryCrew`) */
  artilleryCrew: boolean;
  /** Pass and play: units have figures and take hits (the session's `figures`) */
  figures: boolean;
  /** The sections variant: no command cards, orders by section (the session's `sectionOrders`) */
  sectionOrders: boolean;
  /** Hits each damaged unit has taken, by unit index */
  hits: { unit: number; hits: number }[];
  /** Flags each unit took this turn (one pins it, each more makes it retreat), by unit index */
  retreatFlags: { unit: number; flags: number }[];
  /** Hexes each unit must still retreat now, by unit index */
  retreatsDue: { unit: number; flags: number }[];
  /** Hits each unit took this turn, by unit index; missing in older saves */
  turnHits?: { unit: number; hits: number }[];
  /** Infantry-symbol hits each unit ignored this turn with Personal Armor, by unit index */
  armorHits: { unit: number; hits: number }[];
  /** Units with the camouflage badge, by unit index */
  camouflaged: number[];
  turn: number;
  phase: TurnPhase;
  drawPile: string[];
  discardPile: string[];
  hand: string[];
  chosenCard: string | null;
  chosenSection: Section | null;
  /** The sections variant: the cards played for the earlier sections this turn */
  plays: { card: string; section: Section; orders: number; combatCards: number }[];
  /** The cards drawn in the final phase */
  drawnCards: string[];
  drawnCard: string | null;
  extraDrawn: string | null;
  drawOptions: string[];
  drewAgain: boolean;
  units: SavedUnit[];
  /** Hexes that still have barbed wire */
  wire: Position[];
  /** Hexes with sandbags */
  sandbags: Position[];
  orders: {
    unit: number;
    start: Position;
    end: Position;
    path: Position[] | null;
    shots: number;
    section: Section | null;
    onTheMove: boolean;
    extra: boolean;
    cost: number;
    /** The combat card whose movement it used, by id */
    boostCard: string | null;
    closeAssaultOnly: boolean;
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
  rewardChoice: RewardChoice | null;
  combatDrawPile: string[];
  combatDiscardPile: string[];
  combatHand: string[];
  /** The combat cards played with the command card, in order */
  combatCardsPlayed: string[];
  markers: Position[];
  cardAttacks: CardAttack[];
  /** Cards given to a unit: the card's id and the unit's index */
  assignments: { card: string; unit: number; healed?: number }[];
  standingCollisions: StandingCollisionRoll[];
  drawnCombatCard: string | null;
  drops: Position[];
}

/** Everything a GameSession keeps between actions, apart from the board's units */
export interface SessionState {
  turn: number;
  phase: TurnPhase;
  drawPile: readonly CommandCard[];
  discardPile: readonly CommandCard[];
  hand: CommandCard[];
  chosenCard: CommandCard | null;
  chosenSection: Section | null;
  plays: readonly SectionPlay[];
  drawnCards: readonly CommandCard[];
  drawnCard: CommandCard | null;
  /** The scenario's second card drawn this turn (already in the hand) */
  extraDrawn: CommandCard | null;
  drawOptions: CommandCard[];
  drewAgain: boolean;
  orders: Order[];
  unmovedFireSkipped: boolean;
  battleEdits: BattleEdit[];
  shots: Shot[];
  log: TurnRecord[];
  /** Coins at the start of this turn */
  startCoins: number;
  coinAdjustments: number[];
  rewardChoice: RewardChoice | null;
  combatDrawPile: readonly CombatCard[];
  combatDiscardPile: readonly CombatCard[];
  combatHand: CombatCard[];
  /** The combat cards played with the command card, in order */
  combatCardsPlayed: CombatCard[];
  /** Hexes marked for the combat cards played, each card's in turn */
  markers: Position[];
  cardAttacks: CardAttack[];
  /** The cards played that were given to a unit */
  assignments: Assignment[];
  /** Pass and play: collision rolls of units without an order */
  standingCollisions: readonly StandingCollisionRoll[];
  /** Drawn in the final phase (it is already in the hand, unless discarded) */
  drawnCombatCard: CombatCard | null;
  /** Pass and play: hits taken, by unit (it keeps them from turn to turn) */
  hits: ReadonlyMap<Unit, number>;
  /** Pass and play: flags the unit took this turn (one pins it) */
  retreatFlags: ReadonlyMap<Unit, number>;
  /** Pass and play: hexes the unit must still retreat now */
  retreatsDue: ReadonlyMap<Unit, number>;
  /** Pass and play: hits taken this turn, by unit */
  turnHits: ReadonlyMap<Unit, number>;
  /** Pass and play: infantry-symbol hits ignored this turn with Personal Armor, by unit */
  armorHits: ReadonlyMap<Unit, number>;
  /** Units with the camouflage badge, kept from turn to turn */
  camouflaged: ReadonlySet<Unit>;
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

function readBoostCard(card: unknown): string | null {
  if (card !== null && typeof card !== "string") throw new Error("Unknown boost card");
  return card;
}

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
export type SavedRules = Pick<SavedGame, "longRangeDie" | "testMode" | "artilleryCrew" | "figures" | "sectionOrders">;

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

  const ids = (cards: readonly { id: string }[]) => cards.map((card) => card.id);
  return {
    version: SAVE_VERSION,
    scenarioId,
    faction,
    ...rules,
    turn: state.turn,
    phase: state.phase,
    drawPile: ids(state.drawPile),
    discardPile: ids(state.discardPile),
    hand: ids(state.hand),
    chosenCard: state.chosenCard?.id ?? null,
    chosenSection: state.chosenSection,
    plays: state.plays.map((play) => ({ ...play, card: play.card.id })),
    drawnCards: ids(state.drawnCards),
    drawnCard: state.drawnCard?.id ?? null,
    extraDrawn: state.extraDrawn?.id ?? null,
    drawOptions: ids(state.drawOptions),
    drewAgain: state.drewAgain,
    // Orders and edits first, so units they reference get indexes; the list is read after
    orders: state.orders.map((order) => ({
      unit: unitIndex(order.unit),
      start: order.start,
      end: order.end,
      path: order.path ?? null,
      shots: order.shots,
      section: order.section,
      onTheMove: order.onTheMove,
      extra: order.extra,
      cost: order.cost,
      boostCard: order.boostCard,
      closeAssaultOnly: order.closeAssaultOnly,
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
    rewardChoice: state.rewardChoice,
    combatDrawPile: ids(state.combatDrawPile),
    combatDiscardPile: ids(state.combatDiscardPile),
    combatHand: ids(state.combatHand),
    combatCardsPlayed: ids(state.combatCardsPlayed),
    markers: state.markers.map((p) => ({ ...p })),
    cardAttacks: state.cardAttacks.map((attack) => ({
      ...attack,
      target: attack.target && { ...attack.target },
      faces: [...attack.faces],
    })),
    assignments: state.assignments.map(({ card, unit, healed }) => ({ card: card.id, unit: unitIndex(unit), ...(healed !== undefined && { healed }) })),
    standingCollisions: state.standingCollisions.map((roll) => ({
      ...roll,
      from: { ...roll.from },
      steps: roll.steps.map((step) => ({ ...step })),
      faces: [...roll.faces],
      target: { ...roll.target },
      kept: roll.kept && [...roll.kept],
      notes: [...roll.notes],
    })),
    drawnCombatCard: state.drawnCombatCard?.id ?? null,
    drops: state.drops.map((p) => ({ ...p })),
    hits: [...state.hits].map(([unit, hits]) => ({ unit: unitIndex(unit), hits })),
    retreatFlags: [...state.retreatFlags].map(([unit, flags]) => ({ unit: unitIndex(unit), flags })),
    retreatsDue: [...state.retreatsDue].map(([unit, flags]) => ({ unit: unitIndex(unit), flags })),
    turnHits: [...state.turnHits].map(([unit, hits]) => ({ unit: unitIndex(unit), hits })),
    armorHits: [...state.armorHits].map(([unit, hits]) => ({ unit: unitIndex(unit), hits })),
    camouflaged: [...state.camouflaged].map(unitIndex),
    units: savedUnits,
    wire: board.wirePositions(),
    sandbags: board.sandbagPositions(),
  };
}

/**
 * Read a save back, putting its units on `board` in place of the scenario's.
 * Throws on anything that doesn't fit these cards or this version.
 */
export function readSave(
  saved: SavedGame,
  board: BoardManager,
  commandCards: readonly CommandCard[],
  combatCards: readonly CombatCard[]
): SessionState {
  if (saved.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version ${(saved as { version: unknown }).version}`);
  }
  if (typeof saved.longRangeDie !== "boolean") throw new Error("Long-range die setting is missing");
  if (typeof saved.testMode !== "boolean") throw new Error("Test mode setting is missing");
  if (typeof saved.artilleryCrew !== "boolean") throw new Error("Artillery crew setting is missing");
  if (typeof saved.figures !== "boolean") throw new Error("Figures setting is missing");
  if (typeof saved.sectionOrders !== "boolean") throw new Error("Sections variant setting is missing");
  if (!Object.values(TurnPhase).some((phase) => typeof phase === "number" && phase === saved.phase)) {
    throw new Error(`Unknown phase ${saved.phase}`);
  }

  const cardsById = new Map(commandCards.map((card) => [card.id, card]));
  const card = (id: string) => {
    const found = cardsById.get(id);
    if (!found) throw new Error(`Unknown card ${id}`);
    return found;
  };
  const cards = (ids: string[]) => ids.map(card);
  const combatById = new Map(combatCards.map((card) => [card.id, card]));
  const combatCard = (id: string) => {
    const found = combatById.get(id);
    if (!found) throw new Error(`Unknown combat card ${id}`);
    return found;
  };
  const combatCardOrNull = (id: string | null) => (id === null ? null : combatCard(id));
  const section = (value: Section | null) => {
    if (value !== null && !isSection(value)) throw new Error(`Unknown section ${value}`);
    return value;
  };

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

  const hand = cards(saved.hand);
  const drawnCard = saved.drawnCard === null ? null : card(saved.drawnCard);
  if (drawnCard && !hand.includes(drawnCard)) throw new Error("Drawn card not in hand");
  const extraDrawn = saved.extraDrawn === null ? null : card(saved.extraDrawn);
  if (extraDrawn && !hand.includes(extraDrawn)) throw new Error("Extra card not in hand");

  const orders = saved.orders.map(
    (order) =>
      new Order({
        unit: unit(order.unit),
        start: order.start,
        end: order.end,
        path: order.path,
        shots: order.shots,
        section: section(order.section),
        onTheMove: order.onTheMove,
        extra: order.extra,
        cost: order.cost,
        boostCard: readBoostCard(order.boostCard),
        closeAssaultOnly: order.closeAssaultOnly,
        lostSandbags: readPositions(order.lostSandbags, "Sandbags lost"),
        clearedWire: order.clearedWire === true,
      })
  );

  const faces = new Set<string>(Object.values(DieFace));
  const shots = saved.shots.map((shot) => {
    if (!orders[shot.orderIndex]) throw new Error(`Shot for unknown order ${shot.orderIndex}`);
    if (!shot.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
    if (!isShotTarget(shot.target)) throw new Error("Unknown shot target");
    if (shot.kept !== null && !isKeptList(shot.kept, shot.faces.length)) throw new Error("Unknown kept dice");
    if (shot.removedWire !== undefined && !isPosition(shot.removedWire)) throw new Error("Unknown wire removed");
    if (shot.fortified !== undefined && !isPosition(shot.fortified)) throw new Error("Unknown hex fortified");
    const isOrder = (order: unknown) => Number.isInteger(order) && !!orders[order as number];
    if (shot.joined !== undefined && !(Array.isArray(shot.joined) && shot.joined.every(isOrder))) throw new Error("Unknown joined units");
    if (shot.joinedTo !== undefined && !isOrder(shot.joinedTo)) throw new Error("Unknown lead unit");
    if (shot.group !== undefined && !Number.isInteger(shot.group)) throw new Error("Unknown shot group");
    if (shot.kinds !== undefined && !(Array.isArray(shot.kinds) && shot.kinds.length === shot.faces.length && shot.kinds.every((kind) => DIE_KINDS.includes(kind)))) {
      throw new Error("Unknown dice kinds");
    }
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
  if (saved.rewardChoice !== null && !isRewardChoice(saved.rewardChoice)) {
    throw new Error(`Unknown reward ${saved.rewardChoice}`);
  }

  return {
    turn: saved.turn,
    phase: saved.phase,
    drawPile: cards(saved.drawPile),
    discardPile: cards(saved.discardPile),
    hand,
    chosenCard: saved.chosenCard === null ? null : card(saved.chosenCard),
    chosenSection: section(saved.chosenSection),
    plays: saved.plays.map((play) => {
      const played = section(play.section);
      if (!played || !Number.isInteger(play.orders) || !Number.isInteger(play.combatCards)) throw new Error("Unknown section play");
      return { card: card(play.card), section: played, orders: play.orders, combatCards: play.combatCards };
    }),
    drawnCards: cards(saved.drawnCards),
    drawnCard,
    extraDrawn,
    drawOptions: cards(saved.drawOptions),
    drewAgain: saved.drewAgain === true,
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
    rewardChoice: saved.rewardChoice,
    combatDrawPile: saved.combatDrawPile.map(combatCard),
    combatDiscardPile: saved.combatDiscardPile.map(combatCard),
    combatHand: saved.combatHand.map(combatCard),
    combatCardsPlayed: saved.combatCardsPlayed.map(combatCard),
    markers: readPositions(saved.markers, "Markers"),
    cardAttacks: readCardAttacks(saved.cardAttacks, saved.markers.length),
    assignments: saved.assignments.map((assignment) => ({
      card: combatCard(assignment.card),
      unit: unit(assignment.unit),
      ...(assignment.healed !== undefined && { healed: assignment.healed }),
    })),
    standingCollisions: readStandingCollisions(saved.standingCollisions),
    hits: readUnitCounts(saved.hits, "hits", unit),
    retreatFlags: readUnitCounts(saved.retreatFlags, "flags", unit),
    retreatsDue: readUnitCounts(saved.retreatsDue, "flags", unit),
    turnHits: readUnitCounts(saved.turnHits ?? [], "hits", unit),
    armorHits: readUnitCounts(saved.armorHits, "hits", unit),
    camouflaged: readUnits(saved.camouflaged, "Camouflaged units", unit),
    drawnCombatCard: combatCardOrNull(saved.drawnCombatCard),
    drops: readPositions(saved.drops, "Paradrops"),
  };
}
