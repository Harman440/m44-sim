// game-core/fireTargets.ts
// Which hexes a unit can fire at from where it stands: in range, in sight and
// with at least one die. The app only knows this side's units, so any hex
// without one of them can hold an enemy.
import BoardManager from "./BoardManager";
import { Position } from "../types/scenario";
import { HexType } from "../types/hex";
import { FireAnswers, FireContext, calculateFireDice } from "./fireRules";
import { BASE_DICE_BY_DISTANCE, FIRE_QUESTIONS, SIGHT_BLOCKING_TERRAIN, fireBonusSteps } from "../data/fireQuestions";
import { samePosition } from "./position";

interface Cube {
  x: number;
  y: number;
  z: number;
}

/** Offset (odd rows shifted right) to cube coordinates, as in Hex */
const toCube = ({ row, col }: Position): Cube => {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  return { x, y: -x - z, z };
};

const toOffset = ({ x, z }: Cube): Position => ({ row: z, col: x + (z - (z & 1)) / 2 });

const roundCube = ({ x, y, z }: Cube): Cube => {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  // -0 would make "0-0" keys differ from "−0-0"; normalise
  return { x: rx + 0, y: ry + 0, z: rz + 0 };
};

/** Hexes between two positions, counting the target (1 = adjacent) */
export function hexDistance(a: Position, b: Position): number {
  const ca = toCube(a);
  const cb = toCube(b);
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z));
}

/**
 * Whether the line from the centre of `from` to the centre of `to` is clear:
 * no hex in between holds a unit or sight-blocking terrain. When the line runs
 * along the edge between two hexes, it's blocked only if both block (official
 * Memoir '44), and from a hill to a hill the hills in between don't. The
 * ends never block. Enemy units in between aren't known.
 */
export function hasLineOfSight(board: BoardManager, from: Position, to: Position): boolean {
  const distance = hexDistance(from, to);
  if (distance <= 1) return true;
  const a = toCube(from);
  const b = toCube(to);
  // Official hill rule: from a hill to a hill (the same height), the hills in between don't block
  const hillToHill = board.getHex(from)?.getType() === HexType.HILL && board.getHex(to)?.getType() === HexType.HILL;
  const blocks = (position: Position) => {
    const hex = board.getHex(position);
    if (!hex) return false;
    if (hex.hasUnit()) return true;
    if (hillToHill && hex.getType() === HexType.HILL) return false;
    return SIGHT_BLOCKING_TERRAIN.includes(hex.getType());
  };
  // Nudged both ways, so a line along an edge picks the hex on each side of it
  const EPSILON = 1e-6;
  for (let i = 1; i < distance; i++) {
    const t = i / distance;
    const at = (nudge: number) =>
      toOffset(
        roundCube({
          x: a.x + nudge + (b.x - a.x) * t,
          y: a.y + nudge + (b.y - a.y) * t,
          z: a.z - 2 * nudge + (b.z - a.z) * t,
        })
      );
    if (blocks(at(EPSILON)) && blocks(at(-EPSILON))) return false;
  }
  return true;
}

export interface FireTarget {
  position: Position;
  /** 1 = adjacent (close assault) */
  distance: number;
  terrain: HexType;
  /** Dice at a target on this hex, before the questions the map can't answer (sandbags don't change them) */
  dice: number;
  lineOfSight: boolean;
}

/** The answers the map gives for a target on this hex */
export const mapAnswers = (target: Pick<FireTarget, "distance" | "terrain">): FireAnswers => ({
  distance: String(target.distance),
  targetTerrain: target.terrain,
  // Only hexes in sight can be picked
  ...(target.distance > 1 ? { lineOfSight: "yes" } : {}),
});

/**
 * Every hex in range of a unit at `from` that has none of this side's units
 * and could hold one (not water),
 * with the dice a shot at it would roll and whether it's in sight. A unit that
 * may only fire in close assault (Close Assault card, taking ground) reaches
 * adjacent hexes only.
 */
export function fireTargets(board: BoardManager, from: Position, firing: FireContext): FireTarget[] {
  const context = { ...firing, fromTerrain: board.getHex(from)?.getType() };
  const range = context.closeAssaultOnly ? 1 : BASE_DICE_BY_DISTANCE[context.unitType].length;
  return board
    .getAllHexes()
    .filter((hex) => hex.canEnter() && !samePosition(hex.getPosition(), from))
    .map((hex) => ({ hex, distance: hexDistance(from, hex.getPosition()) }))
    .filter(({ distance }) => distance >= 1 && distance <= range)
    .map(({ hex, distance }) => {
      const terrain = hex.getType();
      // The combat card's dice count: it can make a hex worth firing at
      const answers = { ...mapAnswers({ distance, terrain }), combatCard: "yes" };
      const { dice } = calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
      return { position: hex.getPosition(), distance, terrain, dice, lineOfSight: hasLineOfSight(board, from, hex.getPosition()) };
    });
}
