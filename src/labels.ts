// labels.ts
// Spanish UI text for game enums (code identifiers stay in English)
import Hex from "./game-core/hex";
import { UnitType } from "./game-core/unit";
import { DieFace, countFaces } from "./game-core/dice";
import { HexType, Side } from "./types/hex";
import { Faction } from "./types/faction";
import { ShotTarget } from "./data/hitRules";
import { RollResult } from "./game-core/rollResult";
import type { MoveLimits } from "./game-core/orderRules";
import type { CoinEntry } from "./game-core/coins";

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
};

export const SECTION_LABELS: Record<Side, string> = {
  [Side.LEFT]: "flanco izquierdo",
  [Side.LEFT_CENTER]: "entre izquierda y centro",
  [Side.CENTER]: "centro",
  [Side.RIGHT_CENTER]: "entre centro y derecha",
  [Side.RIGHT]: "flanco derecho",
};

export const DIE_FACE_LABELS: Record<DieFace, string> = {
  [DieFace.INFANTRY]: "Infantería",
  [DieFace.TANK]: "Tanque",
  [DieFace.GRENADE]: "Granada",
  [DieFace.STAR]: "Estrella",
  [DieFace.FLAG]: "Bandera",
};

/** "Tanque en bosque", or just the terrain for an empty hex */
export const describeHex = (hex: Hex): string => {
  const terrain = TERRAIN_LABELS[hex.getType()];
  return hex.unit ? `${UNIT_LABELS[hex.unit.getUnitType()]} en ${terrain}` : terrain;
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

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Contra tanque · asalto cercano" */
export const describeTarget = ({ unitType, closeAssault }: ShotTarget): string =>
  `Contra ${UNIT_LABELS[unitType].toLowerCase()} · ${closeAssault ? "asalto cercano" : "a distancia"}`;

/** "2 impactos · 1 retirada · +1 moneda"; coins are left out when the turn earns none */
export const describeRoll = ({ hits, retreats, coins }: RollResult, withCoins = true): string =>
  [
    count(hits, "impacto", "impactos"),
    count(retreats, "retirada", "retiradas"),
    ...(withCoins && coins > 0 ? [`+${count(coins, "moneda", "monedas")}`] : []),
  ].join(" · ");

/** "1 moneda", "3 monedas" */
export const coinsText = (n: number): string => `${n} ${n === 1 ? "moneda" : "monedas"}`;

/** "+2" or "−4": a signed number of coins */
export const signedCoins = (amount: number): string => (amount < 0 ? `−${-amount}` : `+${amount}`);

/** What a line of the coin ledger was for */
export const describeCoinEntry = (entry: CoinEntry): string => {
  switch (entry.kind) {
    case "extraOrder":
      return `Orden extra: ${UNIT_LABELS[entry.unit].toLowerCase()}`;
    case "cardOrder":
      return `Orden de la carta: ${UNIT_LABELS[entry.unit].toLowerCase()}`;
    case "stars":
      return `Estrellas: ${UNIT_LABELS[entry.unit].toLowerCase()}`;
    case "endOfTurn":
      return "Fase final: monedas";
    case "cardReward":
      return "Fase final: recompensa de la carta";
    case "adjustment":
      return entry.amount < 0 ? "Pago a mano" : "Ingreso a mano";
  }
};
