// game-core/scenarioDraft.ts
// Editing a map in the map editor. Pure functions: each takes a scenario and gives back a new
// one, never changing the one it's given, so the editor keeps every step for undo and React can
// call them from a reducer. Each returns `false` when the change isn't allowed (a unit or wire
// on water, a badge or sandbags with no unit), and the same scenario when nothing changes.
import { Position, Scenario, Tiles, UnitGroup } from "../types/scenario";
import { HexType, MovementRule } from "../types/hex";
import { FACTIONS, Faction } from "../types/faction";
import { UnitType } from "./unit";
import { DieFace, SixSidedFace } from "./dice";
import { samePosition } from "./position";
import { BOARD_SIZES } from "./scenarioFile";
import { TERRAIN } from "../data/terrain";
import { airSortiesOf, hasBigGuns } from "../data/combatCards";
import type { Lang } from "../i18n/lang";

const SIDE = { Allies: "allies", Axis: "axis" } as const;

/** The Reinforcements table a new map starts with: the one most built-in scenarios use */
export const DEFAULT_REINFORCEMENTS: NonNullable<Scenario["reinforcements"]> = {
  [DieFace.INFANTRY]: UnitType.INFANTRY,
  [DieFace.TANK]: UnitType.TANK,
  [DieFace.GRENADE]: UnitType.INFANTRY,
  [DieFace.SUPPLY]: UnitType.INFANTRY,
  [DieFace.FLAG]: null,
};

/** A new map's id: "map-" and four random letters or digits */
export const newMapId = (random: () => number = Math.random): string =>
  `map-${Array.from({ length: 4 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(random() * 36)]).join("")}`;

/** A new, empty map: all plains, no units, 5 command cards each and the Allies attacking */
export const newDraft = (id: string): Scenario => ({
  id,
  name: { es: "", en: "" },
  description: { es: "", en: "" },
  initialHandSize: { allies: 5, axis: 5 },
  attacker: "Allies",
  tiles: {},
  units: { allies: {}, axis: {} },
  reinforcements: { ...DEFAULT_REINFORCEMENTS },
});

/** A scenario's map and settings to start a new map from, with a new id and "(copia)" after its name */
export const copyDraft = (scenario: Scenario, id: string): Scenario => {
  const { image: _image, ...copy } = structuredClone(scenario);
  return { ...copy, id, name: { es: `${scenario.name.es} (copia)`, en: `${scenario.name.en} (copy)` } };
};

const isOnBoard = ({ row, col }: Position, { rows, cols } = BOARD_SIZES.standard) =>
  row >= 0 && row < rows && col >= 0 && col < cols - (row % 2);

/** A hex's terrain: plains when no list has it */
export const terrainAt = (draft: Scenario, position: Position): HexType =>
  ((Object.entries(draft.tiles) as [HexType, Position[] | undefined][]).find(([, positions]) =>
    positions?.some((p) => samePosition(p, position)),
  )?.[0] ?? HexType.PLAINS);

/** Whether units and wire can't stand on a terrain: a river or a lake */
export const isWater = (type: HexType): boolean => TERRAIN[type].movement === MovementRule.BLOCK;

/** The unit that starts on a hex, and its side */
export const unitAt = (draft: Scenario, position: Position): { faction: Faction; type: UnitType } | null => {
  for (const faction of FACTIONS) {
    const found = (Object.entries(draft.units[SIDE[faction]]) as [UnitType, Position[] | undefined][]).find(([, positions]) =>
      positions?.some((p) => samePosition(p, position)),
    );
    if (found) return { faction, type: found[0] };
  }
  return null;
};

const hasAt = (positions: readonly Position[] | undefined, position: Position) => (positions ?? []).some((p) => samePosition(p, position));
export const hasWire = (draft: Scenario, position: Position) => hasAt(draft.wire, position);
export const hasSandbags = (draft: Scenario, position: Position) => hasAt(draft.sandbags, position);
export const isElite = (draft: Scenario, position: Position) => hasAt(draft.elite, position);

