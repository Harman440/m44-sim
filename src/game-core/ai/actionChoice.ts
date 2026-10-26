// game-core/ai/actionChoice.ts
// The standard computer's choices in the actions game: the command card to play and where to
// mark it, the action each unit is given for the move it wants, and the fire option of each
// shot. Each choice is scored on the scoring.ts scale (the share of a unit destroyed or kept);
// the session still says what's allowed.
import { ActionChoice, AiView, SeenEnemy } from "./aiStep";
import { bestShotFrom, inAlliesView, shotValue, threatAt } from "./scoring";
import type { ActionCard } from "../actionCard";
import type { GameSnapshot } from "../gameSession";
import { hexDistance } from "../fireTargets";
import { includesPosition, samePosition } from "../position";
import { UnitType } from "../unit";
import { amountOf, UnitSupplies } from "../unitSupplies";
import { Supply } from "../../data/unitSupplies";
import { FIGURES } from "../../data/figures";
import { Position } from "../../types/scenario";

/** A card is played only when it's worth at least this much this turn */
export const CARD_WORTH_PLAYING = 0.5;

/** What each unit in need is worth to Resupply (infantry) and Refuel (armour and artillery) */
const RESUPPLY_PER_UNIT = 0.25;
const REFUEL_PER_UNIT = 0.3;
/** Reinforcements, once the side has lost a unit */
const REINFORCEMENTS_WORTH = 0.6;

/** Below this a shot from where the unit stands is too poor to give up a turn of mending or rallying for */
const POOR_SHOT = 0.15;
/** Artillery spends its fuel on a bombardment only for a shot this good */
const BOMBARDMENT_SHOT = 0.25;
/** Infantry with no shot digs in where the enemy fire it draws is at least this */
const FORTIFY_THREAT = 0.3;
/** A unit regroups once it has lost at least this many figures */
const REGROUP_LOSS = 2;
/** A unit down to this many figures is a medal about to be lost: it joins a bigger one even when that one could fire */
const REGROUP_SAVES_MEDAL = 2;

const suppliesAt = (view: AiView, position: Position): UnitSupplies | null =>
  view.session.getSnapshot().supplies.find((each) => samePosition(each.position, position))?.supplies ?? null;

/** The side's units and their supplies */
const army = (view: AiView) =>
  view.session.getSnapshot().supplies.flatMap(({ position, supplies }) => {
    const unitType = view.session.board.getHex(position)?.unit?.getUnitType();
    return unitType ? [{ position, supplies, unitType }] : [];
  });

/** Whether the unit can fire a shot at all: ammo for infantry, shells for armour and artillery */
const hasShot = (unitType: UnitType, supplies: UnitSupplies) =>
  amountOf(supplies, unitType === UnitType.INFANTRY ? Supply.AMMO : Supply.SHELLS) > 0;

/** The shot a unit has from where it stands, if it has anything to fire */
const shotHere = (view: AiView, unitType: UnitType, position: Position, supplies: UnitSupplies | null) =>
  supplies && hasShot(unitType, supplies) ? bestShotFrom(view, unitType, position) : 0;

/** The best targets' worth for a card attacking `count` hexes with this many dice each (not next to own units when it says so) */
function attackWorth(view: AiView, card: ActionCard, dice: number): number {
  const count = card.marker?.count ?? 1;
  const own = army(view).map(({ position }) => position);
  const targets = view.enemies.filter(
    (enemy) => !card.marker?.awayFromOwnUnits || own.every((position) => hexDistance(position, enemy.position) > 1),
  );
  return targets
    .map((enemy) => shotValue(dice, enemy))
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((sum, value) => sum + value, 0);
}

/** What playing the card is worth this turn */
export function cardWorth(view: AiView, card: ActionCard): number {
  const units = army(view);
  switch (card.effect.kind) {
    case "extraDice":
      // An extra die on each unit's best shot
      return units.reduce((sum, { position, unitType, supplies }) => {
        const shot = shotHere(view, unitType, position, supplies);
        return sum + (shot > 0 ? shot / 2 : 0);
      }, 0);
    case "resupply":
      return (
        RESUPPLY_PER_UNIT *
        units.filter(({ unitType, supplies }) => unitType === UnitType.INFANTRY && (amountOf(supplies, Supply.AMMO) === 0 || amountOf(supplies, Supply.MORALE) <= 2)).length
      );
    case "refuel":
      return REFUEL_PER_UNIT * units.filter(({ unitType, supplies }) => unitType !== UnitType.INFANTRY && amountOf(supplies, Supply.FUEL) === 0).length;
    case "attack":
      return attackWorth(view, card, card.effect.dicePerHex);
    case "reinforcements":
      return view.session.unitsLost().length > 0 ? REINFORCEMENTS_WORTH : 0;
  }
}

/** The playable card worth the most, if it's worth playing */
export function chooseCard(view: AiView): ActionCard | null {
  const playable = view.session.getSnapshot().cards.filter((held) => held.playable);
  let best: { card: ActionCard; worth: number } | null = null;
  for (const { card } of playable) {
    const worth = cardWorth(view, card);
    if (worth >= CARD_WORTH_PLAYING && (!best || worth > best.worth)) best = { card, worth };
  }
  return best?.card ?? null;
}

/**
 * Where to mark the card: an attack on the enemy worth the most there (any hex when none is in
 * reach), a reinforcement's cross as far from the enemy as it can be
 */
