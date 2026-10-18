// game-core/ai/combatCardChoice.ts
// The combat cards the computer plays, and how: what each card it knows is
// worth with the command card chosen (on the scale of ai/scoring.ts), the hexes
// it marks for an attack card and the unit it gives a card to. The cards it
// doesn't know yet (movement cards, Tactician, Reinforcements, Reposition,
// Suppressive Fire, Rifles Up!) are worth nothing, so it never plays them.
import { AiView, SeenEnemy } from "./aiStep";
import { UNIT_VALUE, nearestEnemy, shotValue, threatAt, top } from "./scoring";
import { CombatCard, MarkerRule } from "../combatCard";
import { hexDistance } from "../fireTargets";
import { includesPosition, samePosition } from "../position";
import { UnitType } from "../unit";
import { ATTACK_DIE_SIDES, DieFace } from "../dice";
import { BASE_DICE_BY_DISTANCE } from "../../data/fireQuestions";
import { FIGURES } from "../../data/figures";
import { Position } from "../../types/scenario";

/** What a supply is worth: about what a share of an extra order brings */
export const COIN_VALUE = 0.05;
/** A card is played only when it's worth this much more than its supplies */
const MIN_GAIN = 0.05;
/** A flag added to a roll (Heat of Battle): it pins, or makes a pinned unit retreat */
const FLAG_VALUE = 0.08;
/** Not One Step Back, Fortify: what each of its units under fire gains */
const HOLD_VALUE = 0.05;
/** Camouflage: next turn only a close assault can hit the unit */
const CAMOUFLAGE_VALUE = 0.1;

/** One of this side's units, as the computer weighs it */
interface OwnUnit {
  position: Position;
  unitType: UnitType;
  figures: number;
  /** It has lost a figure, or an armour figure has been hit once */
  weakened: boolean;
}

function ownUnits(view: AiView): OwnUnit[] {
  const { session } = view;
  const strength = session.getSnapshot().strength;
  return session.board.getAllHexes().flatMap((hex) => {
    const unit = hex.unit;
    if (!unit) return [];
    const position = hex.getPosition();
    const unitType = unit.getUnitType();
    const figures = session.figuresAt(position) ?? FIGURES[unitType].figures;
    const damaged = strength.find((s) => samePosition(s.position, position))?.damaged ?? false;
    return [{ position, unitType, figures, weakened: damaged || figures < FIGURES[unitType].figures }];
  });
}

/** The share of the target an attack card's dice destroy: the attack die has a grenade for the supply */
export function attackValue(dice: number, target: SeenEnemy): number {
  const hits = (face: DieFace) =>
    face === DieFace.GRENADE ||
    (target.unitType === UnitType.INFANTRY ? face === DieFace.INFANTRY : face === DieFace.TANK);
  const chance = ATTACK_DIE_SIDES.filter(hits).length / ATTACK_DIE_SIDES.length;
  const figures = Math.max(1, target.figures ?? 1);
  return (Math.min(dice * chance, figures) / figures) * UNIT_VALUE[target.unitType];
}

const enemyAt = (view: AiView, position: Position) => view.enemies.find((enemy) => samePosition(enemy.position, position));

/** The enemy a unit here could fire at this turn, after moving: the nearest within its range and a hex */
const reachableEnemy = (view: AiView, unit: OwnUnit, reach = 1): SeenEnemy | null =>
  top(
    view.enemies.filter((enemy) => hexDistance(enemy.position, unit.position) <= BASE_DICE_BY_DISTANCE[unit.unitType].length + reach),
    (enemy) => -hexDistance(enemy.position, unit.position),
    () => 0
  );

/** Next to a hex of these terrains, or on one */
function near(view: AiView, position: Position, terrains: readonly string[]): boolean {
  const { board } = view.session;
  const hex = board.getHex(position);
  return !!hex && [position, ...hex.getNeighbors()].some((p) => terrains.includes(board.getHex(p)?.getType() ?? ""));
}

