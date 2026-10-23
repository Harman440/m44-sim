// game-core/ai/scoring.ts
// What the computer's choices are worth, on one scale: the share of a unit
// destroyed (or kept), by how much the unit matters. Shared by the brains.
import { AiView, SeenEnemy } from "./aiStep";
import { hasLineOfSight, hexDistance } from "../fireTargets";
import { positionKey } from "../position";
import BoardManager, { turnedRound } from "../BoardManager";
import { UnitType, checksLineOfSight } from "../unit";
import { BASE_DICE_BY_DISTANCE, TARGET_TERRAIN_MODIFIERS, TargetTerrain } from "../../data/fireQuestions";
import { TERRAIN } from "../../data/terrain";
import { Position } from "../../types/scenario";

/** The hex in the Allies' view, as objectives are */
export const inAlliesView = (view: AiView, position: Position): Position =>
  view.side === "Axis" ? turnedRound(position, view.session.board.size) : position;

/** What losing a unit of each type means to its side, roughly */
export const UNIT_VALUE: Record<UnitType, number> = {
  [UnitType.INFANTRY]: 1,
  [UnitType.TANK]: 1.3,
  [UnitType.ARTILLERY]: 1.2,
};

/** The chance that one die hits a unit of this type: the infantry symbol (2 faces) or the tank, and the grenade */
export const hitChance = (target: UnitType): number => (target === UnitType.INFANTRY ? 3 / 6 : 2 / 6);

/** The dice a unit of this type loses firing at a hex, from its terrain */
export function coverAt(board: BoardManager, position: Position, firing: UnitType): number {
  const type = board.getHex(position)?.getType();
  if (!type) return 0;
  const terrain = (TERRAIN[type]?.firesAs ?? type) as TargetTerrain;
  return TARGET_TERRAIN_MODIFIERS[terrain]?.dice[firing] ?? 0;
}

/** The dice a unit rolls at a target this far away on this hex (0 out of range) */
export function diceAt(board: BoardManager, firing: UnitType, distance: number, target: Position): number {
  const base = BASE_DICE_BY_DISTANCE[firing][distance - 1] ?? 0;
  return base > 0 ? Math.max(0, base + coverAt(board, target, firing)) : 0;
}

/** The hits a shot is worth: what share of the target it would destroy, by how much the target matters */
export function shotValue(dice: number, target: SeenEnemy): number {
  const figures = Math.max(1, target.figures ?? 1);
  const hits = dice * hitChance(target.unitType);
  return (Math.min(hits, figures) / figures) * UNIT_VALUE[target.unitType];
}

/** The best shot a unit of this type would have from this hex, among the enemies in range and in sight */
export function bestShotFrom(view: AiView, firing: UnitType, from: Position): number {
  const { board } = view.session;
  const blockers = new Set(view.enemies.map((enemy) => positionKey(enemy.position)));
  return Math.max(
    0,
    ...view.enemies.map((enemy) => {
      const distance = hexDistance(from, enemy.position);
      const dice = diceAt(board, firing, distance, enemy.position);
      if (dice === 0) return 0;
      if (checksLineOfSight(firing) && !hasLineOfSight(board, from, enemy.position, blockers)) return 0;
      return shotValue(dice, enemy);
    })
  );
}

/**
 * What the enemies could take of a unit of this type on this hex next battle, on the same scale
 * as `shotValue`: the share of its figures, by how much it matters
 */
export function threatAt(view: AiView, unitType: UnitType, at: Position, figures = 1): number {
  const { board } = view.session;
  const hits = view.enemies.reduce((sum, enemy) => {
    const dice = diceAt(board, enemy.unitType, hexDistance(enemy.position, at), at);
    return sum + dice * hitChance(unitType);
  }, 0);
  return (Math.min(hits, figures) / figures) * UNIT_VALUE[unitType];
}

export const nearestEnemy = (enemies: readonly SeenEnemy[], position: Position): number =>
  Math.min(...enemies.map((enemy) => hexDistance(enemy.position, position)));

/** The highest-scoring option, one of the tied ones at random */
export function top<T>(options: readonly T[], score: (option: T) => number, random: () => number): T | null {
  if (options.length === 0) return null;
  const scores = options.map(score);
  const high = Math.max(...scores);
  const tied = options.filter((_, i) => scores[i]! >= high - 1e-9);
  return tied[Math.floor(random() * tied.length)] ?? tied[0]!;
}

/** What ordering the unit on this hex is worth this turn: more when an enemy is within its move and range */
export function unitWorth(view: AiView, position: Position): number {
  const unitType = view.session.board.getHex(position)?.unit?.getUnitType();
  if (!unitType || view.enemies.length === 0) return 0;
  const reach = BASE_DICE_BY_DISTANCE[unitType].length + (unitType === UnitType.ARTILLERY ? 0 : 1);
  return 1 + (nearestEnemy(view.enemies, position) <= reach ? 1 : 0);
}

