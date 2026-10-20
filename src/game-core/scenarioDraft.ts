// game-core/scenarioDraft.ts
// Editing a map in the map editor. Pure functions: each takes a scenario and gives back a new
// one, never changing the one it's given, so the editor keeps every step for undo and React can
// call them from a reducer. Each returns `false` when the change isn't allowed (a unit or wire
// on water, a badge or sandbags with no unit), and the same scenario when nothing changes.
import { Objective, PickedTile, Position, Scenario, Tiles, UnitGroup, Victory } from "../types/scenario";
import { HexType, MovementRule } from "../types/hex";
import { FACTIONS, Faction } from "../types/faction";
import { UnitType } from "./unit";
import { samePosition } from "./position";
import { BoardSize, boardPositions, boardSizeOf, isBoardSize, isOnBoard as isOnSize, isStandardBoard } from "./boardSize";
import { TERRAIN } from "../data/terrain";
import { airSortiesOf, hasBigGuns } from "../data/combatCards";
import type { Lang, Localized } from "../i18n/lang";

const SIDE = { Allies: "allies", Axis: "axis" } as const;

// --- Ids ------------------------------------------------------------------------
// A map's id is its name as lower-case words and a short random part ("bocage-3f9k"), so both
// tablets and the catalog know it's the same map, and two maps of the same name stay apart. A new
// map is "map-" and the random part until it leaves the editor with a name; from then on its id
// stays the same, even when it's renamed.

const randomPart = (random: () => number) =>
  Array.from({ length: 4 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(random() * 36)]).join("");

/** A new map's id until it has a name: "map-" and four random letters or digits */
export const newMapId = (random: () => number = Math.random): string => `map-${randomPart(random)}`;

/** Whether a map's id is still the one it was made with, to be replaced by one from its name */
export const isProvisionalId = (id: string): boolean => /^map-[a-z0-9]{4}$/.test(id);

/** Longest the name part of an id gets */
const SLUG_LENGTH = 40;

/** A name as lower-case words joined by hyphens, without accents: "Forêt d'Écouves" → "foret-d-ecouves" */
export function slugOf(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let slug = "";
  for (const word of words) {
    const longer = slug ? `${slug}-${word}` : word;
    if (longer.length > SLUG_LENGTH) break;
    slug = longer;
  }
  return slug || words[0]?.slice(0, SLUG_LENGTH) || "map";
}

/** Whether a map has a name in some language */
export const hasName = (draft: Scenario): boolean => Boolean(draft.name.es.trim() || draft.name.en.trim());

/**
 * The id a map keeps from its name (the English one first, as the catalog's are): its slug and
 * the random part of the id it has, or a new random part when that id is `taken` already
 */
export function mapIdFor(draft: Scenario, taken: (id: string) => boolean, random: () => number = Math.random): string {
  const slug = slugOf(draft.name.en.trim() || draft.name.es);
  const own = /-([a-z0-9]{4})$/.exec(draft.id)?.[1];
  let id = `${slug}-${own ?? randomPart(random)}`;
  while (id !== draft.id && taken(id)) id = `${slug}-${randomPart(random)}`;
  return id;
}

/** A map with nothing on it yet: no terrain, units, wire, name or description (a new one isn't kept) */
export const isBlank = (draft: Scenario): boolean =>
  Object.keys(draft.tiles).length === 0 &&
  Object.keys(draft.units.allies).length === 0 &&
  Object.keys(draft.units.axis).length === 0 &&
  !draft.wire?.length &&
  !draft.victory?.objectives?.length &&
  !hasName(draft) &&
  !draft.description.es.trim() &&
  !draft.description.en.trim();

/** A new, empty map: all plains, no units, 5 command cards each and the Allies attacking */
export const newDraft = (id: string): Scenario => ({
  id,
  name: { es: "", en: "" },
  description: { es: "", en: "" },
  initialHandSize: { allies: 5, axis: 5 },
  attacker: "Allies",
  tiles: {},
  units: { allies: {}, axis: {} },
});

/** A scenario's map and settings to start a new map from, with a new id and "(copia)" after its name */
export const copyDraft = (scenario: Scenario, id: string): Scenario => {
  const { image: _image, ...copy } = structuredClone(scenario);
  const { es, en } = scenario.name;
  return { ...copy, id, name: { es: es.trim() ? `${es} (copia)` : "", en: en.trim() ? `${en} (copy)` : "" } };
};

