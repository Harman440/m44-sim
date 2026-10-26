// game-core/ai/aiStep.ts
// The computer's side of a match: it looks at what its side has to do now and
// does one thing, through the same actions a person's taps call. The brain
// picks among the options; the rules stay in GameSession and the match.
import GameSession, { GameSnapshot } from "../gameSession";
import PassAndPlayMatch from "../passAndPlay";
import type { ActionCard } from "../actionCard";
import { turnedRound } from "../BoardManager";
import { boardSizeOf } from "../boardSize";
import { positionKey, samePosition } from "../position";
import { UnitType } from "../unit";
import { Supply } from "../../data/unitSupplies";
import { TurnPhase } from "../../types/gameManager";
import { Faction } from "../../types/faction";
import { Position } from "../../types/scenario";

/** An enemy unit as the computer's side may see it, in that side's view of the board */
export interface SeenEnemy {
  position: Position;
  unitType: UnitType;
  figures: number | null;
}

/** What the brain is told: its side's game, the enemy as a player on that side would see it, a random source */
export interface AiView {
  side: Faction;
  session: GameSession;
  /** Where the enemy units stand: where they started while their orders are secret */
  enemies: readonly SeenEnemy[];
  random: () => number;
}

export interface MoveChoice {
  to: Position;
}

/**
 * The action a unit is given for the move the brain chose: a named action to a hex, "rest" for no
 * order at all, or null for the plain action of the move (`issueOrder`: Firefight, Assault, Move Out…)
 */
/**
 * The action for a unit, or "rest", or null for the plain action for its move. Regroup names the
 * unit that takes the figures (`receiver`, the unit being ordered or one next to it) and the one
 * that gives them (`partner`)
 */
export type ActionChoice = { action: string; to: Position; partner?: Position; receiver?: Position } | "rest" | null;

/** The decisions a computer player makes; each returns an allowed option, or null to pass */
export interface Brain {
  dropAt(view: AiView, options: readonly Position[]): Position | null;
  /** The command card to play, or null for none (the default) */
  pickCard?(view: AiView): ActionCard | null;
  /** The next hex to mark for the card (Barrage, Air Power…), among the ones it can mark now */
  markFor?(view: AiView, markable: readonly Position[], marking: NonNullable<GameSnapshot["marking"]>): Position | null;
  /** The unit to order next, among those not ordered yet, or null to let the rest rest */
  nextToOrder(view: AiView, orderable: readonly Position[]): Position | null;
  /** Where the unit goes */
  moveFor(view: AiView, from: Position): MoveChoice;
  /** The action for that move; without it, always the plain one */
  actionFor?(view: AiView, from: Position, to: Position): ActionChoice;
  /** The unit that fires now and its targets in turn, or the unit that holds its fire (no targets) */
  shotFor(view: AiView, fireable: readonly number[]): { order: number; targets: readonly Position[] };
  /** The fire option (data/unitActions.ts) for a shot, or undefined for the unit's plain one */
  fireOptionFor?(view: AiView, order: number, target: Position): string | undefined;
  retreatTo(view: AiView, from: Position, options: readonly Position[]): Position;
  takeGround(view: AiView, order: number): boolean;
  reinforcementAt(view: AiView, options: readonly Position[]): Position | null;
}

/** The enemy army as the computer's side may see it (`opponentOf`), turned into its own view */
export function seenEnemies(match: PassAndPlayMatch, side: Faction): SeenEnemy[] {
  return match.opponentOf(side).units.map((placed) => ({
    position: turnedRound(placed.position, boardSizeOf(match.scenario)),
    unitType: placed.unit.getUnitType(),
    figures: placed.figures ?? null,
  }));
}

/** The empty hexes a new unit can stand on, in the side's view */
function freeHexes(session: GameSession, enemies: readonly SeenEnemy[]): Position[] {
  const taken = new Set(enemies.map(({ position }) => positionKey(position)));
  return session.board
    .getAllHexes()
    .filter((hex) => hex.isPassable() && !hex.hasUnit() && !taken.has(positionKey(hex.getPosition())))
    .map((hex) => hex.getPosition());
}

/**
 * Do the computer's next action for `side`, if it has one now. Returns false when there's
 * nothing for it to do (waiting for the person, or for a step both players share: the reveal,
 * the movement and the collisions, ending the battle).
 */
export function aiStep(match: PassAndPlayMatch, side: Faction, brain: Brain, random: () => number = Math.random): boolean {
  const session = match.sessions[side];
  const game = session.getSnapshot();
  const view: AiView = { side, session, enemies: seenEnemies(match, side), random };
  const battle = match.getSnapshot().battle;

  if (battle) return battleStep(match, view, brain);

  switch (game.phase) {
    case TurnPhase.PARADROP: {
      if (game.dropsLeft > 0) {
        const at = brain.dropAt(view, freeHexes(session, view.enemies));
        if (at && session.dropUnit(at)) return true;
      }
      return session.finishParadrop();
    }
    case TurnPhase.PICK_CARDS: {
      // A card the side can't play after all, or one whose hexes it couldn't mark this turn: none
      const card = brain.pickCard?.(view) ?? null;
      const dropped = card !== null && droppedCards.get(session)?.turn === game.turn && droppedCards.get(session)?.card === card.id;
      return (!dropped && session.pickCard(card)) || session.pickCard(null);
    }
    case TurnPhase.ORDER_UNITS:
      return orderStep(view, brain);
    case TurnPhase.END_OF_TURN:
      return endOfTurnStep(view, brain);
    default:
      return false;
  }
}