const without = (positions: readonly Position[] | undefined, position: Position) => (positions ?? []).filter((p) => !samePosition(p, position));

/** Lists of hexes by key, without `position` and without the lists left empty */
const groupsWithout = <G extends Tiles | UnitGroup>(groups: G, position: Position): G =>
  Object.fromEntries(
    Object.entries(groups)
      .map(([key, positions]) => [key, without(positions as Position[] | undefined, position)] as const)
      .filter(([, positions]) => positions.length > 0),
  ) as G;

/** The scenario with one of its optional hex lists changed; an empty list is left out */
const withList = (draft: Scenario, key: "wire" | "sandbags" | "elite", positions: Position[]): Scenario => {
  const { [key]: _old, ...rest } = draft;
  return positions.length ? { ...rest, [key]: positions } : rest;
};

/** Without the unit on a hex, and its badge and sandbags */
const withoutUnit = (draft: Scenario, position: Position): Scenario => {
  const units = { allies: groupsWithout(draft.units.allies, position), axis: groupsWithout(draft.units.axis, position) };
  return withList(withList({ ...draft, units }, "sandbags", without(draft.sandbags, position)), "elite", without(draft.elite, position));
};

/**
 * Paint a hex with a terrain (plains clears it). Water takes off the unit and the wire there
 */
export function paintTerrain(draft: Scenario, position: Position, type: HexType): Scenario | false {
  if (!isOnBoard(position)) return false;
  if (terrainAt(draft, position) === type) return draft;
  const tiles = groupsWithout(draft.tiles, position);
  if (type !== HexType.PLAINS) tiles[type] = [...(tiles[type] ?? []), position];
  const painted = { ...draft, tiles };
  return isWater(type) ? withList(withoutUnit(painted, position), "wire", without(draft.wire, position)) : painted;
}

/** Put a unit on a hex, in place of any unit there (and its badge and sandbags); not on water */
export function placeUnit(draft: Scenario, position: Position, faction: Faction, type: UnitType): Scenario | false {
  if (!isOnBoard(position) || isWater(terrainAt(draft, position))) return false;
  const there = unitAt(draft, position);
  if (there?.faction === faction && there.type === type) return draft;
  const cleared = there ? withoutUnit(draft, position) : draft;
  const side = SIDE[faction];
  const group = cleared.units[side];
  return { ...cleared, units: { ...cleared.units, [side]: { ...group, [type]: [...(group[type] ?? []), position] } } };
}

/** Take the unit off a hex, with its badge and sandbags */
export const removeUnit = (draft: Scenario, position: Position): Scenario => (unitAt(draft, position) ? withoutUnit(draft, position) : draft);

const toggleMark = (draft: Scenario, position: Position, key: "sandbags" | "elite"): Scenario | false => {
  if (!unitAt(draft, position)) return false;
  const marks = draft[key];
  return withList(draft, key, hasAt(marks, position) ? without(marks, position) : [...(marks ?? []), position]);
};

/** Make the unit on a hex elite, or not */
export const toggleElite = (draft: Scenario, position: Position) => toggleMark(draft, position, "elite");

/** Give the unit on a hex sandbags, or take them off */
export const toggleSandbags = (draft: Scenario, position: Position) => toggleMark(draft, position, "sandbags");

/** Lay barbed wire on a hex, or take it off; not on water */
export function setWire(draft: Scenario, position: Position, wire: boolean): Scenario | false {
  if (hasWire(draft, position) === wire) return draft;
  if (wire && (!isOnBoard(position) || isWater(terrainAt(draft, position)))) return false;
  return withList(draft, "wire", wire ? [...(draft.wire ?? []), position] : without(draft.wire, position));
}

export const toggleWire = (draft: Scenario, position: Position) => setWire(draft, position, !hasWire(draft, position));

/** Back to plains, with nothing on it */
export function clearHex(draft: Scenario, position: Position): Scenario {
  const plains = paintTerrain(draft, position, HexType.PLAINS);
  const cleared = removeUnit(plains === false ? draft : plains, position);
  const next = setWire(cleared, position, false);
  return next === false ? cleared : next;
}

