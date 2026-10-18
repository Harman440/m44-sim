// game-core/ai/aiStep.ts
// The computer's side of a match: it looks at what its side has to do now and
// does one thing, through the same actions a person's taps call. The brain
// picks among the options; the rules stay in GameSession and the match.
import GameSession, { GameSnapshot } from "../gameSession";
import PassAndPlayMatch from "../passAndPlay";
import CommandCard, { Section } from "../commandCard";
import { CombatCard } from "../combatCard";
import { EXTRA_SLOT, OrderSlot } from "../orderRules";
import { turnedRound } from "../BoardManager";
import { positionKey } from "../position";
import { RewardChoice } from "../coins";
import { UnitType } from "../unit";
import { TurnPhase } from "../../types/gameManager";
import { Faction } from "../../types/faction";
import { Position } from "../../types/scenario";
import { Side } from "../../types/hex";

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
  /** The order slots to try, in turn (a border unit can fill either section's quota) */
  slots: readonly OrderSlot[];
}

/** The decisions a computer player makes; each returns an allowed option, or null to pass */
export interface Brain {
  dropAt(view: AiView, options: readonly Position[]): Position | null;
  /** The command card, its section when it needs one, and the combat cards played with it */
  pickCard(view: AiView): { card: CommandCard; section?: Section; combatCards?: readonly CombatCard[] };
  /** The next hex to mark for a combat card (Barrage, Air Power…), among the ones it can mark now */
  markFor?(view: AiView, markable: readonly Position[], marking: NonNullable<GameSnapshot["marking"]>): Position | null;
  /** The unit to give a combat card to (Explosives, Medic…), among the ones it can go to */
  assignTo?(view: AiView, card: CombatCard, positions: readonly Position[]): Position | null;
  /** The unit to order next, among those the card can still order */
  nextToOrder(view: AiView, orderable: readonly Position[]): Position | null;
  /** Where the unit goes (with an extra order bought with supplies when `slot` is `EXTRA_SLOT`) */
  moveFor(view: AiView, from: Position, slot?: OrderSlot): MoveChoice;
  /** Once the card's orders are given: a unit to buy an extra order for, or null to lock the orders */
  extraOrder?(view: AiView, extraOrderable: readonly Position[]): Position | null;
  /**
   * The unit that fires now and its targets in turn, or the unit that holds its fire (no
   * targets; it fortifies instead when it can, with Fortify). With Concentrated Fire, `joined`
   * are the units rolling with it
   */
  shotFor(
    view: AiView,
    fireable: readonly number[]
  ): { order: number; targets: readonly Position[]; joined?: readonly number[] };
  retreatTo(view: AiView, from: Position, options: readonly Position[]): Position;
  takeGround(view: AiView, order: number): boolean;
  keepCard(view: AiView, options: readonly CommandCard[]): CommandCard;
  reward(view: AiView): RewardChoice;
  discardCombatCard(view: AiView, hand: readonly CombatCard[]): CombatCard;
  reinforcementAt(view: AiView, options: readonly Position[]): Position | null;
}

/** The enemy army as the computer's side may see it (`opponentOf`), turned into its own view */
export function seenEnemies(match: PassAndPlayMatch, side: Faction): SeenEnemy[] {
  return match.opponentOf(side).units.map((placed) => ({
    position: turnedRound(placed.position),
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
      const { card, section, combatCards = [] } = brain.pickCard(view);
      if (combatCards.length > 0 && session.pickCard(card, section, combatCards)) return true;
      if (session.pickCard(card, section)) return true;
      // Whatever the brain wanted, a card is always played
      return game.hand.some((other) => session.pickCard(other, sectionFor(session, other)));
    }
    case TurnPhase.ORDER_UNITS:
      return orderStep(view, brain);
    case TurnPhase.END_OF_TURN:
      return endOfTurnStep(view, brain);
    default:
      return false;
  }
}

/** A section for a card that needs one: the first that works */
const sectionFor = (session: GameSession, card: CommandCard): Section | undefined =>
  session.cardNeedsSection(card) ? Side.CENTER : undefined;

/**
 * One step of giving orders: a hex marked for a combat card, an order, an extra order bought
 * with supplies, a combat card given to a unit, or the orders locked once nothing is left. A
 * combat card that can't be done as the brain wants goes back to the hand
 */
function orderStep(view: AiView, brain: Brain): boolean {
  const { session } = view;
  const game = session.getSnapshot();
  if (game.marking) {
    const at = game.markable.length > 0 ? (brain.markFor?.(view, game.markable, game.marking) ?? game.markable[0]!) : null;
    if (at && session.markHex(at)) return true;
    return session.cancelCombatCard(game.marking.card);
  }
  if (game.ordersLeft === 0 || game.orderable.length === 0) {
    const extra = brain.extraOrder?.(view, game.extraOrderable) ?? null;
    if (extra) {
      const { to } = brain.moveFor(view, extra, EXTRA_SLOT);
      if (session.issueOrder(extra, to, EXTRA_SLOT) || session.issueOrder(extra, extra, EXTRA_SLOT)) return true;
    }
    // A card for a unit: given to the one the brain picks, or taken back (with its supplies) when no unit can take it
    const assigning = game.assigning;
    if (assigning) {
      const to = assigning.positions.length > 0 ? (brain.assignTo?.(view, assigning.card, assigning.positions) ?? assigning.positions[0]!) : null;
      if (to && session.assignCard(to)) return true;
      if (session.cancelCombatCard(assigning.card)) return true;
    }
    return session.commitOrders();
  }

  const from = brain.nextToOrder(view, game.orderable) ?? game.orderable[0]!;
  const choice = brain.moveFor(view, from);
  const options = session.getMoveOptions(from);
  const slots = choice.slots.length > 0 ? choice.slots : (options?.slots ?? []);
  const before = game.ordersLeft;
  // A border unit fills one section's quota: the slot that leaves the other orders still to give
  for (const to of [choice.to, from]) {
    for (const slot of slots) {
      if (!session.issueOrder(from, to, slot)) continue;
      if (session.getSnapshot().ordersLeft === before - 1) return true;
      session.undoLastOrder();
    }
  }
  return session.commitOrders();
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

  const { order, targets, joined = [] } = brain.shotFor(view, battle.fireable);
  for (const target of targets) {
    if (joined.length > 0 && match.fire(order, target, { joined })) return true;
    if (match.fire(order, target)) return true;
  }
  // Nothing to fire at: Fortify puts sandbags on its hex instead
  if (targets.length === 0 && view.session.getSnapshot().canFortify[order] && match.fortify(order)) return true;
  if (match.holdFire(order)) return true;
  // The brain picked a unit that can't fire now: hold the fire of one that can
  return battle.fireable.some((other) => match.holdFire(other));
}

function endOfTurnStep(view: AiView, brain: Brain): boolean {
  const { session } = view;
  const game = session.getSnapshot();
  if (game.drawOptions.length > 0) return session.keepCard(brain.keepCard(view, game.drawOptions));
  if (game.combatCardDue) return session.drawCombatCard();
  if (game.needsRewardChoice && !game.rewardChoice) {
    const choice = brain.reward(view);
    return session.chooseReward(choice) || session.chooseReward(choice === "coins" ? "combatCard" : "coins");
  }
  if (game.mustDiscardCombatCard) return session.discardCombatCard(brain.discardCombatCard(view, game.combatHand));
  if (game.reinforcementToPlace) {
    const at = brain.reinforcementAt(view, freeHexes(session, view.enemies));
    if (at && session.placeReinforcement(at)) return true;
  }
  return session.endTurn();
}