/** The card each session's computer gave up this turn, its hexes not all markable: not picked again until the next turn */
const droppedCards = new WeakMap<GameSession, { turn: number; card: string }>();

/**
 * One step of giving orders: a hex marked for the card, an order, or the orders locked once the
 * brain orders no more units (the rest rest). A card whose hexes can't all be marked is given
 * up: its marks taken off one a step, then the card taken back. The move the brain wants turns
 * into the action it picks for it, or the plain action for it (`issueOrder`: Firefight, Assault,
 * Move Out…), or a hold that fires; a unit that can pay for neither rests, and one with nothing
 * left to fire reloads
 */
function orderStep(view: AiView, brain: Brain): boolean {
  const { session } = view;
  const game = session.getSnapshot();
  const played = game.playedCard;
  const dropped = droppedCards.get(session);
  if (played && dropped?.turn === game.turn && dropped.card === played.id) return session.undoMarker() || session.unpickCard();
  if (game.marking) {
    const at = game.markable.length > 0 ? (brain.markFor?.(view, game.markable, game.marking) ?? game.markable[0]!) : null;
    if (at && session.markHex(at)) return true;
    droppedCards.set(session, { turn: game.turn, card: game.marking.card.id });
    return session.undoMarker() || session.unpickCard();
  }
  let candidates = game.orderable;
  while (candidates.length > 0) {
    const from = brain.nextToOrder(view, candidates);
    if (!from) break;
    candidates = candidates.filter((position) => !samePosition(position, from));
    if (reloadIfEmpty(session, from)) return true;
    const { to } = brain.moveFor(view, from);
    const choice = brain.actionFor?.(view, from, to) ?? null;
    if (choice === "rest") continue;
    if (choice?.partner && session.giveRegroup(choice.receiver ?? from, choice.partner)) return true;
    if (choice && !choice.partner && session.giveAction(from, choice.action, choice.to)) return true;
    if (session.issueOrder(from, to) || session.issueOrder(from, from)) return true;
  }
  return session.commitOrders();
}

/**
 * A unit with no ammo or shells for any action that fires is given Reload, when it can be, by
 * any brain, before it picks the unit's action
 */
function reloadIfEmpty(session: GameSession, from: Position): boolean {
  const actions = session.getActions(from) ?? [];
  // Its actions that fire where it stands (armour may still move with no shells: those don't count)
  const firing = actions.filter(({ action }) => action.fire && action.move === 0);
  const empty = firing.length > 0 && firing.every(({ refusal }) => refusal === Supply.AMMO || refusal === Supply.SHELLS);
  const reload = actions.find(({ action, refusal }) => action.effect === "reload" && refusal === null);
  return empty && !!reload && session.giveAction(from, reload.action.id, from);
}

function battleStep(match: PassAndPlayMatch, view: AiView, brain: Brain): boolean {
  const { side } = view;
  const battle = match.getSnapshot().battle!;
  if (battle.attacks.includes(side)) return match.rollAttacks(side);
  if (battle.retreat) {
    if (battle.retreat.side !== side) return false;
    const { position, options } = battle.retreat;
    return match.retreat(brain.retreatTo(view, position, options));
  }
  if (battle.ground) {
    if (battle.ground.side !== side) return false;
    return match.decideGround(brain.takeGround(view, battle.ground.order));
  }
  if (battle.afterBattle) {
    const due = battle.afterBattle;
    if (due.side !== side) return false;
    // The brains don't move units after the battle (Behind Enemy Lines) yet: it stays
    if (due.kind === "move") return match.skipMoveAfterBattle();
    const at = brain.reinforcementAt(view, [...due.options]);
    return (!!at && match.moveAfterBattle(at)) || due.options.some((option) => match.moveAfterBattle(option));
  }
  if (battle.side !== side || battle.fireable.length === 0) return false;

  const { order, targets } = brain.shotFor(view, battle.fireable);
  for (const target of targets) {
    const option = brain.fireOptionFor?.(view, order, target);
    if ((option && match.fire(order, target, option)) || match.fire(order, target)) return true;
  }
  if (match.holdFire(order)) return true;
  // The brain picked a unit that can't fire now: hold the fire of one that can
  return battle.fireable.some((other) => match.holdFire(other));
}

function endOfTurnStep(view: AiView, brain: Brain): boolean {
  const { session } = view;
  const game = session.getSnapshot();
  if (game.reinforcementToPlace) {
    const at = brain.reinforcementAt(view, freeHexes(session, view.enemies));
    if (at && session.placeReinforcement(at)) return true;
  }
  return session.endTurn();
}
