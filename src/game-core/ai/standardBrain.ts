// game-core/ai/standardBrain.ts
// The computer player the app uses: like the basic one, but it weighs each
// hex by the shots it gives against the fire it draws (terrain cover counts),
// fires where it can destroy or weaken most, and buys extra orders with its
// supplies. It still plays no combat cards.
import { AiView, Brain, MoveChoice, SeenEnemy } from "./aiStep";
import { basicBrain } from "./basicBrain";
import CommandCard, { SECTIONS, Section } from "../commandCard";
import { EXTRA_SLOT, OrderSlot, fallbackCard, orderablePositions, ordersLeft } from "../orderRules";
import { hasLineOfSight, hexDistance } from "../fireTargets";
import { positionKey, samePosition } from "../position";
import BoardManager from "../BoardManager";
import { UnitType, checksLineOfSight } from "../unit";
import { BASE_DICE_BY_DISTANCE, TARGET_TERRAIN_MODIFIERS, TargetTerrain } from "../../data/fireQuestions";
import { EXTRA_ORDER_COST } from "../../data/coinRules";
import { TERRAIN } from "../../data/terrain";
import { Position } from "../../types/scenario";

/** How much the fire a hex draws counts against the shots it gives */
const THREAT_WEIGHT = 2;
/** How much getting nearer the enemy counts, for units with nothing to fire at yet */
const APPROACH_WEIGHT = 0.15;
/** What losing a unit of each type means to its side, roughly */
const UNIT_VALUE: Record<UnitType, number> = {
  [UnitType.INFANTRY]: 1,
  [UnitType.TANK]: 1.3,
  [UnitType.ARTILLERY]: 1.2,
};

/** The chance that one die hits a unit of this type: the infantry symbol (2 faces) or the tank, and the grenade */
const hitChance = (target: UnitType): number => (target === UnitType.INFANTRY ? 3 / 6 : 2 / 6);

/** The dice a unit of this type loses firing at a hex, from its terrain */
function coverAt(board: BoardManager, position: Position, firing: UnitType): number {
  const type = board.getHex(position)?.getType();
  if (!type) return 0;
  const terrain = (TERRAIN[type]?.firesAs ?? type) as TargetTerrain;
  return TARGET_TERRAIN_MODIFIERS[terrain]?.dice[firing] ?? 0;
}

