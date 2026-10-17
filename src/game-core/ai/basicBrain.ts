// game-core/ai/basicBrain.ts
// The very basic computer player: it plays the card that orders the most of
// its units, moves them toward the nearest enemy and fires its best shot. It
// plays no combat cards and doesn't spend supplies.
import { Brain, AiView, SeenEnemy } from "./aiStep";
import CommandCard, { SECTIONS, Section } from "../commandCard";
import { fallbackCard, ordersLeft } from "../orderRules";
import { hexDistance } from "../fireTargets";
import { positionKey, samePosition } from "../position";
import { UnitType } from "../unit";
import { BASE_DICE_BY_DISTANCE } from "../../data/fireQuestions";
import { Position } from "../../types/scenario";

/** How far the nearest enemy is from this hex (Infinity with none left) */
const nearestEnemy = (enemies: readonly SeenEnemy[], position: Position): number =>
  Math.min(...enemies.map((enemy) => hexDistance(enemy.position, position)));

/** The options with the lowest score, one of them picked at random */
function best<T>(options: readonly T[], score: (option: T) => number, random: () => number): T | null {
  if (options.length === 0) return null;
  const scores = options.map(score);
  const low = Math.min(...scores);
  const tied = options.filter((_, i) => scores[i] === low);
  return tied[Math.floor(random() * tied.length)] ?? tied[0]!;
}

/** How many units the card would order (in this section, for a card whose section is picked) */
function unitsOrdered(view: AiView, card: CommandCard, section: Section | null): number {
  const { board } = view.session;
  const rules = fallbackCard(card, board) ?? card;
  return ordersLeft({ card: rules, chosenSection: section, board, orders: [], coins: 0 });
}

/** The dice a unit of this type rolls at an enemy this far away (0 out of range) */
const diceAt = (unitType: UnitType, distance: number): number => BASE_DICE_BY_DISTANCE[unitType][distance - 1] ?? 0;

export const basicBrain: Brain = {
  dropAt: (view, options) => best(options, () => 0, view.random),

  pickCard(view) {
    const { session } = view;
    const plays = session.getSnapshot().hand.flatMap((card): { card: CommandCard; section?: Section; units: number }[] =>
      session.cardNeedsSection(card)
        ? SECTIONS.map((section) => ({ card, section, units: unitsOrdered(view, card, section) }))
        : [{ card, section: undefined, units: unitsOrdered(view, card, null) }]
    );
    const play = best(plays, (option) => -option.units, view.random)!;
    return { card: play.card, section: play.section };
  },

  nextToOrder: (view, orderable) => best(orderable, (position) => nearestEnemy(view.enemies, position), view.random),

  moveFor(view, from) {
    const { session, enemies, random } = view;
    const options = session.getMoveOptions(from);
    const unitType = session.board.getHex(from)?.unit?.getUnitType();
    const hold = { to: from, slots: options?.slots ?? [] };
    if (!options || !unitType || enemies.length === 0) return hold;

    const now = nearestEnemy(enemies, from);
    // Close enough for a good shot already (artillery: in range at all)
    if (diceAt(unitType, now) >= (unitType === UnitType.ARTILLERY ? 1 : 2)) return hold;

    const taken = new Set(enemies.map((enemy) => positionKey(enemy.position)));
    const canFire = new Set(options.moveAndFire.map(positionKey));
    // Nearer the enemy, and still able to fire this turn where it can
    const score = (position: Position) => nearestEnemy(enemies, position) + (canFire.has(positionKey(position)) ? 0 : 1.5);
    const to = best(
      options.moves.filter((position) => !taken.has(positionKey(position)) && !samePosition(position, from)),
      score,
      random
    );
    return to && score(to) < now ? { to, slots: options.slots } : hold;
  },

  shotFor(view, fireable) {
    const { session, enemies } = view;
    const figuresAt = (position: Position) =>
      enemies.find((enemy) => samePosition(enemy.position, position))?.figures ?? 0;
    const shots = fireable.map((order) => {
      const targets = session
        .fireTargetsFor(order)
        .filter((target) => target.lineOfSight && target.dice > 0)
        // Most dice first, then the enemy with the fewest figures left
        .sort((a, b) => b.dice - a.dice || figuresAt(a.position) - figuresAt(b.position));
      return { order, targets: targets.map((target) => target.position), dice: targets[0]?.dice ?? 0 };
    });
    const shot = best(shots, (option) => -option.dice, view.random)!;
    return { order: shot.order, targets: shot.targets };
  },

  retreatTo: (view, _from, options) =>
    best(options, (position) => -nearestEnemy(view.enemies, position), view.random) ?? options[0]!,

  takeGround: () => true,

  // The card that would order the most units now
  keepCard: (view, options) =>
    best(
      options,
      (card) => -Math.max(...(card.choosesSection ? SECTIONS : [null]).map((section) => unitsOrdered(view, card, section))),
      view.random
    )!,

  reward: () => "coins",

  discardCombatCard: (_view, hand) => hand[0]!,

  // Toward its own edge, the bottom rows of its own view
  reinforcementAt: (view, options) => best(options, (position) => -position.row, view.random),
};
