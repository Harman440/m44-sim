// labels.ts
// Spanish UI text for game enums (code identifiers stay in English)
import Hex from "./game-core/hex";
import Unit, { UnitType } from "./game-core/unit";
import { DieFace, DieKind, SIX_SIDED_FACES, SixSidedFace, countFaces } from "./game-core/dice";
import { HexType, Side } from "./types/hex";
import { Faction } from "./types/faction";
import { ShotTarget } from "./data/hitRules";
import { RollResult, appliedFaces } from "./game-core/rollResult";
import type { MoveLimits } from "./game-core/orderRules";
import type { CoinEntry } from "./game-core/coins";
import type { CombatPhase, MarkerRule } from "./game-core/combatCard";
import { DeckReason, RATTENKRIEG_MIN_TOWNS } from "./data/combatCards";

export const FACTION_LABELS: Record<Faction, string> = { Allies: "Aliados", Axis: "Eje" };

export const UNIT_LABELS: Record<UnitType, string> = {
  [UnitType.INFANTRY]: "Infantería",
  [UnitType.TANK]: "Tanque",
  [UnitType.ARTILLERY]: "Artillería",
};

export const TERRAIN_LABELS: Record<HexType, string> = {
  [HexType.PLAINS]: "llanura",
  [HexType.FOREST]: "bosque",
  [HexType.HILL]: "colina",
  [HexType.TOWN]: "pueblo",
  [HexType.HEDGEROW]: "seto",
  [HexType.RIVER]: "río",
  [HexType.BRIDGE]: "puente",
  [HexType.LAKE]: "lago",
};

export const SECTION_LABELS: Record<Side, string> = {
  [Side.LEFT]: "flanco izquierdo",
  [Side.LEFT_CENTER]: "entre izquierda y centro",
  [Side.CENTER]: "centro",
  [Side.RIGHT_CENTER]: "entre centro y derecha",
  [Side.RIGHT]: "flanco derecho",
};

/** Section names short enough for a row of the fire order */
export const SECTION_SHORT_LABELS: Record<Side, string> = {
  [Side.LEFT]: "Izquierda",
  [Side.LEFT_CENTER]: "Izq.–centro",
  [Side.CENTER]: "Centro",
  [Side.RIGHT_CENTER]: "Centro–dcha.",
  [Side.RIGHT]: "Derecha",
};

export const DIE_FACE_LABELS: Record<DieFace, string> = {
  [DieFace.INFANTRY]: "Infantería",
  [DieFace.TANK]: "Tanque",
  [DieFace.GRENADE]: "Granada",
  [DieFace.SUPPLY]: "Suministro",
  [DieFace.FLAG]: "Bandera",
};

/** What a shot's target is: infantry, or any other unit (the tank face hits both armour and artillery) */
export const targetLabel = (infantry: boolean): string => (infantry ? "Infantería" : "Blindados o artillería");

/** "bosque, centro": where a hex is, without its unit */
export const describePlace = (hex: Hex | null): string =>
  hex ? `${TERRAIN_LABELS[hex.getType()]}, ${SECTION_LABELS[hex.getSide()]}` : "fuera del mapa";

/** "Tanque en bosque", or just the terrain for an empty hex; "… con alambrada" on barbed wire */
/** "Infantería", or "Infantería de élite" for a unit with the scenario's badge */
export const unitLabel = (unit: Unit): string => UNIT_LABELS[unit.getUnitType()] + (unit.elite ? " de élite" : "");

export const describeHex = (hex: Hex): string => {
  const extras = [hex.wire && "alambrada", hex.sandbags && "sacos terreros"].filter(Boolean).join(" y ");
  const terrain = TERRAIN_LABELS[hex.getType()] + (extras ? ` con ${extras}` : "");
  return hex.unit ? `${unitLabel(hex.unit)} en ${terrain}` : terrain;
};

/** How far a unit moves with its order, and whether it can still fire */
export const describeMovement = ({ maxMove, moveAndFire, holdShots }: MoveLimits): string => {
  const hexes = (n: number) => `${n} ${n === 1 ? "casilla" : "casillas"}`;
  if (maxMove === 0) return "No puede moverse con esta carta";
  if (holdShots === 0) return `Mueve hasta ${hexes(maxMove)}; no puede disparar`;
  const fire =
    moveAndFire === 0
      ? "si se mueve no puede disparar"
      : `puede disparar si mueve hasta ${hexes(moveAndFire)}`;
  return `Mueve hasta ${hexes(maxMove)}; ${fire}`;
};