/** Each side's units by type, and the town hexes (Rattenkrieg is dealt above RATTENKRIEG_MIN_TOWNS) */
export function draftCounts(draft: Scenario) {
  const count = (group: UnitGroup) =>
    Object.fromEntries(Object.values(UnitType).map((type) => [type, group[type]?.length ?? 0])) as Record<UnitType, number>;
  return { allies: count(draft.units.allies), axis: count(draft.units.axis), towns: draft.tiles[HexType.TOWN]?.length ?? 0 };
}

// --- The scenario's settings ------------------------------------------------

/** How far each number in "Datos del escenario" goes */
export const SETTING_LIMITS = {
  handSize: { min: 1, max: 10 },
  airSorties: { min: 0, max: 10 },
  extraDrawTurns: { min: 1, max: 10 },
  paradropUnits: { min: 1, max: 10 },
} as const;

const inLimits = (value: number, { min, max }: { min: number; max: number }) => Number.isInteger(value) && value >= min && value <= max;

const otherSide = (faction: Faction): Faction => (faction === "Allies" ? "Axis" : "Allies");

/** The name or the description in one language */
export function setText(draft: Scenario, field: "name" | "description", lang: Lang, text: string): Scenario {
  if (draft[field][lang] === text) return draft;
  return { ...draft, [field]: { ...draft[field], [lang]: text } };
}

/** The side that plays the extra first turn */
export const setAttacker = (draft: Scenario, attacker: Faction): Scenario =>
  draft.attacker === attacker ? draft : { ...draft, attacker };

/** The command cards a side starts with */
export function setHandSize(draft: Scenario, faction: Faction, cards: number): Scenario | false {
  if (!inLimits(cards, SETTING_LIMITS.handSize)) return false;
  const side = SIDE[faction];
  if (draft.initialHandSize[side] === cards) return draft;
  return { ...draft, initialHandSize: { ...draft.initialHandSize, [side]: cards } };
}

/** The unit a face of the Reinforcements die brings, or none */
export function setReinforcement(draft: Scenario, face: SixSidedFace, unit: UnitType | null): Scenario {
  const table = draft.reinforcements ?? DEFAULT_REINFORCEMENTS;
  if (draft.reinforcements && table[face] === unit) return draft;
  return { ...draft, reinforcements: { ...table, [face]: unit } };
}

/** A side's air sorties (its copies of each air card); left out of the map while both have the usual 1 */
export function setAirSorties(draft: Scenario, faction: Faction, sorties: number): Scenario | false {
  if (!inLimits(sorties, SETTING_LIMITS.airSorties)) return false;
  if (airSortiesOf(draft, faction) === sorties) return draft;
  const airPower = { allies: airSortiesOf(draft, "Allies"), axis: airSortiesOf(draft, "Axis"), [SIDE[faction]]: sorties };
  const { airPower: _old, ...rest } = draft;
  return airPower.allies === 1 && airPower.axis === 1 ? rest : { ...rest, airPower };
}

/** Whether a side has big guns (Cortina de Fuego); left out of the map while both have them */
export function setBigGuns(draft: Scenario, faction: Faction, bigGuns: boolean): Scenario {
  if (hasBigGuns(draft, faction) === bigGuns) return draft;
  const sides = FACTIONS.filter((each) => (each === faction ? bigGuns : hasBigGuns(draft, each)));
  const { bigGuns: _old, ...rest } = draft;
  return sides.length === FACTIONS.length ? rest : { ...rest, bigGuns: sides };
}

/** What the extra draws start as when they're turned on: the defender, surprised, for 2 turns */
export const defaultExtraDraws = (draft: Scenario): NonNullable<Scenario["extraDraws"]> => ({
  faction: otherSide(draft.attacker),
  turns: 2,
});

