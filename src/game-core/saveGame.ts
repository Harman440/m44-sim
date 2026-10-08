// game-core/saveGame.ts
// A GameSession as plain JSON, so the game survives a page reload or the
// tablet dropping the tab. Cards are saved by id, units by their index in
// `units`, so orders and battle edits keep pointing at the same objects.
import BoardManager from "./BoardManager";
import CommandCard, { Section, isSection } from "./commandCard";
import Order from "./order";
import Unit, { UnitType, isUnitType } from "./unit";
import { DIE_KINDS, DieFace, SIX_SIDED_FACES, SixSidedFace } from "./dice";
import type { ShotTarget } from "../data/hitRules";
import { isKeptList } from "./rollResult";
import { positionKey } from "./position";
import { TurnPhase } from "../types/gameManager";
import { Faction } from "../types/faction";
import { Position } from "../types/scenario";
import type { AmbushShot, BattleEdit, CardAttack, Shot } from "./gameSession";
import { TurnRecord, copyAmbush } from "./turnLog";
import { RewardChoice, isRewardChoice } from "./coins";
import type { CombatCard } from "./combatCard";

/** Bump when SavedGame changes shape; older saves are dropped instead of misread */
export const SAVE_VERSION = 27;

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
  turn: number;
  phase: TurnPhase;
  drawPile: string[];
  discardPile: string[];
  hand: string[];
  chosenCard: string | null;
  chosenSection: Section | null;
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
    boosted: boolean;
    closeAssaultOnly: boolean;
    lostSandbags: Position[];
  }[];
  unmovedFireSkipped: boolean;
  battleEdits: ((
    | { kind: "remove"; position: Position; unit: number; replacement?: number; sandbags?: boolean }
    | { kind: "move"; from: Position; to: Position; sandbags?: Position[] }
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
  orderCombatCard: string | null;
  markers: Position[];
  cardAttacks: CardAttack[];
  battleCombatCard: string | null;
  ambush: AmbushShot | null;
  drawnCombatCard: string | null;
  drops: Position[];
  reinforcementFace: SixSidedFace | null;
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
  orderCombatCard: CombatCard | null;
  /** Hexes marked for the order combat card */
  markers: Position[];
  cardAttacks: CardAttack[];
  battleCombatCard: CombatCard | null;
  /** The Ambush card's shot */
  ambush: AmbushShot | null;
  /** Drawn in the final phase (it is already in the hand, unless discarded) */
  drawnCombatCard: CombatCard | null;
  /** Paratroopers placed before the first turn, in order (the units are on the board) */
  drops: Position[];
  /** The Reinforcements die, rolled in the final phase */
  reinforcementFace: SixSidedFace | null;
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

function readAmbush(ambush: unknown): AmbushShot | null {
  if (ambush === null) return null;
  const shot = ambush as AmbushShot;
  const faces = new Set<string>(Object.values(DieFace));
  if (!isPosition(shot?.from) || !isPosition(shot.targetPosition)) throw new Error("Unknown ambush hexes");
  if (!isUnitType(shot.unitType) || !isShotTarget(shot.target)) throw new Error("Unknown ambush units");
  if (!Array.isArray(shot.faces) || !shot.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
  if (shot.kept !== null && !isKeptList(shot.kept, shot.faces.length)) throw new Error("Unknown kept dice");
  return shot;
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
export type SavedRules = Pick<SavedGame, "longRangeDie" | "testMode" | "artilleryCrew">;

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
      boosted: order.boosted,
      closeAssaultOnly: order.closeAssaultOnly,
      lostSandbags: order.lostSandbags,
    })),
    battleEdits: state.battleEdits.map((edit): SavedGame["battleEdits"][number] => {
      if (edit.kind === "move" || edit.kind === "wire" || edit.kind === "sandbags") return edit;
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
    orderCombatCard: state.orderCombatCard?.id ?? null,
    markers: state.markers.map((p) => ({ ...p })),
    cardAttacks: state.cardAttacks.map((attack) => ({
      ...attack,
      target: attack.target && { ...attack.target },
      faces: [...attack.faces],
    })),
    battleCombatCard: state.battleCombatCard?.id ?? null,
    ambush: state.ambush && copyAmbush(state.ambush),
    drawnCombatCard: state.drawnCombatCard?.id ?? null,
    drops: state.drops.map((p) => ({ ...p })),
    reinforcementFace: state.reinforcementFace,
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
        boosted: order.boosted,
        closeAssaultOnly: order.closeAssaultOnly,
        lostSandbags: readPositions(order.lostSandbags, "Sandbags lost"),
      })
  );

  const faces = new Set<string>(Object.values(DieFace));
  const shots = saved.shots.map((shot) => {
    if (!orders[shot.orderIndex]) throw new Error(`Shot for unknown order ${shot.orderIndex}`);
    if (!shot.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
    if (!isShotTarget(shot.target)) throw new Error("Unknown shot target");
    if (shot.kept !== null && !isKeptList(shot.kept, shot.faces.length)) throw new Error("Unknown kept dice");
    if (shot.removedWire !== undefined && !isPosition(shot.removedWire)) throw new Error("Unknown wire removed");
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

  const { reinforcementFace } = saved;
  if (reinforcementFace !== null && !SIX_SIDED_FACES.includes(reinforcementFace)) {
    throw new Error(`Unknown reinforcement roll ${reinforcementFace}`);
  }

  return {
    turn: saved.turn,
    phase: saved.phase,
    drawPile: cards(saved.drawPile),
    discardPile: cards(saved.discardPile),
    hand,
    chosenCard: saved.chosenCard === null ? null : card(saved.chosenCard),
    chosenSection: section(saved.chosenSection),
    drawnCard,
    extraDrawn,
    drawOptions: cards(saved.drawOptions),
    drewAgain: saved.drewAgain === true,
    orders,
    unmovedFireSkipped: saved.unmovedFireSkipped,
    battleEdits: saved.battleEdits.map((edit): BattleEdit => {
      if (edit.kind === "move" || edit.kind === "wire" || edit.kind === "sandbags") return edit;
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
    orderCombatCard: combatCardOrNull(saved.orderCombatCard),
    markers: readPositions(saved.markers, "Markers"),
    cardAttacks: readCardAttacks(saved.cardAttacks, saved.markers.length),
    battleCombatCard: combatCardOrNull(saved.battleCombatCard),
    ambush: readAmbush(saved.ambush),
    drawnCombatCard: combatCardOrNull(saved.drawnCombatCard),
    drops: readPositions(saved.drops, "Paradrops"),
    reinforcementFace,
  };
}