const isOnBoard = (draft: Scenario, position: Position) => isOnSize(position, boardSizeOf(draft));

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

/** The painted tile picked for a hex (Scenario.pickedTiles), if one was */
export const pickedTileAt = (draft: Scenario, position: Position): string | undefined =>
  draft.pickedTiles?.find((p) => samePosition(p, position))?.tile;

/** The scenario with its picked tiles changed; none left leaves the list out */
const withPicked = (draft: Scenario, picked: PickedTile[]): Scenario => {
  const { pickedTiles: _old, ...rest } = draft;
  return picked.length ? { ...rest, pickedTiles: picked } : rest;
};

/**
 * Paint a hex with a terrain (plains clears it), with `tile`, one of the library's tiles for it
 * (tilesFor in boardArt/drawBoard.ts), or the tile its hex picks. Water takes off the unit, the
 * wire and the objectives there
 */
export function paintTerrain(draft: Scenario, position: Position, type: HexType, tile?: string): Scenario | false {
  if (!isOnBoard(draft, position)) return false;
  const sameTerrain = terrainAt(draft, position) === type;
  if (sameTerrain && (tile === undefined || pickedTileAt(draft, position) === tile)) return draft;
  const tiles = sameTerrain ? draft.tiles : groupsWithout(draft.tiles, position);
  if (!sameTerrain && type !== HexType.PLAINS) tiles[type] = [...(tiles[type] ?? []), position];
  const picked = (draft.pickedTiles ?? []).filter((p) => !samePosition(p, position));
  if (tile !== undefined && type !== HexType.PLAINS) picked.push({ row: position.row, col: position.col, tile });
  const painted = withPicked({ ...draft, tiles }, picked);
  if (!isWater(type)) return painted;
  return withoutObjectivesAt(withList(withoutUnit(painted, position), "wire", without(draft.wire, position)), position);
}

/** Put a unit on a hex, in place of any unit there (and its badge and sandbags); not on water */
export function placeUnit(draft: Scenario, position: Position, faction: Faction, type: UnitType): Scenario | false {
  if (!isOnBoard(draft, position) || isWater(terrainAt(draft, position))) return false;
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
  if (wire && (!isOnBoard(draft, position) || isWater(terrainAt(draft, position)))) return false;
  return withList(draft, "wire", wire ? [...(draft.wire ?? []), position] : without(draft.wire, position));
}

export const toggleWire = (draft: Scenario, position: Position) => setWire(draft, position, !hasWire(draft, position));