/** What the card would bring to one unit given it (or one of the units it applies to) */
function unitGain(view: AiView, card: CombatCard, unit: OwnUnit): number {
  const effect = card.effect;
  if (!effect) return 0;
  switch (effect.kind) {
    case "diceBonus": {
      if (!effect.unitTypes.includes(unit.unitType)) return 0;
      if (effect.near && !near(view, unit.position, effect.near)) return 0;
      const enemy = effect.closeAssault
        ? view.enemies.find((e) => hexDistance(e.position, unit.position) <= 2)
        : reachableEnemy(view, unit);
      if (!enemy) return 0;
      return effect.face === DieFace.FLAG ? FLAG_VALUE * effect.dice : shotValue(effect.dice, enemy);
    }
    case "heal": {
      if (!card.assign?.unitTypes.includes(unit.unitType) || !unit.weakened) return 0;
      const max = FIGURES[unit.unitType].figures;
      return (Math.min(effect.figures, max - unit.figures || 1) / max) * UNIT_VALUE[unit.unitType];
    }
    case "ignoreHits": {
      if (unit.unitType !== UnitType.INFANTRY) return 0;
      // The infantry symbol is 2 of the battle die's 6 faces, of the 3 that hit infantry
      const symbolHits = threatAt(view, unit.unitType, unit.position, 6) * 6 * (2 / 3);
      return (Math.min(effect.hits, symbolHits) / unit.figures) * UNIT_VALUE[unit.unitType];
    }
    case "camouflage":
      return unit.unitType === UnitType.INFANTRY && nearestEnemy(view.enemies, unit.position) <= 4 ? CAMOUFLAGE_VALUE : 0;
    case "ignoreFlags":
      return effect.unitTypes.includes(unit.unitType) && threatAt(view, unit.unitType, unit.position) > 0 ? HOLD_VALUE : 0;
    case "fortify": {
      if (!effect.unitTypes.includes(unit.unitType)) return 0;
      const threatened = threatAt(view, unit.unitType, unit.position) > 0;
      return threatened && !reachableEnemy(view, unit, 0) ? HOLD_VALUE : 0;
    }
    default:
      return 0;
  }
}

/** An attack card's marks: the enemies it can reach, worth the most first, as many as its hexes (a chain: those close together) */
function attackWorth(view: AiView, rule: MarkerRule, dicePerHex: number): number {
  const own = ownUnits(view);
  const targets = view.enemies.filter(
    (enemy) => !rule.awayFromOwnUnits || !own.some((unit) => hexDistance(unit.position, enemy.position) <= 1)
  );
  const best = (enemies: readonly SeenEnemy[]) =>
    enemies
      .map((enemy) => attackValue(dicePerHex, enemy))
      .sort((a, b) => b - a)
      .slice(0, rule.count)
      .reduce((sum, value) => sum + value, 0);
  if (!rule.chain) return best(targets);
  return Math.max(
    0,
    ...targets.map((enemy) => best(targets.filter((other) => hexDistance(other.position, enemy.position) < rule.count)))
  );
}

/**
 * What the card is worth this turn with these units ordered, before its cost. The ones given
 * to a unit count their best unit; the ones for every unit of a kind add them up
 */
export function combatCardWorth(view: AiView, card: CombatCard, ordered: readonly Position[]): number {
  const effect = card.effect;
  if (!effect) return 0;
  const units = ownUnits(view);
  const orderedUnits = units.filter((unit) => includesPosition(ordered, unit.position));
  switch (effect.kind) {
    case "attack":
      return card.marker ? attackWorth(view, card.marker, effect.dicePerHex) : 0;
    case "concentratedFire": {
      const firing = orderedUnits.filter((unit) => reachableEnemy(view, unit, 0)).length;
      return Math.min(0.3, 0.15 * Math.max(0, firing - 1));
    }
    case "diceBonus":
    case "heal":
    case "ignoreHits":
    case "camouflage":
    case "fortify":
    case "ignoreFlags": {
      // Not One Step Back covers every unit of its kind; the rest only ordered units (Personal Armor any one)
      const pool = effect.kind === "ignoreFlags" || card.assign?.ordered === false ? units : orderedUnits;
      if (card.needsOrdered && !orderedUnits.some((unit) => card.needsOrdered!.includes(unit.unitType))) return 0;
      const gains = pool.map((unit) => unitGain(view, card, unit));
      return card.assign ? Math.max(0, ...gains) : gains.reduce((sum, gain) => sum + gain, 0);
    }
    default:
      return 0;
  }
}

