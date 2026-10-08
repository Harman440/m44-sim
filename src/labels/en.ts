// labels/en.ts
// English UI text for game enums
import { UnitType } from "../game-core/unit";
import { DieFace, DieKind, SIX_SIDED_FACES, countFaces } from "../game-core/dice";
import { HexType, Side } from "../types/hex";
import { appliedFaces } from "../game-core/rollResult";
import type { Labels } from ".";

const UNITS: Labels["units"] = {
  [UnitType.INFANTRY]: "Infantry",
  [UnitType.TANK]: "Tank",
  [UnitType.ARTILLERY]: "Artillery",
};

const TERRAIN: Labels["terrain"] = {
  [HexType.PLAINS]: "plains",
  [HexType.FOREST]: "forest",
  [HexType.HILL]: "hill",
  [HexType.TOWN]: "town",
  [HexType.HEDGEROW]: "hedgerow",
  [HexType.RIVER]: "river",
  [HexType.BRIDGE]: "bridge",
  [HexType.LAKE]: "lake",
};

const SECTIONS: Labels["sections"] = {
  [Side.LEFT]: "left flank",
  [Side.LEFT_CENTER]: "between left and center",
  [Side.CENTER]: "center",
  [Side.RIGHT_CENTER]: "between center and right",
  [Side.RIGHT]: "right flank",
};

const DIE_FACES: Labels["dieFaces"] = {
  [DieFace.INFANTRY]: "Infantry",
  [DieFace.TANK]: "Tank",
  [DieFace.GRENADE]: "Grenade",
  [DieFace.SUPPLY]: "Supply",
  [DieFace.FLAG]: "Flag",
};

const DIE_NOTES: Record<DieKind, string> = {
  battle: "",
  longRange: " · 8-sided die",
  attack: " · attack die",
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hexes = (n: number) => count(n, "hex", "hexes");
const coins = (n: number) => count(n, "supply", "supplies");
const target = (infantry: boolean) => (infantry ? "Infantry" : "Armor or artillery");

const describeFaces: Labels["describeFaces"] = (faces) => {
  const counts = countFaces(faces);
  const parts = Object.values(DieFace)
    .filter((face) => counts[face] > 0)
    .map((face) => `${counts[face]} × ${DIE_FACES[face]}`);
  return parts.length > 0 ? parts.join(" · ") : "no effect";
};

const unit: Labels["unit"] = (unit) =>
  unit.elite ? `Elite ${UNITS[unit.getUnitType()].toLowerCase()}` : UNITS[unit.getUnitType()];

const en: Labels = {
  factions: { Allies: "Allies", Axis: "Axis" },
  units: UNITS,
  terrain: TERRAIN,
  sections: SECTIONS,
  sectionsShort: {
    [Side.LEFT]: "Left",
    [Side.LEFT_CENTER]: "Left–center",
    [Side.CENTER]: "Center",
    [Side.RIGHT_CENTER]: "Center–right",
    [Side.RIGHT]: "Right",
  },
  dieFaces: DIE_FACES,
  combatPhases: {
    order: "With the orders",
    battle: "In the battle",
  },
  deckReasons: {
    shared: "For everyone",
    attacker: "Attacks",
    defender: "Defends",
    tanks: "Armor",
    artillery: "Artillery",
    enemyTanks: "Enemy armor",
    towns: "Street fighting",
    bigGuns: "Heavy guns",
    air: "Air power",
  },
  target,
  describePlace: (hex) => (hex ? `${TERRAIN[hex.getType()]}, ${SECTIONS[hex.getSide()]}` : "off the map"),
  unit,
  describeHex: (hex) => {
    const extras = [hex.wire && "barbed wire", hex.sandbags && "sandbags"].filter(Boolean).join(" and ");
    const terrain = TERRAIN[hex.getType()] + (extras ? ` with ${extras}` : "");
    return hex.unit ? `${unit(hex.unit)} in ${terrain}` : terrain;
  },
  describeMovement: ({ maxMove, moveAndFire, holdShots }) => {
    if (maxMove === 0) return "Can't move with this card";
    if (holdShots === 0) return `Moves up to ${hexes(maxMove)}; can't fire`;
    const fire = moveAndFire === 0 ? "can't fire if it moves" : `can fire if it moves up to ${hexes(moveAndFire)}`;
    return `Moves up to ${hexes(maxMove)}; ${fire}`;
  },
  describeFaces,
  describeReinforcements: (table) =>
    SIX_SIDED_FACES.map((face) => {
      const unit = table[face];
      return `${DIE_FACES[face]} → ${unit ? UNITS[unit].toLowerCase() : "no reinforcements"}`;
    }).join(" · "),
  describeAppliedFaces: (faces, kept) =>
    kept === null
      ? describeFaces(faces)
      : `${describeFaces(appliedFaces(faces, kept))} (applies ${kept.length} of ${faces.length})`,
  describeTarget: ({ infantry, closeAssault, die }) =>
    `Against ${target(infantry).toLowerCase()} · ${closeAssault ? "close assault" : "at range"}${DIE_NOTES[die]}`,
  describeRoll: ({ hits, retreats, coins: earned }, withCoins = true) =>
    [
      count(hits, "hit", "hits"),
      count(retreats, "retreat", "retreats"),
      ...(withCoins && earned > 0 ? [`+${coins(earned)}`] : []),
    ].join(" · "),
  coins,
  hexes,
  describeCoinEntry: (entry) => {
    switch (entry.kind) {
      case "extraOrder":
        return `Extra order: ${UNITS[entry.unit].toLowerCase()}`;
      case "cardOrder":
        return `Card order: ${UNITS[entry.unit].toLowerCase()}`;
      case "supplies":
        return `Supplies: ${UNITS[entry.unit].toLowerCase()}`;
      case "endOfTurn":
        return "Final phase: supplies";
      case "cardReward":
        return "Final phase: the card's reward";
      case "combatCard":
        return `Combat card: ${entry.card.en}`;
      case "adjustment":
        return entry.amount < 0 ? "Paid by hand" : "Added by hand";
    }
  },
  describeMarkerRule: ({ kind, count, chain, awayFromOwnUnits }) => {
    if (kind === "cross") return "Mark the empty hex where the unit appears with a cross.";
    if (chain) return `Mark ${hexes(count)} in a chain: each one next to the one before.`;
    if (awayFromOwnUnits) return `Mark ${hexes(count)} that aren't on or next to your units.`;
    return `Mark ${hexes(count)} without your units.`;
  },
};

export default en;
