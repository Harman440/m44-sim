// components/labels.ts
// Spanish UI text for game enums (code identifiers stay in English)
import Hex from "../game-core/hex";
import Unit, { UnitType } from "../game-core/unit";
import { DieFace } from "../game-core/dice";
import { HexType, Side } from "../types/hex";

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

/** How far a unit may move, and how far it may move and still fire */
export const describeMovement = (unit: Unit): string => {
  const hexes = (n: number) => `${n} ${n === 1 ? "casilla" : "casillas"}`;
  const fire =
    unit.getMoveAndFire() === 0
      ? "si se mueve no puede disparar"
      : `puede disparar si mueve hasta ${hexes(unit.getMoveAndFire())}`;
  return `Mueve hasta ${hexes(unit.getMaxMove())}; ${fire}`;
};