/** "2 × Infantería · 1 × Granada", or "sin efecto" when no dice were rolled */
export const describeFaces = (faces: readonly DieFace[]): string => {
  const counts = countFaces(faces);
  const parts = Object.values(DieFace)
    .filter((face) => counts[face] > 0)
    .map((face) => `${counts[face]} × ${DIE_FACE_LABELS[face]}`);
  return parts.length > 0 ? parts.join(" · ") : "sin efecto";
};

/** The Reinforcements card's table: "Infantería → infantería · … · Bandera → sin refuerzos" */
export const describeReinforcements = (table: Record<SixSidedFace, UnitType | null>): string =>
  SIX_SIDED_FACES
    .map((face) => {
      const unit = table[face];
      return `${DIE_FACE_LABELS[face]} → ${unit ? UNIT_LABELS[unit].toLowerCase() : "sin refuerzos"}`;
    })
    .join(" · ");

/** The results a shot applies, and how many of the dice rolled they are when some were set aside */
export const describeAppliedFaces = (faces: readonly DieFace[], kept: readonly number[] | null): string =>
  kept === null
    ? describeFaces(faces)
    : `${describeFaces(appliedFaces(faces, kept))} (aplica ${kept.length} de ${faces.length})`;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const DIE_NOTES: Record<DieKind, string> = {
  battle: "",
  longRange: " · dado de 8 caras",
  attack: " · dado de ataque",
};

/** "Contra infantería · asalto cercano" */
export const describeTarget = ({ infantry, closeAssault, die }: ShotTarget): string =>
  `Contra ${targetLabel(infantry).toLowerCase()} · ${closeAssault ? "asalto cercano" : "a distancia"}${DIE_NOTES[die]}`;

/** "2 impactos · 1 retirada · +1 suministro"; coins are left out when the turn earns none */
export const describeRoll = ({ hits, retreats, coins }: RollResult, withCoins = true): string =>
  [
    count(hits, "impacto", "impactos"),
    count(retreats, "retirada", "retiradas"),
    ...(withCoins && coins > 0 ? [`+${count(coins, "suministro", "suministros")}`] : []),
  ].join(" · ");

/** "1 suministro", "3 suministros" */
export const coinsText = (n: number): string => `${n} ${n === 1 ? "suministro" : "suministros"}`;

/** "+2" or "−4": a signed number of coins */
export const signedCoins = (amount: number): string => (amount < 0 ? `−${-amount}` : `+${amount}`);

/** What a line of the coin ledger was for */
export const describeCoinEntry = (entry: CoinEntry): string => {
  switch (entry.kind) {
    case "extraOrder":
      return `Orden extra: ${UNIT_LABELS[entry.unit].toLowerCase()}`;
    case "cardOrder":
      return `Orden de la carta: ${UNIT_LABELS[entry.unit].toLowerCase()}`;
    case "supplies":
      return `Suministros: ${UNIT_LABELS[entry.unit].toLowerCase()}`;
    case "endOfTurn":
      return "Fase final: suministros";
    case "cardReward":
      return "Fase final: recompensa de la carta";
    case "combatCard":
      return `Carta de combate: ${entry.card}`;
    case "adjustment":
      return entry.amount < 0 ? "Pago a mano" : "Ingreso a mano";
  }
};

/** When a combat card is played */
export const COMBAT_PHASE_LABELS: Record<CombatPhase, string> = {
  order: "Con las órdenes",
  battle: "En la batalla",
};

/** Why a side gets a combat card: a short name for the group */
export const DECK_REASON_LABELS: Record<DeckReason, string> = {
  shared: "Para todos",
  attacker: "Ataca",
  defender: "Defiende",
  tanks: "Blindados",
  artillery: "Artillería",
  enemyTanks: "Blindados enemigos",
  towns: "Combate urbano",
  bigGuns: "Artillería pesada",
  air: "Aviación",
};

/** What to mark on the map for a combat card */
export const describeMarkerRule = ({ kind, count, chain, awayFromOwnUnits }: MarkerRule): string => {
  if (kind === "cross") return "Marca con una cruz la casilla libre donde aparece la unidad.";
  const hexes = count === 1 ? "1 casilla" : `${count} casillas`;
  if (chain) return `Marca ${hexes} en cadena: cada una junto a la anterior.`;
  if (awayFromOwnUnits) return `Marca ${hexes} que no estén en tus unidades ni junto a ellas.`;
  return `Marca ${hexes} sin unidades tuyas.`;
};