/** What the paradrop starts as when it's turned on: 4 of the attacker's infantry, as at Sainte-Mère-Église */
export const defaultParadrop = (draft: Scenario): NonNullable<Scenario["paradrop"]> => ({
  faction: draft.attacker,
  unitType: UnitType.INFANTRY,
  units: 4,
});

/** One side draws 2 command cards in its first turns, or (null) neither */
export function setExtraDraws(draft: Scenario, extraDraws: Scenario["extraDraws"] | null): Scenario | false {
  if (extraDraws && !inLimits(extraDraws.turns, SETTING_LIMITS.extraDrawTurns)) return false;
  if (JSON.stringify(draft.extraDraws ?? null) === JSON.stringify(extraDraws ?? null)) return draft;
  const { extraDraws: _old, ...rest } = draft;
  return extraDraws ? { ...rest, extraDraws } : rest;
}

/** One side drops units by parachute before the first turn, or (null) neither */
export function setParadrop(draft: Scenario, paradrop: Scenario["paradrop"] | null): Scenario | false {
  if (paradrop && !inLimits(paradrop.units, SETTING_LIMITS.paradropUnits)) return false;
  if (JSON.stringify(draft.paradrop ?? null) === JSON.stringify(paradrop ?? null)) return draft;
  const { paradrop: _old, ...rest } = draft;
  return paradrop ? { ...rest, paradrop } : rest;
}

// --- Tools ------------------------------------------------------------------

/** What the editor puts on the hexes it's tapped on */
export type EditorTool =
  | { kind: "terrain"; type: HexType }
  | { kind: "unit"; faction: Faction; type: UnitType }
  | { kind: "elite" }
  | { kind: "sandbags" }
  | { kind: "wire" }
  | { kind: "erase" };

/** What a tool does on each hex of one stroke of the finger (or a tap: a stroke of one hex) */
export interface Stroke {
  apply: (draft: Scenario, position: Position) => Scenario | false;
  /** It carries on to the hexes the finger slides over */
  drags: boolean;
}

/**
 * What a tool does in a stroke, decided on its first hex: on a hex that already has what the tool
 * puts, it takes it off (a forest tool on a forest leaves plains), and so on every hex of the
 * stroke. Terrain, wire and the eraser carry on as the finger slides; a unit, a badge or sandbags
 * only go on the first hex.
 */
export function strokeOf(tool: EditorTool, draft: Scenario, first: Position): Stroke {
  switch (tool.kind) {
    case "terrain": {
      const type = terrainAt(draft, first) === tool.type ? HexType.PLAINS : tool.type;
      return { drags: true, apply: (d, p) => paintTerrain(d, p, type) };
    }
    case "wire": {
      const wire = !hasWire(draft, first);
      return { drags: true, apply: (d, p) => setWire(d, p, wire) };
    }
    case "erase":
      return { drags: true, apply: clearHex };
    case "unit": {
      const there = unitAt(draft, first);
      const same = there?.faction === tool.faction && there.type === tool.type;
      return { drags: false, apply: (d, p) => (same ? removeUnit(d, p) : placeUnit(d, p, tool.faction, tool.type)) };
    }
    case "elite":
      return { drags: false, apply: toggleElite };
    case "sandbags":
      return { drags: false, apply: toggleSandbags };
  }
}

// --- Undo and redo ----------------------------------------------------------

/** Every step of the editing, for undo and redo */
export interface DraftHistory {
  past: Scenario[];
  present: Scenario;
  future: Scenario[];
}

/** Steps kept for undo */
export const HISTORY_LIMIT = 200;

export const startHistory = (draft: Scenario): DraftHistory => ({ past: [], present: draft, future: [] });

/**
 * A new step. With `amend`, it replaces the last one instead, so a stroke of the finger across
 * several hexes is undone in one go. A step that changes nothing isn't kept
 */
export function recordStep(history: DraftHistory, next: Scenario, amend = false): DraftHistory {
  if (next === history.present) return history;
  if (amend) return { ...history, present: next, future: [] };
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

export function undoStep(history: DraftHistory): DraftHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoStep(history: DraftHistory): DraftHistory {
  const [next, ...future] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future };
}
