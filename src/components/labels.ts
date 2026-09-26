// components/labels.ts
// Spanish UI text for game enums (code identifiers stay in English)
import { UnitType } from "../game-core/unit";
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
