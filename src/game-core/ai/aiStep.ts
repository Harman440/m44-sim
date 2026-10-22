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
  /** The unit that fires now and its targets in turn, or the unit that holds its fire (no targets) */
  shotFor(view: AiView, fireable: readonly number[]): { order: number; targets: readonly Position[] };
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
    case TurnPhase.PICK_CARDS:
      // A card the side can't play after all: none
      return session.pickCard(brain.pickCard?.(view) ?? null) || session.pickCard(null);
    case TurnPhase.ORDER_UNITS:
      return orderStep(view, brain);
    case TurnPhase.END_OF_TURN:
      return endOfTurnStep(view, brain);
    default:
      return false;
  }
}

/**
 * One step of giving orders: a hex marked for the card, an order, or the orders locked once the
 * brain orders no more units (the rest rest). A card whose hexes can't be marked is taken back.
 * The move the brain wants turns into the plain action for it (`issueOrder`: Firefight, Assault,
 * Move Out…), or a hold that fires; a unit that can pay for neither rests, and one with nothing
 * left to fire reloads
 */
function orderStep(view: AiView, brain: Brain): boolean {
  const { session } = view;
  const game = session.getSnapshot();
  if (game.marking) {
    const at = game.markable.length > 0 ? (brain.markFor?.(view, game.markable, game.marking) ?? game.markable[0]!) : null;
    if (at && session.markHex(at)) return true;
    return session.unpickCard();
  }
  let candidates = game.orderable;
  while (candidates.length > 0) {
    const from = brain.nextToOrder(view, candidates);
    if (!from) break;
    if (reloadIfEmpty(session, from)) return true;
    const { to } = brain.moveFor(view, from);
    if (session.issueOrder(from, to) || session.issueOrder(from, from)) return true;
    candidates = candidates.filter((position) => !samePosition(position, from));
  }
  return session.commitOrders();
}

/**
 * A unit with no ammo or shells for any action that fires is given Reload, when it can be (until
 * the brains choose actions themselves, docs/ACTIONS_PLAN.md R15)
 */
function reloadIfEmpty(session: GameSession, from: Position): boolean {
  const actions = session.getActions(from) ?? [];
  const firing = actions.filter(({ action }) => action.fire);
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
  if (battle.side !== side || battle.fireable.length === 0) return false;

  const { order, targets } = brain.shotFor(view, battle.fireable);
  for (const target of targets) {
    if (match.fire(order, target)) return true;
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