/** Back to plains, with nothing on it, and an objective of neither side */
export function clearHex(draft: Scenario, position: Position): Scenario {
  const plains = paintTerrain(draft, position, HexType.PLAINS);
  const cleared = removeUnit(plains === false ? draft : plains, position);
  const next = setWire(cleared, position, false);
  return withoutObjectivesAt(next === false ? cleared : next, position);
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
  victoryMedals: { min: 1, max: 20 },
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

/** The map's rivers can be forded (house rule), or not; left out of the map when not */
export function setFordableRivers(draft: Scenario, on: boolean): Scenario {
  if (!!draft.fordableRivers === on) return draft;
  const { fordableRivers: _old, ...rest } = draft;
  return on ? { ...rest, fordableRivers: true } : rest;
}

// --- Victory --------------------------------------------------------------------
// The medals to win and each side's objectives. The objectives are put on the map with the
// objective tool, one hex each, named "Objetivo N" until the player names them; an objective of
// several hexes (from a copied scenario) loses only the hex taken off it.

/** The medals to win when the victory conditions are turned on: 5, as in most of the house scenarios */
export const DEFAULT_VICTORY_MEDALS = 5;

/** The scenario with other victory conditions, or (null) none; objectives left empty are dropped */
const withVictory = (draft: Scenario, victory: Victory | null): Scenario => {
  const { victory: _old, ...rest } = draft;
  if (!victory) return rest;
  const objectives = (victory.objectives ?? []).filter((objective) => objective.hexes.length > 0);
  return { ...rest, victory: objectives.length ? { medals: victory.medals, objectives } : { medals: victory.medals } };
};

/** Turn the victory conditions on (with the default medals and no objectives) or off, objectives and all */
export function setVictory(draft: Scenario, on: boolean): Scenario {
  if (!!draft.victory === on) return draft;
  return withVictory(draft, on ? { medals: DEFAULT_VICTORY_MEDALS } : null);
}

/** The medals to win; the victory conditions must be on */
export function setVictoryMedals(draft: Scenario, medals: number): Scenario | false {
  if (!draft.victory || !inLimits(medals, SETTING_LIMITS.victoryMedals)) return false;
  if (draft.victory.medals === medals) return draft;
  return { ...draft, victory: { ...draft.victory, medals } };
}

/** The objectives a hex is one of, any side's */
export const objectivesAt = (draft: Scenario, position: Position): Objective[] =>
  (draft.victory?.objectives ?? []).filter((objective) => hasAt(objective.hexes, position));

/** Whether a hex is one of a side's objectives */
export const isObjective = (draft: Scenario, position: Position, faction: Faction): boolean =>
  objectivesAt(draft, position).some((objective) => objective.faction === faction);

/** A new objective's name: the first "Objetivo N" the side hasn't used */
function newObjectiveName(draft: Scenario, faction: Faction): Localized {
  const used = new Set((draft.victory?.objectives ?? []).filter((o) => o.faction === faction).map((o) => o.name.en));
  let n = 1;
  while (used.has(`Objective ${n}`)) n++;
  return { es: `Objetivo ${n}`, en: `Objective ${n}` };
}

/** Without a hex in any side's objectives */
function withoutObjectivesAt(draft: Scenario, position: Position): Scenario {
  if (!draft.victory || objectivesAt(draft, position).length === 0) return draft;
  const objectives = (draft.victory.objectives ?? []).map((objective) => ({ ...objective, hexes: without(objective.hexes, position) }));
  return withVictory(draft, { ...draft.victory, objectives });
}

/**
 * Make a hex one of a side's objectives (a new one, of that hex), or not. Not on water. It turns
 * the victory conditions on when they're off
 */
export function setObjective(draft: Scenario, position: Position, faction: Faction, on: boolean): Scenario | false {
  if (isObjective(draft, position, faction) === on) return draft;
  if (!on) {
    const objectives = (draft.victory?.objectives ?? []).map((objective) =>
      objective.faction === faction ? { ...objective, hexes: without(objective.hexes, position) } : objective,
    );
    return withVictory(draft, { ...draft.victory!, objectives });
  }
  if (!isOnBoard(draft, position) || isWater(terrainAt(draft, position))) return false;
  const victory = draft.victory ?? { medals: DEFAULT_VICTORY_MEDALS };
  const objective: Objective = { faction, name: newObjectiveName(draft, faction), hexes: [position] };
  return withVictory(draft, { ...victory, objectives: [...(victory.objectives ?? []), objective] });
}

export const toggleObjective = (draft: Scenario, position: Position, faction: Faction) =>
  setObjective(draft, position, faction, !isObjective(draft, position, faction));

/** An objective's name in one language (`index` in the victory's objectives) */
export function setObjectiveName(draft: Scenario, index: number, lang: Lang, name: string): Scenario | false {
  const objectives = draft.victory?.objectives;
  const objective = objectives?.[index];
  if (!objective) return false;
  if (objective.name[lang] === name) return draft;
  const renamed = objectives.map((each, i) => (i === index ? { ...each, name: { ...each.name, [lang]: name } } : each));
  return { ...draft, victory: { ...draft.victory!, objectives: renamed } };
}

/** Take an objective off the map, all its hexes */
export function removeObjective(draft: Scenario, index: number): Scenario | false {
  const objectives = draft.victory?.objectives;
  if (!objectives?.[index]) return false;
  return withVictory(draft, { ...draft.victory!, objectives: objectives.filter((_, i) => i !== index) });
}

// --- Tools ------------------------------------------------------------------


// --- Board size -------------------------------------------------------------------
// A map grows or shrinks at its edges: a column on the left or right (one hex more or fewer in
// every row), or two rows at the top or bottom, so the rows stay odd (game-core/boardSize.ts).

export type BoardEdge = "left" | "right" | "top" | "bottom";

/** How far everything moves when an edge grows by one step: a column, or two rows */
const STEP: Record<BoardEdge, { cols: number; rows: number; shift: Position }> = {
  left: { cols: 1, rows: 0, shift: { row: 0, col: 1 } },
  right: { cols: 1, rows: 0, shift: { row: 0, col: 0 } },
  top: { cols: 0, rows: 2, shift: { row: 2, col: 0 } },
  bottom: { cols: 0, rows: 2, shift: { row: 0, col: 0 } },
};

/** The board's size after growing (or shrinking) an edge by one step, or null past the limits */
export function resizedBoard(draft: Scenario, edge: BoardEdge, grow: boolean): BoardSize | null {
  const { cols, rows } = boardSizeOf(draft);
  const k = grow ? 1 : -1;
  const size = { cols: cols + k * STEP[edge].cols, rows: rows + k * STEP[edge].rows };
  return isBoardSize(size) ? size : null;
}

/**
 * Grow the board at an edge, the new hexes painted with `fill` (plains leaves them open), or
 * shrink it, dropping whatever was on the hexes taken off. Everything moves along when the left or
 * top edge changes, so the map stays as it was. `false` past the size limits
 */
export function resizeBoard(draft: Scenario, edge: BoardEdge, grow: boolean, fill: HexType = HexType.PLAINS): Scenario | false {
  const size = resizedBoard(draft, edge, grow);
  if (!size) return false;
  const k = grow ? 1 : -1;
  const move = ({ row, col }: Position): Position => ({ row: row + k * STEP[edge].shift.row, col: col + k * STEP[edge].shift.col });
  const moved = (positions: readonly Position[] | undefined) => (positions ?? []).map(move).filter((p) => isOnSize(p, size));
  const movedGroups = <G extends Tiles | UnitGroup>(groups: G): G =>
    Object.fromEntries(
      Object.entries(groups)
        .map(([key, positions]) => [key, moved(positions as Position[] | undefined)] as const)
        .filter(([, positions]) => positions.length > 0),
    ) as G;

  let tiles = movedGroups(draft.tiles);
  if (grow && fill !== HexType.PLAINS) {
    const old = new Set(boardPositions(boardSizeOf(draft)).map(move).map(({ row, col }) => `${row}-${col}`));
    const added = boardPositions(size).filter(({ row, col }) => !old.has(`${row}-${col}`));
    tiles = { ...tiles, [fill]: [...(tiles[fill] ?? []), ...added] };
  }

  const { board: _board, ...rest } = draft;
  let resized: Scenario = {
    ...rest,
    ...(isStandardBoard(size) ? {} : { board: size }),
    tiles,
    units: { allies: movedGroups(draft.units.allies), axis: movedGroups(draft.units.axis) },
  };
  resized = withList(withList(withList(resized, "wire", moved(draft.wire)), "sandbags", moved(draft.sandbags)), "elite", moved(draft.elite));
  resized = withPicked(
    resized,
    (draft.pickedTiles ?? []).map((p) => ({ ...move(p), tile: p.tile })).filter((p) => isOnSize(p, size)),
  );
  if (draft.victory) {
    const objectives = (draft.victory.objectives ?? []).map((objective) => ({ ...objective, hexes: moved(objective.hexes) }));
    resized = withVictory(resized, { ...draft.victory, objectives });
  }
  return resized;
}

/** What the editor puts on the hexes it's tapped on */
export type EditorTool =
  | { kind: "terrain"; type: HexType; tile?: string }
  | { kind: "unit"; faction: Faction; type: UnitType }
  | { kind: "elite" }
  | { kind: "sandbags" }
  | { kind: "wire" }
  | { kind: "objective"; faction: Faction }
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
 * stroke. A terrain tool with a tile of its own (a town's) on a hex of its terrain with another
 * tile gives it this one. Terrain, wire, objectives and the eraser carry on as the finger slides; a unit, a badge or sandbags
 * only go on the first hex.
 */
export function strokeOf(tool: EditorTool, draft: Scenario, first: Position): Stroke {
  switch (tool.kind) {
    case "terrain": {
      const same = terrainAt(draft, first) === tool.type && (tool.tile === undefined || pickedTileAt(draft, first) === tool.tile);
      return { drags: true, apply: (d, p) => (same ? paintTerrain(d, p, HexType.PLAINS) : paintTerrain(d, p, tool.type, tool.tile)) };
    }
    case "wire": {
      const wire = !hasWire(draft, first);
      return { drags: true, apply: (d, p) => setWire(d, p, wire) };
    }
    case "objective": {
      const on = !isObjective(draft, first, tool.faction);
      return { drags: true, apply: (d, p) => setObjective(d, p, tool.faction, on) };
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