export function chooseMark(view: AiView, markable: readonly Position[], marking: NonNullable<GameSnapshot["marking"]>): Position | null {
  const enemyAt = (position: Position): SeenEnemy | undefined => view.enemies.find((enemy) => samePosition(enemy.position, position));
  const score =
    marking.rule.kind === "cross"
      ? (position: Position) => Math.min(...view.enemies.map((enemy) => hexDistance(enemy.position, position)))
      : (position: Position) => {
          const enemy = enemyAt(position);
          const dice = marking.card.effect.kind === "attack" ? marking.card.effect.dicePerHex : 1;
          return enemy ? shotValue(dice, enemy) : 0;
        };
  return markable.reduce<Position | null>((best, position) => (best === null || score(position) > score(best) ? position : best), null);
}

/**
 * Regroup: the unit and a unit next to it, both weakened, whose figures fit in one unit. The
 * bigger one takes the smaller one's figures (which leaves the map), when it has no good shot
 * where it stands, or when the smaller one is down to `REGROUP_SAVES_MEDAL` figures; the smallest
 * such partner first. Null when there's no such pair
 */
function regroupWith(view: AiView, from: Position, unitType: UnitType): ActionChoice {
  const { session } = view;
  const full = FIGURES[unitType].figures;
  const figuresAt = (position: Position) => session.figuresAt(position) ?? full;
  const figures = figuresAt(from);
  if (full - figures < REGROUP_LOSS) return null;
  const neighbours = session.board.getHex(from)?.getNeighbors() ?? [];
  const pairs = neighbours
    .filter((next) => session.board.getHex(next)?.unit?.getUnitType() === unitType)
    .map((next) => ({ next, figures: figuresAt(next) }))
    .filter((other) => other.figures < full && other.figures + figures <= full)
    .sort((a, b) => a.figures - b.figures);
  for (const other of pairs) {
    const [receiver, partner] = other.figures > figures ? [other.next, from] : [from, other.next];
    const savesMedal = Math.min(figures, other.figures) <= REGROUP_SAVES_MEDAL;
    if (!savesMedal && shotHere(view, unitType, receiver, suppliesAt(view, receiver)) >= POOR_SHOT) continue;
    if (!includesPosition(session.regroupPartners(receiver), partner)) continue;
    const action = session.getActions(receiver)?.find((option) => option.action.effect === "regroup");
    if (action) return { action: action.action.id, to: receiver, partner, receiver };
  }
  return null;
}

/**
 * The action for the move the brain chose: a weakened unit that holds regroups with a weakened
 * unit next to it (`regroupWith`); one with nothing better to do rallies, mends or digs in; a tired one rests; armour low on fuel keeps it while it has a shot where it stands;
 * artillery with a good shot bombards. Otherwise the plain action for the move (null)
 */
export function chooseAction(view: AiView, from: Position, to: Position): ActionChoice {
  const { session } = view;
  const hex = session.board.getHex(from);
  const unitType = hex?.unit?.getUnitType();
  const supplies = suppliesAt(view, from);
  const actions = session.getActions(from);
  if (!hex || !unitType || !supplies || !actions) return null;
  const allowed = (id: string) => actions.some(({ action, refusal }) => action.id === id && refusal === null);
  const give = (id: string, at: Position = from): ActionChoice => (allowed(id) ? { action: id, to: at } : null);
  const holds = samePosition(from, to);
  const shot = shotHere(view, unitType, from, supplies);

  switch (unitType) {
    case UnitType.INFANTRY: {
      const morale = amountOf(supplies, Supply.MORALE);
      if (morale === 0) return give("infantry:moraleUp") ?? "rest";
      if (morale <= 1 && holds && shot === 0) return give("infantry:moraleUp");
      const regroup = holds ? regroupWith(view, from, unitType) : null;
      if (regroup) return regroup;
      if (holds && shot < POOR_SHOT && allowed("infantry:medic")) return give("infantry:medic");
      // Tired, with no shot where it ends: it rests, and gets more energy back
      if (amountOf(supplies, Supply.ENERGY) <= 1 && shotHere(view, unitType, to, supplies) === 0) return "rest";
      if (holds && shot === 0 && !hex.sandbags && threatAt(view, unitType, from) >= FORTIFY_THREAT) return give("infantry:fortify");
      return null;
    }
    case UnitType.TANK: {
      const regroup = holds ? regroupWith(view, from, unitType) : null;
      if (regroup) return regroup;
      if (holds && shot < POOR_SHOT && allowed("tank:mechanic")) return give("tank:mechanic");
      // The last of the fuel is kept while it has a shot from where it stands
      if (!holds && amountOf(supplies, Supply.FUEL) <= 1 && shot > 0) return give("tank:firefight");
      return null;
    }
    case UnitType.ARTILLERY:
      if (holds && shot >= BOMBARDMENT_SHOT && amountOf(supplies, Supply.SHELLS) >= 2) return give("artillery:bombardment");
      return null;
  }
}

/**
 * The fire option of a shot: Explosives in close assault while the unit has them, Suppressive at
 * a unit on an objective hex (to push it off), else the plain one (undefined)
 */
export function chooseFireOption(view: AiView, order: number, target: Position): string | undefined {
  const { session } = view;
  const options = session.fireOptions(order).filter(({ refusal }) => refusal === null).map(({ option }) => option.id);
  const reaches = (option: string) =>
    session.fireTargetsFor(order, option).some((each) => samePosition(each.position, target) && each.lineOfSight && each.dice > 0);
  if (options.includes("infantry:explosives") && reaches("infantry:explosives")) return "infantry:explosives";
  const objectives = view.session.scenario.victory?.objectives ?? [];
  const onObjective = objectives.some((objective) => includesPosition(objective.hexes, inAlliesView(view, target)));
  const suppressive = options.find((option) => option.endsWith(":suppressive"));
  if (onObjective && suppressive && reaches(suppressive)) return suppressive;
  return undefined;
}