/** The dice a unit rolls at a target this far away on this hex (0 out of range) */
function diceAt(board: BoardManager, firing: UnitType, distance: number, target: Position): number {
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
function bestShotFrom(view: AiView, firing: UnitType, from: Position): number {
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

const nearestEnemy = (enemies: readonly SeenEnemy[], position: Position): number =>
  Math.min(...enemies.map((enemy) => hexDistance(enemy.position, position)));

/** The highest-scoring option, one of the tied ones at random */
function top<T>(options: readonly T[], score: (option: T) => number, random: () => number): T | null {
  if (options.length === 0) return null;
  const scores = options.map(score);
  const high = Math.max(...scores);
  const tied = options.filter((_, i) => scores[i]! >= high - 1e-9);
  return tied[Math.floor(random() * tied.length)] ?? tied[0]!;
}

/** What ordering the unit on this hex is worth this turn: more when an enemy is within its move and range */
function unitWorth(view: AiView, position: Position): number {
  const unitType = view.session.board.getHex(position)?.unit?.getUnitType();
  if (!unitType || view.enemies.length === 0) return 0;
  const reach = BASE_DICE_BY_DISTANCE[unitType].length + (unitType === UnitType.ARTILLERY ? 0 : 1);
  return 1 + (nearestEnemy(view.enemies, position) <= reach ? 1 : 0);
}

/** A card's worth: the units it orders, the most worthwhile first, as many as its orders */
function cardWorth(view: AiView, card: CommandCard, section: Section | null): number {
  const { board } = view.session;
  const rules = fallbackCard(card, board) ?? card;
  const context = { card: rules, chosenSection: section, board, orders: [], coins: 0 };
  const worths = orderablePositions(context)
    .map((position) => unitWorth(view, position))
    .sort((a, b) => b - a);
  return worths.slice(0, ordersLeft(context)).reduce((sum, worth) => sum + worth, 0);
}

export const standardBrain: Brain = {
  ...basicBrain,

  pickCard(view) {
    const { session } = view;
    const plays = session.getSnapshot().hand.flatMap((card): { card: CommandCard; section?: Section; worth: number }[] =>
      session.cardNeedsSection(card)
        ? SECTIONS.map((section) => ({ card, section, worth: cardWorth(view, card, section) }))
        : [{ card, worth: cardWorth(view, card, null) }]
    );
    const play = top(plays, (option) => option.worth, view.random)!;
    return { card: play.card, section: play.section };
  },

  // The unit with the most to gain goes first, so a quota card spends its orders well
  nextToOrder: (view, orderable) => top(orderable, (position) => unitWorth(view, position), view.random),

  moveFor(view, from, slot?: OrderSlot): MoveChoice {
    const { session, enemies, random } = view;
    const options = session.getMoveOptions(from, slot);
    const unitType = session.board.getHex(from)?.unit?.getUnitType();
    const slots = slot ? [slot] : (options?.slots ?? []);
    if (!options || !unitType || enemies.length === 0) return { to: from, slots };

    const taken = new Set(enemies.map((enemy) => positionKey(enemy.position)));
    const canFire = new Set(options.moveAndFire.map(positionKey));
    const holdFires = options.limits.holdShots > 0;
    const figures = Math.max(1, session.figuresAt(from) ?? 1);
    const score = (position: Position) => {
      const holds = samePosition(position, from);
      const fires = holds ? holdFires : canFire.has(positionKey(position));
      const offence = fires ? bestShotFrom(view, unitType, position) : 0;
      return offence - THREAT_WEIGHT * threatAt(view, unitType, position, figures) - APPROACH_WEIGHT * nearestEnemy(enemies, position);
    };
    const candidates = [from, ...options.moves.filter((position) => !taken.has(positionKey(position)))];
    return { to: top(candidates, score, random) ?? from, slots };
  },

  // Supplies buy orders for the units that would fire with them
  extraOrder(view, extraOrderable) {
    const { session } = view;
    const coins = session.getSnapshot().coins;
    const worth = (position: Position) => {
      const unitType = session.board.getHex(position)?.unit?.getUnitType();
      if (!unitType || EXTRA_ORDER_COST[unitType] > coins) return 0;
      const options = session.getMoveOptions(position, EXTRA_SLOT);
      if (!options) return 0;
      const { to } = standardBrain.moveFor(view, position, EXTRA_SLOT);
      const fires = samePosition(to, position)
        ? options.limits.holdShots > 0
        : options.moveAndFire.some((p) => samePosition(p, to));
      return fires ? bestShotFrom(view, unitType, to) : 0;
    };
    const pick = top(extraOrderable, worth, view.random);
    return pick && worth(pick) > 0 ? pick : null;
  },

  shotFor(view, fireable) {
    const { session } = view;
    const shots = fireable.flatMap((order) =>
      session
        .fireTargetsFor(order)
        .filter((target) => target.lineOfSight && target.dice > 0)
        .flatMap((target) => {
          const enemy = view.enemies.find((e) => samePosition(e.position, target.position));
          return enemy ? [{ order, position: target.position, value: shotValue(target.dice, enemy) }] : [];
        })
    );
    const best = top(shots, (shot) => shot.value, view.random);
    if (!best) return { order: fireable[0]!, targets: [] };
    // The other targets of the same unit, in case the first can't be fired at after all
    const others = shots
      .filter((shot) => shot.order === best.order && !samePosition(shot.position, best.position))
      .sort((a, b) => b.value - a.value)
      .map((shot) => shot.position);
    return { order: best.order, targets: [best.position, ...others] };
  },

  retreatTo(view, from, options) {
    const unitType = view.session.board.getHex(from)?.unit?.getUnitType() ?? UnitType.INFANTRY;
    const figures = Math.max(1, view.session.figuresAt(from) ?? 1);
    return top(options, (position) => -threatAt(view, unitType, position, figures), view.random) ?? options[0]!;
  },
};