/**
 * The combat cards to play with the command card: up to two from the hand, worth more than
 * their supplies, that can go together
 */
export function chooseCombatCards(view: AiView, ordered: readonly Position[], fits: (card: CombatCard) => boolean): CombatCard[] {
  const { session } = view;
  const game = session.getSnapshot();
  if (!game.canPlayCombatCards) return [];
  const gains = game.combatHand
    .filter(fits)
    .map((card) => ({ card, gain: combatCardWorth(view, card, ordered) - card.cost * COIN_VALUE }))
    .filter(({ gain }) => gain > MIN_GAIN)
    .sort((a, b) => b.gain - a.gain);
  const chosen: CombatCard[] = [];
  for (const { card } of gains) {
    if (chosen.length < 2 && session.canPlayTogether([...chosen, card])) chosen.push(card);
  }
  return chosen;
}

/** The hex to mark next for an attack card: the enemy worth most, and for a chain, toward the others */
export function markFor(view: AiView, markable: readonly Position[], marking: { card: CombatCard; rule: MarkerRule; marked: number }): Position | null {
  const effect = marking.card.effect;
  const dice = effect?.kind === "attack" ? effect.dicePerHex : 1;
  const left = marking.rule.count - marking.marked - 1;
  const marked = view.session.getSnapshot().markers;
  const score = (position: Position) => {
    const here = enemyAt(view, position);
    const value = here && !includesPosition(marked, position) ? attackValue(dice, here) : 0;
    if (!marking.rule.chain || left <= 0) return value;
    const ahead = view.enemies
      .filter((enemy) => !includesPosition(marked, enemy.position) && !samePosition(enemy.position, position))
      .filter((enemy) => hexDistance(enemy.position, position) <= left)
      .reduce((sum, enemy) => sum + attackValue(dice, enemy), 0);
    return value + 0.5 * ahead;
  };
  return top(markable, score, view.random);
}

/** The unit to give the card to: the one it brings most */
export function assignTo(view: AiView, card: CombatCard, positions: readonly Position[]): Position | null {
  const units = ownUnits(view);
  return top(
    positions,
    (position) => {
      const unit = units.find((u) => samePosition(u.position, position));
      return unit ? unitGain(view, card, unit) : 0;
    },
    view.random
  );
}

/** The kinds of card the computer knows how to play; it never plays the others */
const KNOWN_EFFECTS: ReadonlySet<string> = new Set([
  "attack",
  "concentratedFire",
  "diceBonus",
  "heal",
  "ignoreHits",
  "camouflage",
  "fortify",
  "ignoreFlags",
]);

export const knowsCard = (card: CombatCard): boolean => !!card.effect && KNOWN_EFFECTS.has(card.effect.kind);

/**
 * The final phase's choice: a combat card while the hand has fewer than two it knows how to
 * play (one it doesn't know is discarded first when the hand is full), supplies otherwise
 */
export const rewardFor = (view: AiView): "combatCard" | "coins" =>
  view.session.getSnapshot().combatHand.filter(knowsCard).length < 2 ? "combatCard" : "coins";

/** The combat card in the hand worth least now, to discard */
export function leastWorthCard(view: AiView, hand: readonly CombatCard[]): CombatCard {
  const all = ownUnits(view).map((unit) => unit.position);
  // Cards it doesn't know go first
  return top(hand, (card) => (knowsCard(card) ? -(combatCardWorth(view, card, all) - card.cost * COIN_VALUE) : Infinity), view.random) ?? hand[0]!;
}
