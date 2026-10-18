import { TEST_MODE_COINS } from "../data/coinRules";
import Unit, { UnitType } from "./unit";
import { shoot } from "../test/shots";
import { DieFace } from "./dice";
import { describe, expect, it, vi } from "vitest";
import GameSession from "./gameSession";
import { SAVE_VERSION, SavedGame } from "./saveGame";
import CommandCard, { CommandCardProps } from "./commandCard";
import { CombatCard } from "./combatCard";
import { readRoll } from "./rollResult";
import Hex from "./hex";
import { HexType, Side } from "../types/hex";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { includesPosition, positionKey, samePosition } from "./position";
import { hexDistance } from "./fireTargets";
import { summarizeOrders } from "./turnSummary";
import { same } from "../i18n/lang";

/** Default target for shots whose reading the test doesn't check */
const AT_INFANTRY = { infantry: true, closeAssault: false };

// Allies (no flip): infantry left (7,1), left-center (7,3), right (8,11);
// tank in the open center at (4,6) with forest to its east at (4,7)
const scenario: Scenario = {
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  initialHandSize: { allies: 3, axis: 3 },
  attacker: "Allies",
  tiles: { forest: [{ row: 4, col: 7 }] },
  units: {
    allies: {
      infantry: [{ row: 7, col: 1 }, { row: 7, col: 3 }, { row: 8, col: 11 }],
      tank: [{ row: 4, col: 6 }],
    },
    axis: {},
  },
};

const TANK: Position = { row: 4, col: 6 };
const LEFT_INF: Position = { row: 7, col: 1 };

const cards = () => [
  new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
  new CommandCard({ id: "right", sections: [Side.RIGHT], orders: 2 }),
  new CommandCard({ id: "all", orders: 6 }),
  new CommandCard({ id: "tank", unitTypes: [UnitType.TANK], orders: 4 }),
];

/** Session with the 4 test cards shuffled; `deckSize` of them stay in the deck, the rest are in hand */
const makeSession = (deckSize = 1) => {
  const commandCards = cards();
  return new GameSession({
    scenario,
    faction: "Allies",
    initialHandSize: commandCards.length - deckSize,
    commandCards,
  });
};

/** Session whose whole deck is in hand, so tests can pick any card */
const sessionWithAllCards = () => {
  const session = makeSession(0);
  const card = (id: string) => session.getSnapshot().hand.find((c) => c.id === id)!;
  return { session, card };
};

const unitAt = (session: GameSession, p: Position) => session.board.getHex(p)!.unit;

const orderablePositions = (session: GameSession) => session.getSnapshot().orderable.map(positionKey).sort();

/** Give hold orders until none are left, then commit and go to battle */
const orderAllAndFight = (session: GameSession) => {
  while (session.getSnapshot().ordersLeft > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
  expect(session.startBattle()).toBe(true);
};

/** From battle (or the final phase) to the next turn: final phase (the card is drawn), reward, end */
const finishTurn = (session: GameSession) => {
  if (session.getSnapshot().phase === TurnPhase.BATTLE) expect(session.endBattle()).toBe(true);
  expect(session.getSnapshot().drawnCard).not.toBeNull();
  if (session.getSnapshot().needsRewardChoice) expect(session.chooseReward("combatCard")).toBe(true);
  expect(session.endTurn()).toBe(true);
};

describe("GameSession setup", () => {
  it("starts on turn 1 picking cards, with the initial hand drawn", () => {
    const snapshot = makeSession(1).getSnapshot();

    expect(snapshot.turn).toBe(1);
    expect(snapshot.phase).toBe(TurnPhase.PICK_CARDS);
    expect(snapshot.hand).toHaveLength(3);
    expect(snapshot.drawPileCount).toBe(1);
    expect(snapshot.discardPileCount).toBe(0);
  });

  it("returns the same snapshot until something changes (required by useSyncExternalStore)", () => {
    const { session, card } = sessionWithAllCards();
    const before = session.getSnapshot();

    expect(session.getSnapshot()).toBe(before);

    session.pickCard(card("left"));
    expect(session.getSnapshot()).not.toBe(before);
  });

  it("notifies subscribers on changes but not on rejected actions", () => {
    const { session, card } = sessionWithAllCards();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    session.startBattle(); // not allowed while picking cards
    expect(listener).not.toHaveBeenCalled();

    session.pickCard(card("left"));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    session.issueOrder(LEFT_INF, LEFT_INF);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("GameSession picking a card", () => {
  it("moves to ordering with the orders left capped at the units available", () => {
    const { session, card } = sessionWithAllCards();

    expect(session.pickCard(card("all"))).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe(TurnPhase.ORDER_UNITS);
    expect(snapshot.chosenCard?.id).toBe("all");
    expect(snapshot.ordersLeft).toBe(4); // card allows 6, only 4 units
  });

  it("sets orders left straight away, so the orders screen never starts at 0 (B11)", () => {
    const { session, card } = sessionWithAllCards();

    session.pickCard(card("left"));

    expect(session.getSnapshot().ordersLeft).toBe(2);
  });

  it("rejects a card that isn't in the hand, or a second card", () => {
    const { session, card } = sessionWithAllCards();

    expect(session.pickCard(new CommandCard({ id: "stranger" }))).toBe(false);
    expect(session.pickCard(card("left"))).toBe(true);
    expect(session.pickCard(card("right"))).toBe(false);
    expect(session.getSnapshot().chosenCard?.id).toBe("left");
  });
});

describe("GameSession giving orders", () => {
  it("only offers moves for units the card lets you order", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));

    expect(session.getMoveOptions({ row: 8, col: 11 })).toBeNull(); // right flank
    expect(session.getMoveOptions({ row: 0, col: 0 })).toBeNull(); // empty hex
    expect(session.getMoveOptions(LEFT_INF)?.moves.length).toBeGreaterThan(0);
  });

  it("moves a unit and records the path from start to destination (B5)", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    const tank = unitAt(session, TANK);
    const destination = { row: 5, col: 6 };

    expect(session.issueOrder(TANK, destination)).toBe(true);

    const [order] = session.getSnapshot().orders;
    expect(order!.path).toEqual([TANK, destination]);
    expect(order!.canFire).toBe(true);
    expect(unitAt(session, destination)).toBe(tank);
    expect(unitAt(session, TANK)).toBeNull();
    expect(session.getSnapshot().ordersLeft).toBe(3);
  });

  it("can't fire after moving into forest", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));

    session.issueOrder(TANK, { row: 4, col: 7 });

    expect(session.getSnapshot().orders[0]!.canFire).toBe(false);
  });

  it("orders a unit to hold and fire when its own hex is chosen", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));

    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);

    const [order] = session.getSnapshot().orders;
    expect(order!.canFire).toBe(true);
    expect(session.getMoveOptions(LEFT_INF)).toBeNull(); // already ordered
  });

  it("rejects a destination out of range without changing anything", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    const before = session.getSnapshot();

    expect(session.issueOrder(LEFT_INF, { row: 7, col: 6 })).toBe(false);

    expect(session.getSnapshot()).toBe(before);
    expect(unitAt(session, LEFT_INF)).not.toBeNull();
  });

  it("undoes the last order, putting the unit back", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    const tank = unitAt(session, TANK);
    session.issueOrder(TANK, { row: 5, col: 6 });

    expect(session.undoLastOrder()).toBe(true);

    expect(unitAt(session, TANK)).toBe(tank);
    expect(orderablePositions(session)).toContain(positionKey(TANK));
    expect(session.getSnapshot().orders).toHaveLength(0);
    expect(session.getSnapshot().ordersLeft).toBe(4);
  });

  it("only commits once every order is given, then locks the orders", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    session.issueOrder(LEFT_INF, LEFT_INF);

    expect(session.commitOrders()).toBe(false);
    expect(session.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);

    session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 });
    expect(session.commitOrders()).toBe(true);

    expect(orderablePositions(session)).toEqual([]);
    expect(session.undoLastOrder()).toBe(false);
    expect(session.getMoveOptions(TANK)).toBeNull();
  });
});

describe("GameSession card rules", () => {
  const BORDER: Position = { row: 7, col: 3 };
  const WEST_OF_TANK: Position = { row: 4, col: 5 };

  /** Session holding just this card */
  const withCard = (props: CommandCardProps) => {
    const commandCards = [new CommandCard({ id: "card", ...props })];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards });
    return { session, card: session.getSnapshot().hand[0]!, commandCards };
  };

  it("needs the section for a card that orders in a section of the player's choice", () => {
    const { session, card } = withCard({ sections: "chosen", orders: "all" });

    expect(session.pickCard(card)).toBe(false);
    expect(session.pickCard(card, Side.LEFT)).toBe(true);

    expect(session.getSnapshot().chosenSection).toBe(Side.LEFT);
    expect(orderablePositions(session)).toEqual(["7-1", "7-3"]);
    expect(session.getSnapshot().ordersLeft).toBe(2);
  });

  it("refuses a section for a card that has its own", () => {
    const { session, card } = withCard({ sections: [Side.LEFT], orders: 2 });

    expect(session.pickCard(card, Side.RIGHT)).toBe(false);
  });

  it("has the player pick the section of a border unit when both have orders left", () => {
    const { session, card } = withCard({ orders: 3, perSection: 1 });
    session.pickCard(card);

    expect(session.getMoveOptions(BORDER)!.slots).toHaveLength(2);
    expect(session.issueOrder(BORDER, BORDER)).toBe(false);
    expect(session.issueOrder(BORDER, BORDER, { section: Side.CENTER, onTheMove: false })).toBe(true);

    expect(session.getSnapshot().orders[0]!.section).toBe(Side.CENTER);
    // The center's order is used: the tank there can't be ordered any more
    expect(orderablePositions(session)).toEqual(["7-1", "8-11"]);
    expect(session.getSnapshot().ordersLeft).toBe(2);
  });

  it("orders a unit on the move anywhere, and it can't fire", () => {
    const { session, card } = withCard({ sections: [Side.LEFT], orders: 1, onTheMove: 1 });
    session.pickCard(card);

    session.issueOrder(LEFT_INF, LEFT_INF);
    expect(session.issueOrder(TANK, WEST_OF_TANK)).toBe(true);

    expect(session.getSnapshot().orders[0]).toMatchObject({ onTheMove: false, shots: 1 });
    // A tank moving 1 hex over open ground could fire with a card order
    expect(session.getSnapshot().orders[1]).toMatchObject({ onTheMove: true, shots: 0 });
    expect(session.getSnapshot().ordersLeft).toBe(0);
  });

  it("only lets units hold with a card that can't move", () => {
    const { session, card } = withCard({ orders: 2, noMove: true });
    session.pickCard(card);

    expect(session.getMoveOptions(TANK)!.moves).toEqual([]);
    expect(session.issueOrder(TANK, WEST_OF_TANK)).toBe(false);
    expect(session.issueOrder(TANK, TANK)).toBe(true);
  });

  it("gives the card's extra shots only to a unit that holds", () => {
    const { session, card } = withCard({ orders: 2, holdShots: 2 });
    session.pickCard(card);

    session.issueOrder(LEFT_INF, LEFT_INF);
    session.issueOrder(TANK, WEST_OF_TANK);

    expect(session.getSnapshot().orders.map((o) => o.shots)).toEqual([2, 1]);
  });

  it("keeps the chosen section and the orders' sections after a reload, until the turn ends", () => {
    const { session, card, commandCards } = withCard({ sections: "chosen", orders: 2, perSection: 1 });
    session.pickCard(card, Side.CENTER);
    session.issueOrder(BORDER, BORDER);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, commandCards);

    expect(restored.getSnapshot().chosenSection).toBe(Side.CENTER);
    expect(restored.getSnapshot().orders[0]!.section).toBe(Side.CENTER);
    expect(restored.getSnapshot().ordersLeft).toBe(0);
    orderAllAndFight(restored);
    finishTurn(restored);
    expect(restored.getSnapshot().chosenSection).toBeNull();
  });
});

describe("GameSession unit-type cards with none of their units", () => {
  const withCard = (props: CommandCardProps) => {
    const commandCards = [new CommandCard({ id: "card", name: same("Carta"), ...props })];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards });
    return { session, card: session.getSnapshot().hand[0]! };
  };

  it("orders 1 unit of any type, without the card's bonus", () => {
    const { session, card } = withCard({
      unitTypes: [UnitType.ARTILLERY],
      orders: 4,
      fireBonus: [{ dice: 1 }],
    });
    session.pickCard(card);

    expect(session.getSnapshot().activeCard).toMatchObject({ orders: 1, fireBonus: [] });
    expect(session.getSnapshot().ordersLeft).toBe(1);
    expect(orderablePositions(session)).toHaveLength(4);
  });

  it("doesn't ask for a section then", () => {
    const { session, card } = withCard({ sections: "chosen", unitTypes: [UnitType.ARTILLERY], orders: "all" });

    expect(session.cardNeedsSection(card)).toBe(false);
    expect(session.pickCard(card, Side.LEFT)).toBe(false);
    expect(session.pickCard(card)).toBe(true);
  });
});

describe("GameSession Close Assault card", () => {
  const ADJACENT = { infantry: true, closeAssault: true };

  /** In battle with a Close Assault card: no orders were given */
  const closeAssault = () => {
    const commandCards = [
      new CommandCard({
        id: "close",
        name: same("Asalto cercano"),
        closeAssaultOnly: true,
        fireBonus: [{ dice: 1, closeAssault: true }],
      }),
    ];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, random: () => 0 });
    session.pickCard(session.getSnapshot().hand[0]!);
    expect(session.getSnapshot().ordersLeft).toBe(0);
    orderAllAndFight(session);
    return session;
  };

  it("gives no orders, and marks units in close assault only in the battle", () => {
    const commandCards = [new CommandCard({ id: "close", closeAssaultOnly: true })];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards });
    session.pickCard(session.getSnapshot().hand[0]!);

    expect(session.getSnapshot().orderable).toEqual([]);
    expect(session.markCloseAssault(LEFT_INF)).toBe(false);

    orderAllAndFight(session);
    expect(session.getSnapshot().closeAssaultMarkable).toHaveLength(4);
  });

  it("lets a marked unit fire once, at an adjacent enemy, with the card's die", () => {
    const session = closeAssault();

    expect(session.markCloseAssault(LEFT_INF)).toBe(true);
    expect(session.markCloseAssault(LEFT_INF)).toBe(false);
    expect(session.getSnapshot().orders[0]).toMatchObject({ closeAssaultOnly: true, shots: 1 });
    expect(session.getSnapshot().closeAssaultMarkable).toHaveLength(3);

    const at = (distance: string) => ({ distance, targetType: "infantry", targetTerrain: "plains", sandbags: "no", camouflage: "no" });
    expect(session.fire(0, { ...at("2"), lineOfSight: "yes" })).toBe(false);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false);
    expect(session.fire(0, at("1"))).toBe(true);

    expect(session.getSnapshot().shots[0]!.dice).toBe(4);
    expect(session.shotsLeft(0)).toBe(0);
  });

  it("takes back the last mark until that unit has fired", () => {
    const session = closeAssault();
    session.markCloseAssault(LEFT_INF);
    session.markCloseAssault(TANK);

    expect(session.undoCloseAssaultMark()).toBe(true);
    expect(session.getSnapshot().orders).toHaveLength(1);

    shoot(session, 0, ADJACENT);
    expect(session.undoCloseAssaultMark()).toBe(false);
  });

  it("keeps the marks after a reload", () => {
    const session = closeAssault();
    session.markCloseAssault(TANK);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, [
      new CommandCard({ id: "close", closeAssaultOnly: true }),
    ]);

    expect(restored.getSnapshot().orders[0]).toMatchObject({ closeAssaultOnly: true });
    expect(shoot(restored, 0, ADJACENT)).toBe(true);
  });
});

describe("GameSession movement and final phases", () => {
  it("goes orders -> movement -> battle -> final phase, one step at a time", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    session.issueOrder(LEFT_INF, LEFT_INF);
    session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 });

    expect(session.startBattle()).toBe(false); // orders not confirmed yet
    expect(session.commitOrders()).toBe(true); // confirming goes straight to movement
    expect(session.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
    expect(session.commitOrders()).toBe(false);
    expect(session.removeUnit(LEFT_INF)).toBe(false);
    expect(session.endBattle()).toBe(false);

    expect(session.startBattle()).toBe(true);
    expect(session.removeUnit(LEFT_INF)).toBe(false); // the map is updated after the battle
    expect(session.endBattle()).toBe(true);
    expect(session.getSnapshot().phase).toBe(TurnPhase.END_OF_TURN);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false); // units that didn't fire have lost the shot
    expect(session.removeUnit(LEFT_INF)).toBe(true);
  });

  it("draws the command card as the final phase starts, once, and only then ends the turn", () => {
    const session = makeSession(1);
    const played = session.getSnapshot().hand[0]!;
    session.pickCard(played);
    orderAllAndFight(session);
    expect(session.drawCard()).toBe(false); // still in battle
    expect(session.getSnapshot().drawnCard).toBeNull();
    session.endBattle();

    // A single card is kept at once, and can still be swapped
    const { drawnCard, drawOptions, hand, turn, phase, canDrawAgain } = session.getSnapshot();
    expect(drawnCard).not.toBeNull();
    expect(drawOptions).toEqual([]);
    expect(canDrawAgain).toBe(true);
    expect(hand).not.toContain(played);
    expect(hand).toContain(drawnCard);
    expect({ turn, phase }).toEqual({ turn: 1, phase: TurnPhase.END_OF_TURN });
    expect(session.drawCard()).toBe(false);
    expect(session.keepCard(drawnCard!)).toBe(false);

    expect(session.endTurn()).toBe(true);
    expect(session.getSnapshot().drawnCard).toBeNull();
  });

  it("keeps the phase and the drawn card after a reload", () => {
    const session = makeSession(1);
    session.pickCard(session.getSnapshot().hand[0]!);
    orderAllAndFight(session);
    session.endBattle();
    session.drawCard();

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, cards());

    expect(restored.getSnapshot().phase).toBe(TurnPhase.END_OF_TURN);
    expect(restored.getSnapshot().drawnCard?.id).toBe(session.getSnapshot().drawnCard?.id);
    expect(restored.drawCard()).toBe(false);
    expect(restored.endTurn()).toBe(true);
  });
});

describe("GameSession ending the turn", () => {
  it("discards the played card, draws a new one and clears the orders", () => {
    const session = makeSession(1);
    const played = session.getSnapshot().hand[0]!;
    session.pickCard(played);
    orderAllAndFight(session);

    finishTurn(session);

    const snapshot = session.getSnapshot();
    expect(snapshot.turn).toBe(2);
    expect(snapshot.phase).toBe(TurnPhase.PICK_CARDS);
    expect(snapshot.hand).toHaveLength(3);
    expect(snapshot.hand).not.toContain(played);
    expect(snapshot.discardPileCount).toBe(1);
    expect(snapshot.drawPileCount).toBe(0);
    expect(snapshot.orders).toEqual([]);
    expect(snapshot.chosenCard).toBeNull();
  });

  it("only ends the turn from the final phase", () => {
    const { session, card } = sessionWithAllCards();

    expect(session.endTurn()).toBe(false);
    session.pickCard(card("left"));
    expect(session.endTurn()).toBe(false);
    orderAllAndFight(session);
    expect(session.endTurn()).toBe(false);
  });

  it("never loses or duplicates a card over many turns, reshuffles included", () => {
    const session = makeSession(1);
    const totalCards = 4;

    for (let turn = 1; turn <= 30; turn++) {
      const before = session.getSnapshot();
      expect(before.hand.length + before.drawPileCount + before.discardPileCount).toBe(totalCards);
      expect(new Set(before.hand.map((c) => c.id)).size).toBe(before.hand.length);

      session.pickCard(before.hand[0]!);
      orderAllAndFight(session);
      finishTurn(session);
    }
    expect(session.getSnapshot().turn).toBe(31);
  });
});

describe("GameSession drawing a command card", () => {
  const recon = () =>
    new CommandCard({ id: "recon", sections: [Side.LEFT], orders: 1, onTheMove: 1, drawChoice: 3 });

  /** In the final phase after playing `played`; the other cards are in the deck in order */
  const finalPhaseWith = (played: CommandCard, deck: CommandCard[]) => {
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 0, commandCards: [] });
    const restored = GameSession.restore(
      { ...session.save(), hand: [played.id], drawPile: deck.map((c) => c.id) },
      scenario,
      [played, ...deck]
    );
    restored.pickCard(played);
    orderAllAndFight(restored);
    restored.endBattle();
    return restored;
  };

  it("swaps the card drawn once (Gamble): the first is discarded and the next must be kept", () => {
    const [played, first, second, third] = cards();
    const session = finalPhaseWith(played!, [first!, second!, third!]);

    session.drawCard();
    expect(session.getSnapshot()).toMatchObject({ drawnCard: first, drawOptions: [], canDrawAgain: true });
    expect(session.getSnapshot().hand).toEqual([first]);
    expect(session.drawAgain()).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot).toMatchObject({ drawnCard: second, drawOptions: [], drewAgain: true, canDrawAgain: false });
    expect(snapshot.hand).toEqual([second]);
    expect(snapshot.discardPileCount).toBe(2); // the played card and the first one drawn
    expect(session.drawAgain()).toBe(false);
    expect(session.keepCard(first!)).toBe(false);

    expect(session.endTurn()).toBe(true);
    expect(session.getSnapshot().drewAgain).toBe(false);
  });

  it("swaps even when the deck is empty, without drawing the discarded card back", () => {
    const [played, first] = cards();
    const session = finalPhaseWith(played!, [first!]);

    session.drawCard(); // the deck is now empty
    expect(session.drawAgain()).toBe(true);

    // The reshuffled discard pile only holds the played card
    expect(session.getSnapshot().drawnCard).toBe(played);
  });

  it("draws 3 and keeps 1 after a Recon card, with no swap", () => {
    const [first, second, third, fourth] = cards();
    const session = finalPhaseWith(recon(), [first!, second!, third!, fourth!]);

    session.drawCard();
    expect(session.getSnapshot()).toMatchObject({ drawOptions: [first, second, third], canDrawAgain: false });
    expect(session.drawAgain()).toBe(false);
    expect(session.keepCard(fourth!)).toBe(false); // not one of the cards drawn

    expect(session.keepCard(second!)).toBe(true);
    const snapshot = session.getSnapshot();
    expect(snapshot.hand).toEqual([second]);
    expect(snapshot.discardPileCount).toBe(3); // Recon and the two left over
    expect(snapshot.drawPileCount).toBe(1);
  });

  it("keeps the cards drawn but not yet chosen after a reload", () => {
    const [first, second, third] = cards();
    const reconCard = recon();
    const session = finalPhaseWith(reconCard, [first!, second!, third!]);
    session.drawCard();

    const all = [reconCard, ...cards()];
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, all);

    expect(restored.getSnapshot().drawOptions.map((c) => c.id)).toEqual(["left", "right", "all"]);
    expect(restored.keepCard(restored.getSnapshot().drawOptions[2]!)).toBe(true);
    expect(restored.getSnapshot().drawnCard?.id).toBe("all");
  });
});

describe("GameSession syncing the table in the final phase", () => {
  const inFinalPhase = () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    session.endBattle();
    return session;
  };

  it("only allows board edits in the final phase, or in Órdenes before any order", () => {
    const { session, card } = sessionWithAllCards();

    expect(session.removeUnit(TANK)).toBe(false); // picking cards
    session.pickCard(card("left"));
    const left = session.getSnapshot().orderable[0]!;
    session.issueOrder(left, left);
    expect(session.getSnapshot().canEditMap).toBe(false);
    expect(session.relocateUnit(TANK, { row: 3, col: 3 })).toBe(false); // an order was given
    session.undoLastOrder();
    orderAllAndFight(session);
    expect(session.removeUnit(TANK)).toBe(false); // retreats are made after the battle
    expect(session.relocateUnit(TANK, { row: 3, col: 3 })).toBe(false);
    expect(unitAt(session, TANK)).not.toBeNull();
  });

  it("fixes the map in Órdenes before any order; those fixes can't be undone after the orders", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    const tank = unitAt(session, TANK);
    const fixed = { row: 3, col: 3 };

    expect(session.getSnapshot()).toMatchObject({ canEditMap: true, canUndoMapEdit: false });
    expect(session.relocateUnit(TANK, fixed)).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ battleEdits: 1, canUndoMapEdit: true });
    expect(session.undoBattleEdit()).toBe(true);
    expect(unitAt(session, TANK)).toBe(tank);
    expect(session.relocateUnit(TANK, fixed)).toBe(true);

    orderAllAndFight(session);
    session.endBattle();
    expect(session.getSnapshot()).toMatchObject({ canEditMap: true, canUndoMapEdit: false });
    expect(session.undoBattleEdit()).toBe(false);
    expect(unitAt(session, fixed)).toBe(tank);

    // The fix survives a reload and is in the turn's map edits
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, cards());
    expect(restored.getSnapshot()).toMatchObject({ battleEdits: 1, canUndoMapEdit: false });
    expect(restored.removeUnit(LEFT_INF)).toBe(true);
    expect(restored.undoBattleEdit()).toBe(true);
    expect(restored.undoBattleEdit()).toBe(false);
  });

  it("removes a destroyed unit and can undo it", () => {
    const session = inFinalPhase();
    const tank = unitAt(session, TANK);

    expect(session.removeUnit(TANK)).toBe(true);
    expect(unitAt(session, TANK)).toBeNull();
    expect(session.getSnapshot().battleEdits).toBe(1);
    expect(session.removeUnit(TANK)).toBe(false); // nothing left there

    expect(session.undoBattleEdit()).toBe(true);
    expect(unitAt(session, TANK)).toBe(tank);
    expect(session.getSnapshot().battleEdits).toBe(0);
  });

  it("moves a unit to any empty hex, however far, and can undo it", () => {
    const session = inFinalPhase();
    const tank = unitAt(session, TANK);
    const farAway = { row: 0, col: 0 };

    expect(session.relocateUnit(TANK, farAway)).toBe(true);
    expect(unitAt(session, farAway)).toBe(tank);

    expect(session.undoBattleEdit()).toBe(true);
    expect(unitAt(session, TANK)).toBe(tank);
    expect(unitAt(session, farAway)).toBeNull();
  });

  it("won't move a unit onto another unit or from an empty hex", () => {
    const session = inFinalPhase();

    expect(session.relocateUnit(TANK, LEFT_INF)).toBe(false);
    expect(session.relocateUnit({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(false);
    expect(session.getSnapshot().battleEdits).toBe(0);
  });

  it("keeps the changes into the next turn and clears the undo history", () => {
    const session = inFinalPhase();
    session.removeUnit(TANK);
    session.relocateUnit(LEFT_INF, { row: 6, col: 1 });

    finishTurn(session);

    expect(session.getSnapshot().battleEdits).toBe(0);
    expect(unitAt(session, TANK)).toBeNull();
    expect(unitAt(session, { row: 6, col: 1 })).not.toBeNull();
    expect(session.undoBattleEdit()).toBe(false);
    // With the tank gone, the tank card falls back to 1 unit of any type
    // (the whole deck is in hand, so the tank card is always there)
    const tankCard = session.getSnapshot().hand.find((c) => c.unitTypes?.includes(UnitType.TANK))!;
    session.pickCard(tankCard);
    expect(session.getSnapshot().ordersLeft).toBe(1);
    expect(session.getSnapshot().orderable).toHaveLength(3);
  });
});

describe("GameSession firing", () => {
  // Left card: the infantry at (7,1) and (7,3) hold and fire; orders 0 and 1
  const battle = (options: { holdShots?: number } = {}) => {
    const commandCards = [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2, ...options }),
    ];
    // Always rolls the first face: infantry
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, random: () => 0 });
    session.pickCard(session.getSnapshot().hand[0]!);
    orderAllAndFight(session);
    return session;
  };

  it("works out the dice from the answers, rolls them once and keeps the result", () => {
    const session = battle();

    expect(session.fire(0, { distance: "2", lineOfSight: "yes", targetType: "infantry", targetTerrain: "plains", sandbags: "no", camouflage: "no" })).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ orderIndex: 0, dice: 2, faces: ["infantry", "infantry"] });
    expect(shot!.steps.map((s) => s.dice)).toEqual([2]);
    expect(session.shotsLeft(0)).toBe(0);
    expect(session.fire(0, { distance: "1", targetType: "infantry", targetTerrain: "plains", sandbags: "no", camouflage: "no" })).toBe(false);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false);
    expect(session.getSnapshot().shots).toHaveLength(1);
  });

  it("won't take a shot the questionnaire ruled out (no line of sight)", () => {
    const session = battle();

    expect(session.fire(0, { distance: "2", lineOfSight: "no" })).toBe(false);
    expect(session.shotsLeft(0)).toBe(1);
  });

  it("keeps the questionnaire's reminders with the shot, also after a reload", () => {
    const session = battle();
    session.fire(0, { distance: "1", targetType: "infantry", targetTerrain: "plains", sandbags: "yes" });

    const [shot] = session.getSnapshot().shots;
    expect(shot!.notes.map((note) => note.es)).toEqual(["Sacos terreros: el objetivo ignora 1 bandera."]);
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
    ]);
    expect(restored.getSnapshot().shots[0]!.notes).toEqual(shot!.notes);
  });

  it("won't fire before the questionnaire is complete", () => {
    const session = battle();

    expect(session.fire(0, { distance: "2" })).toBe(false);
    expect(session.getSnapshot().shots).toHaveLength(0);
  });

  it("records a 0-dice shot without rolling: the unit has used its fire", () => {
    const session = battle();

    expect(session.fire(0, { distance: "3", lineOfSight: "yes", targetType: "infantry", targetTerrain: "town", sandbags: "no", camouflage: "no" })).toBe(true);

    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 0, faces: [] });
    expect(session.shotsLeft(0)).toBe(0);
  });

  it("only fires in battle, with a unit that can fire", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    session.issueOrder(TANK, { row: 4, col: 7 }); // into forest: can't fire
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false); // not in battle yet
    orderAllAndFight(session);

    expect(shoot(session, 0, AT_INFANTRY)).toBe(false);
    expect(shoot(session, 99, AT_INFANTRY)).toBe(false);
  });

  it("keeps the target with the shot: close assault when the target is adjacent", () => {
    const session = battle();

    session.fire(0, { distance: "1", targetType: "other", targetTerrain: "plains", sandbags: "no", camouflage: "no" });
    session.fire(1, { distance: "2", lineOfSight: "yes", targetType: "other", targetTerrain: "plains", sandbags: "no", camouflage: "no" });

    expect(session.getSnapshot().shots.map((s) => s.target)).toEqual([
      { infantry: false, closeAssault: true, die: "battle" },
      { infantry: false, closeAssault: false, die: "battle" },
    ]);
  });

  it("won't fire without a known target type", () => {
    const session = battle();

    expect(session.fire(0, { distance: "1", targetType: "horse", targetTerrain: "plains", sandbags: "no", camouflage: "no" })).toBe(false);
    expect(session.fire(0, { distance: "1", targetType: "tank", targetTerrain: "plains", sandbags: "no", camouflage: "no" })).toBe(false);
    expect(session.getSnapshot().shots).toHaveLength(0);
  });

  it("lets a unit that holds fire as many times as the card says", () => {
    const session = battle({ holdShots: 2 });

    expect(session.getSnapshot().orders[0]!.shots).toBe(2);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(true);
    expect(session.shotsLeft(0)).toBe(1);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(true);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false);
  });

  it("undoes a unit's last shot so it can fire again", () => {
    const session = battle();
    shoot(session, 0, AT_INFANTRY);
    shoot(session, 1, AT_INFANTRY);

    expect(session.undoShot(0)).toBe(true);

    expect(session.getSnapshot().shots.map((s) => s.orderIndex)).toEqual([1]);
    expect(session.shotsLeft(0)).toBe(1);
    expect(session.undoShot(0)).toBe(false);
  });

  it("applies fewer results than were rolled, and all of them again", () => {
    const session = battle({ holdShots: 2 });
    shoot(session, 0, { infantry: true, closeAssault: true }); // 3 dice
    shoot(session, 0, AT_INFANTRY); // 2 dice

    expect(session.keepResults(0, 1, [1])).toBe(true);
    expect(session.getSnapshot().shots.map((s) => s.kept)).toEqual([null, [1]]);
    expect(session.getSnapshot().shots[1]!.faces).toHaveLength(2); // the full roll stays
    expect(session.keepResults(0, 0, [2, 0])).toBe(true);
    expect(session.getSnapshot().shots[0]!.kept).toEqual([0, 2]);
    expect(session.keepResults(0, 0, [0, 1, 2])).toBe(true); // all of them
    expect(session.getSnapshot().shots[0]!.kept).toBeNull();
    expect(session.keepResults(0, 1, null)).toBe(true);
    expect(session.getSnapshot().shots[1]!.kept).toBeNull();
  });

  it("won't keep dice that weren't rolled, or a shot that wasn't fired", () => {
    const session = battle();
    shoot(session, 0, AT_INFANTRY);

    expect(session.keepResults(0, 0, [2])).toBe(false);
    expect(session.keepResults(0, 0, [0, 0])).toBe(false);
    expect(session.keepResults(0, 0, [0.5])).toBe(false);
    expect(session.keepResults(0, 1, [0])).toBe(false);
    expect(session.keepResults(1, 0, [0])).toBe(false);
    expect(session.getSnapshot().shots[0]!.kept).toBeNull();
  });

  it("keeps the kept dice after a reload and in the turn log", () => {
    const session = battle();
    shoot(session, 0, { infantry: true, closeAssault: true });
    session.keepResults(0, 0, [0, 2]);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
    ]);
    expect(restored.getSnapshot().shots[0]!.kept).toEqual([0, 2]);
    finishTurn(session);
    expect(session.getSnapshot().log[0]!.shots[0]!.kept).toEqual([0, 2]);
  });

  it("clears the shots when the turn ends", () => {
    const session = battle();
    shoot(session, 0, AT_INFANTRY);

    finishTurn(session);

    expect(session.getSnapshot().shots).toEqual([]);
    expect(session.undoShot(0)).toBe(false);
  });
});

describe("GameSession long-range die", () => {
  // Left card: the infantry at (7,1) and (7,3) hold and fire
  const battle = (longRangeDie: boolean, random = () => 0.99) => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, longRangeDie, random });
    session.pickCard(session.getSnapshot().hand[0]!);
    orderAllAndFight(session);
    return session;
  };

  it("rolls the 8-sided die at range when the game uses it", () => {
    const session = battle(true); // the last side: a supply

    shoot(session, 0, AT_INFANTRY);
    session.fire(1, { distance: "2", lineOfSight: "yes", targetType: "other", targetTerrain: "plains", sandbags: "no", camouflage: "no" });

    const shots = session.getSnapshot().shots;
    expect(shots.map((s) => s.faces)).toEqual([["supply", "supply"], ["supply", "supply"]]);
    expect(shots.map((s) => s.target)).toEqual([
      { infantry: true, closeAssault: false, die: "longRange" },
      { infantry: false, closeAssault: false, die: "longRange" },
    ]);
  });

  it("keeps the normal die in close assault, and when the game doesn't use it", () => {
    const withIt = battle(true);
    shoot(withIt, 0, { infantry: true, closeAssault: true });
    const without = battle(false);
    shoot(without, 0, AT_INFANTRY);

    expect(withIt.getSnapshot().shots[0]!.faces).toEqual(["flag", "flag", "flag"]);
    expect(withIt.getSnapshot().shots[0]!.target.die).toBe("battle");
    expect(without.getSnapshot().shots[0]!.target.die).toBe("battle");
    expect(without.getSnapshot().shots[0]!.faces).toEqual(["flag", "flag"]);
  });

  it("is kept with the saved game", () => {
    const session = battle(true);
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
    ]);

    expect(restored.longRangeDie).toBe(true);
  });
});

describe("GameSession attacker's extra first turn", () => {
  const defenderSession = () =>
    new GameSession({ scenario: { ...scenario, attacker: "Axis" }, faction: "Allies", initialHandSize: 2, commandCards: cards() });

  it("lets the attacker play turn 1 as an extra turn, and only turn 1", () => {
    const { session, card } = sessionWithAllCards();
    expect(session.attacking).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ turn: 1, phase: TurnPhase.PICK_CARDS, extraTurn: true });

    session.pickCard(card("left"));
    orderAllAndFight(session);
    finishTurn(session);

    expect(session.getSnapshot()).toMatchObject({ turn: 2, extraTurn: false });
  });

  it("makes the defender wait, then start at turn 2 with its hand", () => {
    const session = defenderSession();
    const hand = session.getSnapshot().hand;
    expect(session.attacking).toBe(false);
    expect(session.getSnapshot()).toMatchObject({ turn: 1, phase: TurnPhase.AWAIT_ATTACKER, extraTurn: false });
    expect(session.pickCard(hand[0]!)).toBe(false);

    expect(session.startFirstTurn()).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ turn: 2, phase: TurnPhase.PICK_CARDS, hand, extraTurn: false });
    expect(session.startFirstTurn()).toBe(false);
    expect(session.pickCard(hand[0]!)).toBe(true);
  });

  it("only waits for the defender", () => {
    expect(makeSession().startFirstTurn()).toBe(false);
  });

  it("keeps waiting after a reload", () => {
    const saved = JSON.parse(JSON.stringify(defenderSession().save()));

    const restored = GameSession.restore(saved, { ...scenario, attacker: "Axis" }, cards());

    expect(restored.getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
    expect(restored.startFirstTurn()).toBe(true);
  });
});

describe("GameSession collisions", () => {
  const MOVED_TO: Position = { row: 4, col: 4 };

  /** The tank moves 2 hexes west (it can still fire); the card may add close-assault dice */
  const tankMoved = (closeAssaultBonus = 0) => {
    const commandCards = [
      new CommandCard({ id: "tank", name: same("Blindados"), unitTypes: [UnitType.TANK], orders: 1,
        fireBonus: [{ dice: closeAssaultBonus, closeAssault: true }] }),
    ];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, random: () => 0 });
    session.pickCard(session.getSnapshot().hand[0]!);
    expect(session.issueOrder(TANK, MOVED_TO)).toBe(true);
    orderAllAndFight(session);
    return session;
  };

  it("rolls close assault dice minus 1, ignoring terrain, and uses up the unit's shot", () => {
    const session = tankMoved();

    expect(session.fireCollision(0, true)).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ orderIndex: 0, dice: 2, collision: true });
    expect(shot!.steps.map((step) => step.dice)).toEqual([3, -1]);
    expect(shot!.faces).toHaveLength(2);
    expect(shot!.notes[0]?.es).toMatch(/retiradas no se pueden ignorar/);
    expect(session.shotsLeft(0)).toBe(0);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false);
    expect(session.fireCollision(0, true)).toBe(false);
  });

  it("rolls a collision in close assault against the unit met", () => {
    const session = tankMoved();

    expect(session.fireCollision(0, "horse" as unknown as boolean)).toBe(false);
    expect(session.fireCollision(0, false)).toBe(true);

    expect(session.getSnapshot().shots[0]!.target).toEqual({ infantry: false, closeAssault: true, die: "battle" });
  });

  it("adds the card's close-assault bonus", () => {
    const session = tankMoved(1);

    session.fireCollision(0, true);

    expect(session.getSnapshot().shots[0]!.dice).toBe(3);
    expect(session.getSnapshot().shots[0]!.steps.at(-1)).toEqual({ label: { es: "Carta Blindados", en: "Blindados card" }, dice: 1, kind: "card", card: { es: "Blindados", en: "Blindados" } });
  });

  it("only lets a unit that moved, can fire and hasn't fired yet roll a collision", () => {
    // Holding units didn't move, so they can't have collided
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    expect(session.fireCollision(0, true)).toBe(false);

    // Infantry that moved 2 hexes can't fire this turn, so it doesn't roll either
    const { session: moved, card: movedCard } = sessionWithAllCards();
    moved.pickCard(movedCard("left"));
    moved.issueOrder(LEFT_INF, { row: 5, col: 1 });
    orderAllAndFight(moved);
    expect(moved.getSnapshot().orders[0]!.canFire).toBe(false);
    expect(moved.fireCollision(0, true)).toBe(false);

    // A unit that already fired normally
    const fired = tankMoved();
    shoot(fired, 0, AT_INFANTRY);
    expect(fired.fireCollision(0, true)).toBe(false);
  });

  it("keeps the collision flag after a reload and in the turn log", () => {
    const session = tankMoved();
    session.fireCollision(0, true);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, [
      new CommandCard({ id: "tank", name: same("Blindados"), unitTypes: [UnitType.TANK], orders: 1 }),
    ]);
    expect(restored.getSnapshot().shots[0]!.collision).toBe(true);

    finishTurn(session);
    expect(session.getSnapshot().log[0]!.shots[0]!.collision).toBe(true);
  });
});

describe("GameSession firing order", () => {
  const OTHER_INF: Position = { row: 7, col: 3 };

  /** Order 0 holds; order 1 moves one hex and can still fire */
  const oneHeldOneMoved = () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    session.issueOrder(LEFT_INF, LEFT_INF);
    const to = session.getMoveOptions(OTHER_INF)!.moveAndFire.find((p) => !samePosition(p, OTHER_INF))!;
    expect(session.issueOrder(OTHER_INF, to)).toBe(true);
    orderAllAndFight(session);
    return session;
  };

  it("keeps the moved units waiting until the units that didn't move have fired", () => {
    const session = oneHeldOneMoved();

    expect(session.shotsLeft(1)).toBe(1);
    expect(shoot(session, 1, AT_INFANTRY)).toBe(false);
    expect(session.fire(1, { distance: "1", targetType: "infantry", targetTerrain: "plains", sandbags: "no", camouflage: "no" })).toBe(false);

    expect(shoot(session, 0, AT_INFANTRY)).toBe(true);
    expect(shoot(session, 1, AT_INFANTRY)).toBe(true);
  });

  it("lets a moved unit roll a collision straight away: collisions come first", () => {
    const session = oneHeldOneMoved();

    expect(session.fireCollision(1, true)).toBe(true);
  });

  it("skips the unfired units that didn't move, so the moved units can fire", () => {
    const session = oneHeldOneMoved();

    expect(session.skipUnmovedFire()).toBe(true);

    expect(session.getSnapshot().unmovedFireSkipped).toBe(true);
    expect(session.shotsLeft(0)).toBe(0);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false);
    expect(shoot(session, 1, AT_INFANTRY)).toBe(true);
    expect(session.skipUnmovedFire()).toBe(false); // nothing left to skip
  });

  it("only skips in battle while a unit that didn't move still has a shot", () => {
    const session = oneHeldOneMoved();
    shoot(session, 0, AT_INFANTRY);
    expect(session.skipUnmovedFire()).toBe(false);

    const early = sessionWithAllCards().session;
    expect(early.skipUnmovedFire()).toBe(false);
  });

  it("keeps the skip after a reload and forgets it at the next turn", () => {
    const session = oneHeldOneMoved();
    session.skipUnmovedFire();

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, cards());
    expect(restored.getSnapshot().unmovedFireSkipped).toBe(true);
    expect(shoot(restored, 0, AT_INFANTRY)).toBe(false);

    finishTurn(restored);
    expect(restored.getSnapshot().unmovedFireSkipped).toBe(false);
  });
});

describe("GameSession turn log", () => {
  it("records each finished turn as plain JSON: card, orders, shots and map edits", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    orderAllAndFight(session);
    const tankOrder = session.getSnapshot().orders.findIndex((o) => o.unit.getUnitType() === "tank");
    shoot(session, tankOrder, AT_INFANTRY);
    session.endBattle();
    // The tank is destroyed, then an infantry takes its hex and moves on:
    // the log must still tell which unit each move was
    session.removeUnit(TANK);
    session.relocateUnit(LEFT_INF, TANK);
    session.relocateUnit(TANK, { row: 3, col: 3 });

    expect(session.getSnapshot().log).toEqual([]);
    finishTurn(session);

    const [record] = session.getSnapshot().log;
    expect(record).toEqual(JSON.parse(JSON.stringify(record)));
    expect(record!.turn).toBe(1);
    expect(record!.card.id).toBe("all");
    expect(record!.orders).toHaveLength(4);
    expect(record!.orders[tankOrder]).toEqual({ unit: "tank", start: TANK, end: TANK, path: [TANK], canFire: true });
    expect(record!.shots).toEqual([
      { order: tankOrder, unit: "tank", dice: 3, steps: expect.any(Array), faces: expect.any(Array), kept: null, notes: [], collision: false, target: { ...AT_INFANTRY, die: "battle" } },
    ]);
    expect(record!.shots[0]!.faces).toHaveLength(3);
    expect(record!.battleEdits).toEqual([
      { kind: "remove", unit: "tank", position: TANK },
      { kind: "move", unit: "infantry", from: LEFT_INF, to: TANK },
      { kind: "move", unit: "infantry", from: TANK, to: { row: 3, col: 3 } },
    ]);
  });

  it("marks the scenario's elite units in the orders, shots and map edits", () => {
    const commandCards = cards();
    const session = new GameSession({
      scenario: { ...scenario, elite: [LEFT_INF] },
      faction: "Allies",
      initialHandSize: commandCards.length,
      commandCards,
    });
    session.pickCard(session.getSnapshot().hand.find((c) => c.id === "all")!);
    orderAllAndFight(session);
    const eliteOrder = session.getSnapshot().orders.findIndex((o) => samePosition(o.start, LEFT_INF));
    shoot(session, eliteOrder, AT_INFANTRY);
    session.endBattle();
    session.relocateUnit(LEFT_INF, { row: 3, col: 3 });
    session.removeUnit(TANK);
    finishTurn(session);

    const [record] = session.getSnapshot().log;
    expect(record!.orders[eliteOrder]!.elite).toBe(true);
    expect(record!.orders.filter((o) => o.elite)).toHaveLength(1);
    expect(record!.shots[0]!.elite).toBe(true);
    expect(record!.battleEdits).toEqual([
      { kind: "move", unit: "infantry", elite: true, from: LEFT_INF, to: { row: 3, col: 3 } },
      { kind: "remove", unit: "tank", position: TANK },
    ]);
  });

  it("ends the turn after a map fix in Órdenes whose unit was then ordered on", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    const fixed = { row: 3, col: 3 };
    // The tank wasn't where the map had it; once fixed, it's ordered on from there
    expect(session.relocateUnit(TANK, fixed)).toBe(true);
    expect(session.issueOrder(fixed, { row: 3, col: 4 })).toBe(true);
    orderAllAndFight(session);
    session.endBattle();
    // Reloaded in the final phase, the edit still knows its unit
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, cards());

    finishTurn(restored);

    expect(restored.getSnapshot().log[0]!.battleEdits).toEqual([{ kind: "move", unit: "tank", from: TANK, to: fixed }]);
  });

  it("leaves out orders, shots and edits that were undone", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    shoot(session, 0, AT_INFANTRY);
    session.undoShot(0);
    session.endBattle();
    session.removeUnit(LEFT_INF);
    session.undoBattleEdit();
    finishTurn(session);

    const [record] = session.getSnapshot().log;
    expect(record!.shots).toEqual([]);
    expect(record!.battleEdits).toEqual([]);
  });

  it("adds one record per turn, oldest first", () => {
    const session = makeSession(0);
    for (let turn = 1; turn <= 3; turn++) {
      session.pickCard(session.getSnapshot().hand[0]!);
      orderAllAndFight(session);
      finishTurn(session);
    }

    expect(session.getSnapshot().log.map((r) => r.turn)).toEqual([1, 2, 3]);
  });
});

describe("GameSession saving and restoring", () => {
  /** Save to JSON and back, the way a page reload goes through localStorage */
  const reload = (session: GameSession) =>
    GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, cards());

  const ids = (cards: readonly CommandCard[]) => cards.map((c) => c.id);

  it("restores the cards: hand, piles in order, and the card being played", () => {
    const session = makeSession(2);
    const played = session.getSnapshot().hand[0]!;
    session.pickCard(played);

    const restored = reload(session).getSnapshot();
    const original = session.getSnapshot();

    expect(ids(restored.hand)).toEqual(ids(original.hand));
    expect(restored.chosenCard?.id).toBe(played.id);
    expect(restored.drawPileCount).toBe(original.drawPileCount);
    expect(restored.phase).toBe(TurnPhase.ORDER_UNITS);
    expect(restored.ordersLeft).toBe(original.ordersLeft);
  });

  it("carries on giving orders where it left off, including undoing a move", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    session.issueOrder(TANK, { row: 5, col: 6 });

    const restored = reload(session);

    expect(unitAt(restored, TANK)).toBeNull();
    expect(restored.getSnapshot().orders[0]!.unit).toBe(unitAt(restored, { row: 5, col: 6 }));
    expect(orderablePositions(restored)).toContain(positionKey(LEFT_INF));
    expect(orderablePositions(restored)).not.toContain("5-6");
    expect(restored.getSnapshot().orders[0]!.path).toEqual(session.getSnapshot().orders[0]!.path);
    expect(restored.undoLastOrder()).toBe(true);
    expect(unitAt(restored, TANK)?.getUnitType()).toBe("tank");
  });

  it("keeps battle edits undoable, even for a unit that was destroyed", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    session.endBattle();
    session.removeUnit(LEFT_INF);
    session.relocateUnit(TANK, { row: 3, col: 3 });

    const restored = reload(session);

    expect(restored.getSnapshot().phase).toBe(TurnPhase.END_OF_TURN);
    expect(restored.getSnapshot().battleEdits).toBe(2);
    expect(restored.undoBattleEdit()).toBe(true);
    expect(unitAt(restored, TANK)).not.toBeNull();
    expect(restored.undoBattleEdit()).toBe(true);
    const infantry = unitAt(restored, LEFT_INF);
    expect(infantry).not.toBeNull();
    // The restored order still points at the same unit, now back on the board
    expect(restored.getSnapshot().orders.some((o) => o.unit === infantry)).toBe(true);
  });

  it("keeps the shots, so a reload can't be used to roll again", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    shoot(session, 0, AT_INFANTRY);

    const restored = reload(session);

    expect(restored.getSnapshot().shots).toEqual(session.getSnapshot().shots);
    expect(shoot(restored, 0, AT_INFANTRY)).toBe(false);
    expect(restored.undoShot(0)).toBe(true);
  });

  it("keeps the turn log", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    shoot(session, 0, AT_INFANTRY);
    finishTurn(session);

    const restored = reload(session);

    expect(restored.getSnapshot().log).toEqual(session.getSnapshot().log);
    expect(restored.getSnapshot().log).toHaveLength(1);
  });

  it("rejects a save it can't trust", () => {
    const saved = makeSession().save();
    const broken = (changes: Partial<SavedGame>) => () =>
      GameSession.restore({ ...saved, ...changes } as SavedGame, scenario, cards());

    expect(broken({ version: (SAVE_VERSION - 1) as typeof SAVE_VERSION })).toThrow();
    expect(broken({ testMode: undefined as never })).toThrow();
    expect(broken({ artilleryCrew: undefined as never })).toThrow();
    expect(broken({ wire: [{ row: 99, col: 0 }] })).toThrow();
    expect(broken({ sandbags: [{ row: 99, col: 0 }] })).toThrow();
    expect(broken({ drops: [{ row: "a" }] as never })).toThrow();
    expect(broken({ longRangeDie: "yes" as never })).toThrow();
    expect(broken({ scenarioId: "other" })).toThrow();
    expect(broken({ phase: 9 as TurnPhase })).toThrow();
    expect(broken({ phase: "BATTLE" as never })).toThrow();
    expect(broken({ hand: ["no-such-card"] })).toThrow();
    expect(broken({ drawOptions: ["no-such-card"] })).toThrow();
    const shot = { steps: [], dice: 1, faces: [], notes: [], collision: false, combatBonus: false, kept: null, target: { infantry: true, closeAssault: false, die: "battle" as const } };
    expect(broken({ shots: [{ ...shot, orderIndex: 5 }] })).toThrow();
    expect(broken({ shots: [{ ...shot, orderIndex: 0, target: { ...shot.target, die: "d20" as never } }] })).toThrow();
    expect(broken({ chosenSection: "middle" as never })).toThrow();
    expect(broken({ startCoins: "3" as never })).toThrow();
    expect(broken({ coinAdjustments: [1.5] })).toThrow();
    expect(broken({ rewardChoice: "gold" as never })).toThrow();
    expect(broken({ units: [{ ...saved.units[0]!, position: { row: 40, col: 0 } }] })).toThrow();
  });
});

describe("GameSession coins", () => {
  const defender = { ...scenario, attacker: "Axis" as const };
  const coinCards = () => [
    new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2, fireBonus: [{ dice: 1 }] }),
    new CommandCard({
      id: "finest",
      orders: 4,
      coinCost: { [UnitType.INFANTRY]: 1, [UnitType.TANK]: 2, [UnitType.ARTILLERY]: 2 },
    }),
    new CommandCard({ id: "close", closeAssaultOnly: true }),
  ];

  /** The defender at turn 2 (no extra turn), with every card in hand, `coins` added by hand and `cardId` played */
  const turnWithCoins = (coins: number, cardId: string, random = () => 0) => {
    const commandCards = coinCards();
    const session = new GameSession({ scenario: defender, faction: "Allies", initialHandSize: 3, commandCards, random });
    session.startFirstTurn();
    if (coins > 0) expect(session.adjustCoins(coins)).toBe(true);
    expect(session.pickCard(commandCards.find((c) => c.id === cardId)!)).toBe(true);
    return session;
  };

  const RIGHT_INF: Position = { row: 8, col: 11 };
  const LEFT_CENTER_INF: Position = { row: 7, col: 3 };
  const EXTRA = { section: null, onTheMove: false, extra: true };

  it("starts with none", () => {
    expect(makeSession().getSnapshot()).toMatchObject({ coins: 0, coinEntries: [] });
  });

  it("earns 1 coin per supply rolled in battle, and gives it back if the shot is undone", () => {
    const session = turnWithCoins(0, "left", () => 0.7); // every die a supply
    orderAllAndFight(session);

    shoot(session, 0, AT_INFANTRY);

    expect(session.getSnapshot().coins).toBe(3);
    expect(session.getSnapshot().coinEntries).toEqual([{ kind: "supplies", amount: 3, unit: UnitType.INFANTRY }]);
    session.undoShot(0);
    expect(session.getSnapshot().coins).toBe(0);
  });

  it("always counts the supplies: only hits can be left out", () => {
    const session = turnWithCoins(0, "left", () => 0.7);
    orderAllAndFight(session);
    shoot(session, 0, AT_INFANTRY);
    const rolled = session.getSnapshot().shots[0]!.faces.length;

    expect(session.keepResults(0, 0, [1])).toBe(false);

    expect(session.getSnapshot().coins).toBe(rolled);
  });

  it("earns a coin for every supply, in close assault on armour or artillery too", () => {
    const session = turnWithCoins(0, "left", () => 0.7);
    orderAllAndFight(session);

    shoot(session, 0, { infantry: false, closeAssault: true });

    const [shot] = session.getSnapshot().shots;
    expect(shot!.faces.every((face) => face === "supply")).toBe(true);
    expect(session.getSnapshot().coins).toBe(shot!.faces.length);
  });

  it("earns coins for supplies in the attacker's extra turn, but no final-phase reward, and can't spend them there", () => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, random: () => 0.7 });
    expect(session.adjustCoins(4)).toBe(false);
    session.pickCard(commandCards[0]!);
    expect(session.getSnapshot().extraOrderable).toEqual([]);
    orderAllAndFight(session);

    shoot(session, 0, AT_INFANTRY); // every die a supply: a coin each
    const earned = session.getSnapshot().coins;
    expect(earned).toBeGreaterThan(0);
    expect(session.getSnapshot().coinEntries.map((entry) => entry.kind)).toEqual(["supplies"]);
    session.endBattle();

    expect(session.getSnapshot()).toMatchObject({ coins: earned, canAdjustCoins: false, needsRewardChoice: false });
    expect(session.chooseReward("coins")).toBe(false);
    expect(session.adjustCoins(-1)).toBe(false);

    // They carry over into the attacker's next turn, where they can be spent
    finishTurn(session);
    expect(session.getSnapshot()).toMatchObject({ turn: 2, extraTurn: false, coins: earned, canAdjustCoins: true });
  });

  it("buys an extra order for 3 coins (infantry) or 4 (armour, artillery), for any unit, without using the card's orders", () => {
    const session = turnWithCoins(6, "left");
    expect(session.getSnapshot().extraOrderable).toHaveLength(4);
    expect(session.getSnapshot().orderable.map(positionKey)).not.toContain(positionKey(RIGHT_INF));

    expect(session.issueOrder(RIGHT_INF, RIGHT_INF, EXTRA)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ coins: 3, ordersLeft: 2 });
    expect(session.getSnapshot().orders[0]).toMatchObject({ extra: true, cost: 3 });
    expect(session.getSnapshot().coinEntries).toEqual([
      { kind: "extraOrder", amount: -3, unit: UnitType.INFANTRY },
      { kind: "adjustment", amount: 6 },
    ]);
    // 3 coins left: another infantry, but not the tank
    expect(session.getSnapshot().extraOrderable.map(positionKey)).not.toContain(positionKey(TANK));
    expect(session.issueOrder(TANK, TANK, EXTRA)).toBe(false);
  });

  it("gives the coins back when the extra order is undone", () => {
    const session = turnWithCoins(4, "left");
    session.issueOrder(RIGHT_INF, RIGHT_INF, EXTRA);

    session.undoLastOrder();

    expect(session.getSnapshot().coins).toBe(4);
  });

  it("moves an extra order like the unit, and fires it without the card's bonus", () => {
    const session = turnWithCoins(4, "left");
    const options = session.getMoveOptions(RIGHT_INF, EXTRA)!;
    expect(options.slots).toEqual([EXTRA]);
    expect(options.limits).toEqual({ maxMove: 2, moveAndFire: 1, holdShots: 1 });
    session.issueOrder(RIGHT_INF, RIGHT_INF, EXTRA);
    orderAllAndFight(session);
    const answers = { distance: "2", lineOfSight: "yes", targetType: "infantry", targetTerrain: "plains", sandbags: "no", camouflage: "no" };

    session.fire(0, answers); // the extra order
    session.fire(1, answers); // a card order

    expect(session.getSnapshot().shots.map((shot) => shot.dice)).toEqual([2, 3]);
  });

  it("charges Finest Hour's orders in coins, up to what the player has", () => {
    const session = turnWithCoins(3, "finest");
    expect(session.getSnapshot()).toMatchObject({ ordersLeft: 0, cardOrdersLeft: 4 });

    expect(session.issueOrder(TANK, TANK)).toBe(true);
    expect(session.getSnapshot().coins).toBe(1);
    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ coins: 0, cardOrdersLeft: 2, orderable: [] });
    expect(session.issueOrder(RIGHT_INF, RIGHT_INF)).toBe(false);
    expect(session.commitOrders()).toBe(true);
  });

  it("lets the player pay and add coins by hand, never below 0, and undo it", () => {
    const session = turnWithCoins(3, "left");

    expect(session.adjustCoins(-4)).toBe(false);
    expect(session.adjustCoins(-2)).toBe(true);
    expect(session.adjustCoins(0)).toBe(false);
    expect(session.adjustCoins(1.5)).toBe(false);
    expect(session.getSnapshot().coins).toBe(1);

    expect(session.undoCoinAdjustment()).toBe(true);
    expect(session.getSnapshot().coins).toBe(3);
  });

  it("doesn't take back an extra order when undoing a Close Assault mark", () => {
    const session = turnWithCoins(4, "close");
    session.issueOrder(RIGHT_INF, RIGHT_INF, EXTRA);
    session.commitOrders();
    session.startBattle();

    expect(session.undoCloseAssaultMark()).toBe(false);
    expect(session.getSnapshot().orders).toHaveLength(1);
  });

  it("takes 2 coins in the final phase when the player picks them, and carries the coins into the next turn", () => {
    const session = turnWithCoins(0, "left");
    orderAllAndFight(session);
    session.endBattle();
    // Nothing is counted until the player takes a reward
    expect(session.getSnapshot()).toMatchObject({ needsRewardChoice: true, rewardChoice: null, coins: 0 });
    expect(session.endTurn()).toBe(false);
    expect(session.chooseReward("coins")).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ rewardChoice: "coins", coins: 2 });
    // Once taken, it stays
    expect(session.chooseReward("combatCard")).toBe(false);
    expect(session.endTurn()).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot).toMatchObject({ coins: 2, coinEntries: [], rewardChoice: null });
    expect(snapshot.log.at(-1)).toMatchObject({
      coins: [{ kind: "endOfTurn", amount: 2 }],
      coinsAfter: 2,
      reward: "coins",
    });
  });

  it("gives a card's own reward instead of the choice (Preparations)", () => {
    const commandCards = [
      new CommandCard({ id: "prep", sections: [Side.LEFT], orders: 1, endOfTurnReward: { coins: 3, combatCard: true } }),
    ];
    const session = new GameSession({ scenario: defender, faction: "Allies", initialHandSize: 1, commandCards });
    session.startFirstTurn();
    session.pickCard(commandCards[0]!);
    orderAllAndFight(session);
    expect(session.getSnapshot().coins).toBe(0);

    session.endBattle();

    expect(session.getSnapshot()).toMatchObject({ coins: 3, needsRewardChoice: false });
    expect(session.chooseReward("coins")).toBe(false);
  });

  it("keeps the coins, this turn's changes and extra orders after a reload", () => {
    const session = turnWithCoins(6, "left");
    session.issueOrder(RIGHT_INF, RIGHT_INF, EXTRA);
    session.adjustCoins(-1);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defender, coinCards());

    expect(restored.getSnapshot().coins).toBe(2);
    expect(restored.getSnapshot().coinEntries).toEqual(session.getSnapshot().coinEntries);
    expect(restored.getSnapshot().orders[0]).toMatchObject({ extra: true, cost: 3 });
    expect(restored.undoCoinAdjustment()).toBe(true);
    expect(restored.getSnapshot().coins).toBe(3);
  });
});

describe("GameSession combat cards", () => {
  const defender = { ...scenario, attacker: "Axis" as const };
  const combat = (id: string, cost: number): CombatCard => ({
    id,
    name: same(id),
    description: same(""),
    cost,
  });

  /** The defender at turn 2 with `coins`, the "left" card in hand, and the combat deck given */
  const turnTwo = (combatCards: CombatCard[], coins = 0) => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }), ...cards().slice(1)];
    const session = new GameSession({ scenario: defender, faction: "Allies", initialHandSize: 4, commandCards, combatCards });
    session.startFirstTurn();
    if (coins > 0) session.adjustCoins(coins);
    const left = commandCards[0]!;
    return { session, left };
  };

  const toFinalPhase = (session: GameSession) => {
    orderAllAndFight(session);
    session.endBattle();
    session.drawCard();
  };

  it("deals 2 combat cards at the start", () => {
    const deck = ["a", "b", "c"].map((id) => combat(id, 1));
    const { session } = turnTwo(deck);

    expect(session.getSnapshot().combatHand).toHaveLength(2);
    expect(session.getSnapshot().combatDrawPileCount).toBe(1);
  });

  it("plays a combat card with the command card, paying for it", () => {
    const barrage = combat("barrage", 4);
    const { session, left } = turnTwo([barrage, combat("spotter", 1)], 5);

    expect(session.pickCard(left, undefined, barrage)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ combatCardsPlayed: [barrage], coins: 1 });
    expect(session.getSnapshot().combatHand.map((c) => c.id)).toEqual(["spotter"]);
    expect(session.getSnapshot().coinEntries).toContainEqual({ kind: "combatCard", amount: -4, card: same("barrage") });
  });

  it("won't play a combat card the player can't pay for", () => {
    const barrage = combat("barrage", 4);
    const spotter = combat("spotter", 1);
    const { session, left } = turnTwo([barrage, spotter], 3);

    expect(session.pickCard(left, undefined, barrage)).toBe(false);
    expect(session.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
    expect(session.pickCard(left, undefined, spotter)).toBe(true);
  });

  it("plays two different combat cards together, paid together", () => {
    const spotter = combat("spotter", 1);
    const explosives = combat("explosives", 2);
    const { session, left } = turnTwo([spotter, explosives], 2);
    expect(session.canPlayTogether([spotter, explosives])).toBe(false); // 2 coins: not enough for both
    session.adjustCoins(1);

    expect(session.pickCard(left, undefined, [spotter, explosives])).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ combatCardsPlayed: [spotter, explosives], coins: 0, combatHand: [] });
    expect(session.getSnapshot().coinEntries.filter((entry) => entry.kind === "combatCard")).toHaveLength(2);
  });

  it("won't play two copies of one card, nor more than two cards", () => {
    const spotter: CombatCard = { ...combat("spotter-1", 0), templateId: "spotter" };
    const copy: CombatCard = { ...combat("spotter-2", 0), templateId: "spotter" };
    const { session, left } = turnTwo([spotter, copy]);
    expect(session.canPlayTogether([spotter, copy])).toBe(false);
    expect(session.pickCard(left, undefined, [spotter, copy])).toBe(false);

    const three = ["a", "b", "c"].map((id) => combat(id, 0));
    const tested = new GameSession({ scenario: defender, faction: "Allies", initialHandSize: 1, commandCards: cards(), combatCards: three, testMode: true });
    tested.startFirstTurn();
    expect(tested.getSnapshot().combatHand).toHaveLength(3);
    expect(tested.canPlayTogether(three)).toBe(false);
    expect(tested.canPlayTogether(three.slice(0, 2))).toBe(true);
  });

  it("takes the order card back while giving orders, with its coins", () => {
    const barrage = combat("barrage", 4);
    const { session, left } = turnTwo([barrage, combat("spotter", 1)], 4);
    session.pickCard(left, undefined, barrage);

    expect(session.cancelCombatCard(barrage)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ combatCardsPlayed: [], coins: 4 });
    expect(session.getSnapshot().combatHand).toContain(barrage);
  });

  it("says whether a card that needs an ordered unit type has one", () => {
    const spotter: CombatCard = { ...combat("spotter", 0), needsOrdered: [UnitType.ARTILLERY] };
    const { session, left } = turnTwo([spotter]);
    session.pickCard(left);
    orderAllAndFight(session);
    const ordered = session.getSnapshot().orders.map((order) => order.unit.getUnitType());
    expect(ordered).not.toContain(UnitType.ARTILLERY);

    expect(session.hasOrderedUnitFor(spotter)).toBe(false);

    const forOrdered: CombatCard = { ...spotter, needsOrdered: [UnitType.ARTILLERY, ordered[0]!] };
    expect(session.hasOrderedUnitFor(forOrdered)).toBe(true);
  });

  it("plays no combat cards in the attacker's extra turn", () => {
    const barrage = combat("barrage", 0);
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, combatCards: [barrage] });

    expect(session.getSnapshot().canPlayCombatCards).toBe(false);
    expect(session.pickCard(commandCards[0]!, undefined, barrage)).toBe(false);
  });

  it("discards the played cards at the end of the turn", () => {
    const barrage = combat("barrage", 1);
    const { session, left } = turnTwo([barrage, combat("spotter", 1)], 1);
    session.pickCard(left, undefined, barrage);
    toFinalPhase(session);
    session.chooseReward("coins");

    session.endTurn();

    expect(session.save().combatDiscardPile).toEqual(["barrage"]);
    expect(session.getSnapshot().log.at(-1)).toMatchObject({ combatCardsPlayed: [{ id: "barrage", name: same("barrage") }] });
  });

  it("test mode: every combat card in hand, no limit, played cards come back, plenty of coins", () => {
    const deck = ["a", "b", "c", "d", "e"].map((id) => combat(id, 5));
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }), ...cards().slice(1)];
    const session = new GameSession({
      scenario: defender, faction: "Allies", initialHandSize: 4, commandCards, combatCards: deck, testMode: true,
    });
    session.startFirstTurn();
    expect(session.getSnapshot()).toMatchObject({ coins: TEST_MODE_COINS, mustDiscardCombatCard: false });
    expect(session.getSnapshot().combatHand).toHaveLength(5);

    expect(session.pickCard(commandCards[0]!, undefined, deck[0])).toBe(true);
    toFinalPhase(session);
    session.chooseReward("coins");
    expect(session.endTurn()).toBe(true);

    expect(session.getSnapshot().combatHand).toHaveLength(5);
    expect(session.getSnapshot().combatHand).toContain(deck[0]);
    expect(session.getSnapshot().coins).toBe(TEST_MODE_COINS);

    const restored = GameSession.restore(session.save(), defender, commandCards, deck);
    expect(restored.testMode).toBe(true);
    expect(restored.getSnapshot().combatHand).toHaveLength(5);
  });

  it("draws the combat card chosen in the final phase, and then the choice stays", () => {
    const { session, left } = turnTwo(["a", "b", "c"].map((id) => combat(id, 1)));
    session.pickCard(left);
    toFinalPhase(session);

    expect(session.chooseReward("combatCard")).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.combatHand).toHaveLength(3);
    expect(snapshot.drawnCombatCard).toBe(snapshot.combatHand[2]);
    expect(snapshot.combatCardDue).toBe(false);
    expect(session.chooseReward("coins")).toBe(false);
    expect(session.endTurn()).toBe(true);
    expect(session.getSnapshot().log.at(-1)!.combatCardDrawn).toEqual({ id: snapshot.drawnCombatCard!.id, name: snapshot.drawnCombatCard!.name });
  });

  it("makes the player discard one when the hand goes over 3", () => {
    const deck = ["a", "b", "c", "d", "e"].map((id) => combat(id, 1));
    const { session, left } = turnTwo(deck);
    session.pickCard(left);
    toFinalPhase(session);
    session.chooseReward("combatCard");
    session.endTurn();
    session.pickCard(session.getSnapshot().hand[0]!);
    toFinalPhase(session);
    session.chooseReward("combatCard");
    const fourth = session.getSnapshot().drawnCombatCard!;

    expect(session.getSnapshot()).toMatchObject({ mustDiscardCombatCard: true });
    expect(session.endTurn()).toBe(false);
    expect(session.discardCombatCard(fourth)).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ mustDiscardCombatCard: false });
    expect(session.getSnapshot().combatHand).toHaveLength(3);
    expect(session.discardCombatCard(session.getSnapshot().combatHand[0]!)).toBe(false);
    expect(session.endTurn()).toBe(true);
  });

  it("draws the Preparations combat card with its coins", () => {
    const commandCards = [
      new CommandCard({ id: "prep", sections: [Side.LEFT], orders: 1, endOfTurnReward: { coins: 3, combatCard: true } }),
    ];
    const combatCards = ["a", "b", "c"].map((id) => combat(id, 1));
    const session = new GameSession({ scenario: defender, faction: "Allies", initialHandSize: 1, commandCards, combatCards });
    session.startFirstTurn();
    session.pickCard(commandCards[0]!);
    toFinalPhase(session);

    expect(session.getSnapshot()).toMatchObject({ combatCardDue: true, coins: 3 });
    expect(session.endTurn()).toBe(false);
    expect(session.drawCombatCard()).toBe(true);
    expect(session.getSnapshot().combatHand).toHaveLength(3);
    expect(session.drawCombatCard()).toBe(false);
    expect(session.endTurn()).toBe(true);
  });

  it("keeps the combat cards after a reload", () => {
    const deck = [combat("barrage", 1), combat("spotter", 1), combat("x", 1)];
    const { session, left } = turnTwo(deck, 2);
    const orderCard = session.getSnapshot().combatHand[0]!;
    session.pickCard(left, undefined, orderCard);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defender, cards(), deck);

    expect(restored.getSnapshot()).toMatchObject({
      combatCardsPlayed: [orderCard],
      combatHand: session.getSnapshot().combatHand,
      combatDrawPileCount: 1,
      coins: 1,
    });
    expect(() =>
      GameSession.restore({ ...session.save(), combatHand: ["no-such-card"] }, defender, cards(), deck)
    ).toThrow();
  });
});

describe("GameSession map markers", () => {
  const defender = { ...scenario, attacker: "Axis" as const };
  const barrage: CombatCard = {
    id: "barrage",
    name: same("Cortina de Fuego"),
    description: same(""),
    cost: 0,
    marker: { kind: "target", count: 1 },
  };
  const FAR: Position = { row: 1, col: 10 };

  /** The defender at turn 2, playing the "left" card with Barrage, orders given */
  const withBarrage = () => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
    const session = new GameSession({
      scenario: defender,
      faction: "Allies",
      initialHandSize: 1,
      commandCards,
      combatCards: [barrage],
    });
    session.startFirstTurn();
    session.pickCard(commandCards[0]!, undefined, barrage);
    while (session.getSnapshot().ordersLeft > 0) {
      const p = session.getSnapshot().orderable[0]!;
      session.issueOrder(p, p);
    }
    return { session, commandCards };
  };

  it("marks the card's hexes, and won't confirm the orders until they're all marked", () => {
    const { session } = withBarrage();
    expect(session.getSnapshot().markable.length).toBeGreaterThan(0);
    expect(session.commitOrders()).toBe(false);

    expect(session.markHex(LEFT_INF)).toBe(false); // one of your units
    expect(session.markHex(FAR)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ markers: [FAR], markable: [] });
    expect(session.markHex({ row: 1, col: 9 })).toBe(false);
    expect(session.commitOrders()).toBe(true);
    expect(session.undoMarker()).toBe(false); // confirmed
  });

  it("undoes the last mark, and clears them when the card is taken back", () => {
    const { session } = withBarrage();
    session.markHex(FAR);

    expect(session.undoMarker()).toBe(true);
    expect(session.getSnapshot().markers).toEqual([]);
    session.markHex(FAR);
    session.cancelCombatCard(barrage);
    expect(session.getSnapshot().markers).toEqual([]);
    expect(session.commitOrders()).toBe(true);
  });

  it("keeps the marks after a reload and in the turn log", () => {
    const { session, commandCards } = withBarrage();
    session.markHex(FAR);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defender, commandCards, [barrage]);
    expect(restored.getSnapshot().markers).toEqual([FAR]);
    // The whole decks, for the deck view
    expect(restored.combatCards).toEqual([barrage]);
    expect(restored.commandCards).toBe(commandCards);

    restored.commitOrders();
    restored.startBattle();
    finishTurn(restored);
    expect(restored.getSnapshot().log.at(-1)!.markers).toEqual([FAR]);
    expect(restored.getSnapshot().markers).toEqual([]);
  });
});

describe("GameSession combat card effects", () => {
  const defender = { ...scenario, attacker: "Axis" as const };
  const FAR: Position = { row: 1, col: 10 };
  const FOREST: Position = { row: 4, col: 7 };
  const card = (props: Partial<CombatCard> & Pick<CombatCard, "id">): CombatCard => ({
    name: same(props.id),
    description: same(""),
    cost: 0,
    ...props,
  });

  /** The defender at turn 2 with the combat cards given in hand and the command cards given */
  const turnTwo = (combatCards: CombatCard[], commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })]) => {
    const session = new GameSession({
      scenario: defender,
      faction: "Allies",
      initialHandSize: commandCards.length,
      commandCards,
      combatCards,
      random: () => 0.7, // supplies
    });
    session.startFirstTurn();
    return { session, commandCards };
  };

  const answersAt = (distance: string, extra: Record<string, string> = {}) => ({
    distance,
    ...(distance === "1" ? {} : { lineOfSight: "yes" }),
    targetType: "infantry",
    targetTerrain: "plains",
    sandbags: "no", camouflage: "no",
    ...extra,
  });

  describe("dice cards", () => {
    const LEFT_CENTER: Position = { row: 7, col: 3 };
    const explosives = card({
      id: "explosives",
      assign: { unitTypes: [UnitType.INFANTRY], ordered: true },
      effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], closeAssault: true },
    });

    const inBattle = (bonus: CombatCard) => {
      const { session, commandCards } = turnTwo([bonus]);
      session.pickCard(commandCards[0]!, undefined, bonus);
      orderAllAndFight(session);
      return session;
    };

    it("adds a card's dice to every shot of its unit type, with nothing to answer (Spotter)", () => {
      const drill = card({ id: "drill", effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY] } });
      const session = inBattle(drill);
      expect(session.combatBonusesFor(0)).toEqual([{ name: same("drill"), dice: 1 }]);

      expect(session.fire(0, answersAt("2"))).toBe(true);
      expect(session.fire(1, answersAt("2"))).toBe(true);

      expect(session.getSnapshot().shots.map((shot) => [shot.dice, shot.combatBonus])).toEqual([
        [3, true],
        [3, true],
      ]);
      expect(session.getSnapshot().shots[0]!.steps).toContainEqual(expect.objectContaining({ kind: "card", dice: 1, card: same("drill") }));
    });

    it("isn't for other unit types (Spotter is for artillery)", () => {
      const spotter = card({ id: "spotter", effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.ARTILLERY] } });
      expect(inBattle(spotter).combatBonusesFor(0)).toEqual([]);
    });

    it("gives a card to one ordered unit, which alone gets its dice, in close assault only (Explosives)", () => {
      const { session, commandCards } = turnTwo([explosives]);
      session.pickCard(commandCards[0]!, undefined, explosives);
      // No unit has an order yet
      expect(session.getSnapshot().assigning).toEqual({ card: explosives, positions: [] });
      expect(session.assignCard(LEFT_INF)).toBe(false);
      session.issueOrder(LEFT_INF, LEFT_INF);
      session.issueOrder(LEFT_CENTER, LEFT_CENTER);
      expect(session.getSnapshot().assigning!.positions).toHaveLength(2);
      expect(session.commitOrders()).toBe(false); // the card still waits for its unit

      expect(session.assignCard(LEFT_INF)).toBe(true);

      expect(session.getSnapshot().assignments).toEqual([{ card: explosives, unitType: UnitType.INFANTRY, position: LEFT_INF }]);
      expect(session.getSnapshot().assigning).toBeNull();
      expect(session.commitOrders()).toBe(true);
      session.startBattle();
      expect(session.fire(0, answersAt("1"))).toBe(true);
      expect(session.fire(1, answersAt("1"))).toBe(true);
      expect(session.getSnapshot().shots.map((shot) => shot.combatBonus)).toEqual([true, false]);
      expect(session.combatBonusesFor(0)).toEqual([{ name: same("explosives"), dice: 1, closeAssault: true }]);
    });

    it("offers first a card some unit can take, so one no unit can take doesn't hold up the next", () => {
      // Played first, but there's no artillery to give it to
      const gunner = card({
        id: "gunner",
        assign: { unitTypes: [UnitType.ARTILLERY], ordered: true },
        effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.ARTILLERY] },
      });
      const { session, commandCards } = turnTwo([gunner, explosives]);
      expect(session.pickCard(commandCards[0]!, undefined, [gunner, explosives])).toBe(true);
      session.issueOrder(LEFT_INF, LEFT_INF);
      session.issueOrder(LEFT_CENTER, LEFT_CENTER);

      expect(session.getSnapshot().assigning).toMatchObject({ card: explosives });
      expect(session.assignCard(LEFT_INF)).toBe(true);
      expect(session.getSnapshot().assigning).toEqual({ card: gunner, positions: [] });
      expect(session.commitOrders()).toBe(true);
    });

    it("takes a card back from a unit whose order is undone, lets it change units, and keeps it through a save", () => {
      const { session, commandCards } = turnTwo([explosives]);
      session.pickCard(commandCards[0]!, undefined, explosives);
      session.issueOrder(LEFT_INF, LEFT_INF);
      session.assignCard(LEFT_INF);

      session.undoLastOrder();
      expect(session.getSnapshot().assignments).toEqual([]);

      session.issueOrder(LEFT_INF, LEFT_INF);
      session.issueOrder(LEFT_CENTER, LEFT_CENTER);
      session.assignCard(LEFT_INF);
      expect(session.unassignCard(explosives)).toBe(true);
      expect(session.assignCard(LEFT_CENTER)).toBe(true);

      const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defender, commandCards, [explosives]);
      expect(restored.getSnapshot().assignments).toEqual([{ card: explosives, unitType: UnitType.INFANTRY, position: LEFT_CENTER }]);
      restored.commitOrders();
      restored.startBattle();
      expect(restored.combatBonusesFor(1)).toHaveLength(1);
      expect(restored.combatBonusesFor(0)).toEqual([]);
      finishTurn(restored);
      expect(restored.getSnapshot().log.at(-1)!.assignments).toEqual([
        { card: same("explosives"), unit: UnitType.INFANTRY, position: LEFT_CENTER },
      ]);
      expect(restored.getSnapshot().assignments).toEqual([]);
    });

    it("gives Street Equipment's die only on a town hex or next to one", () => {
      const street = card({ id: "street", effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], near: [HexType.TOWN] } });
      const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
      const session = new GameSession({
        scenario: { ...defender, tiles: { town: [LEFT_INF] } },
        faction: "Allies",
        initialHandSize: 1,
        commandCards,
        combatCards: [street],
      });
      session.startFirstTurn();
      session.pickCard(commandCards[0]!, undefined, street);
      orderAllAndFight(session);

      expect(session.combatBonusesFor(0)).toHaveLength(1);
      expect(session.combatBonusesFor(1)).toEqual([]);
    });
  });

  describe("attack cards", () => {
    const barrage = card({
      id: "barrage",
      marker: { kind: "target", count: 1 },
      effect: { kind: "attack", dicePerHex: 4 },
    });

    const barrageBattle = () => {
      const { session, commandCards } = turnTwo([barrage]);
      session.pickCard(commandCards[0]!, undefined, barrage);
      session.markHex(FAR);
      orderAllAndFight(session);
      return session;
    };

    it("keeps your units off the marked hexes, and next to them for Air Bombardment", () => {
      const bombardment = card({
        id: "air-bombardment",
        marker: { kind: "target", count: 2, awayFromOwnUnits: true },
        effect: { kind: "attack", dicePerHex: 2 },
      });
      const { session, commandCards } = turnTwo([barrage, bombardment]);
      session.pickCard(commandCards[0]!, undefined, barrage);
      const target = session.getMoveOptions(LEFT_INF)!.moves[0]!;
      expect(session.markHex(target)).toBe(true);
      expect(session.getMoveOptions(LEFT_INF)!.moves).not.toContainEqual(target);
      expect(session.issueOrder(LEFT_INF, target)).toBe(false);

      session.cancelCombatCard(barrage);
      session.unpickCard();
      session.pickCard(commandCards[0]!, undefined, bombardment);
      const mark = { row: 4, col: 2 };
      const nextToMark = new Hex(mark).getNeighbors();
      expect(session.getMoveOptions(LEFT_INF)!.moves.some((p) => includesPosition(nextToMark, p))).toBe(true);
      expect(session.markHex(mark)).toBe(true);
      expect(session.getMoveOptions(LEFT_INF)!.moves.some((p) => includesPosition(nextToMark, p))).toBe(false);
    });

    it("erases a mark when undoing an order brings a unit back on it", () => {
      const { session, commandCards } = turnTwo([barrage]);
      session.pickCard(commandCards[0]!, undefined, barrage);
      const to = session.getMoveOptions(LEFT_INF)!.moves[0]!;
      session.issueOrder(LEFT_INF, to);
      expect(session.markHex(LEFT_INF)).toBe(true); // empty now
      session.undoLastOrder();
      expect(session.getSnapshot().markers).toEqual([]);
    });

    it("rolls the card's dice on each marked hex before any unit fires on the attack die", () => {
      const session = barrageBattle();
      expect(session.getSnapshot().attacksPending).toBe(true);
      expect(shoot(session, 0, AT_INFANTRY)).toBe(false);

      expect(session.attackHex(0, false)).toBe(true);

      const [attack] = session.getSnapshot().cardAttacks;
      expect(attack).toMatchObject({ marker: 0, dice: 4, target: { infantry: false, closeAssault: false, die: "attack" } });
      expect(readRoll(attack!.faces, attack!.target!).hits).toBe(4);
      expect(session.getSnapshot().attacksPending).toBe(false);
      expect(session.attackHex(0, false)).toBe(false);
      expect(shoot(session, 0, AT_INFANTRY)).toBe(true);
    });

    it("records an empty hex without a roll, and undoes a hex's roll", () => {
      const session = barrageBattle();

      expect(session.attackHex(0, null)).toBe(true);
      expect(session.getSnapshot().cardAttacks[0]).toMatchObject({ target: null, dice: 0, faces: [] });
      expect(session.undoCardAttack(0)).toBe(true);
      expect(session.getSnapshot().attacksPending).toBe(true);
    });

    it("keeps the rolls after a reload and in the turn log", () => {
      const session = barrageBattle();
      session.attackHex(0, true);
      const restored = GameSession.restore(
        JSON.parse(JSON.stringify(session.save())),
        defender,
        [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })],
        [barrage]
      );
      expect(restored.getSnapshot().cardAttacks).toEqual(session.getSnapshot().cardAttacks);
      finishTurn(restored);
      expect(restored.getSnapshot().log.at(-1)!.cardAttacks).toHaveLength(1);
    });
  });

  describe("movement cards", () => {
    const tankCard = [new CommandCard({ id: "tank", unitTypes: [UnitType.TANK], orders: 1 })];

    it("lets a unit move into the card's terrain and still fire (Forest)", () => {
      const forest = card({ id: "forest", effect: { kind: "move", units: 1, fireInto: [HexType.FOREST] } });
      const { session, commandCards } = turnTwo([forest], tankCard);
      session.pickCard(commandCards[0]!, undefined, forest);

      const plain = session.getMoveOptions(TANK)!;
      const boosted = session.getMoveOptions(TANK, undefined, true)!;
      expect(plain.canBoost).toBe(true);
      expect(plain.moveAndFire.map(positionKey)).not.toContain(positionKey(FOREST));
      expect(boosted.moveAndFire.map(positionKey)).toContain(positionKey(FOREST));

      expect(session.issueOrder(TANK, FOREST, undefined, true)).toBe(true);
      expect(session.getSnapshot().orders[0]).toMatchObject({ boosted: true, shots: 1 });
    });

    it("lets terrain not stop the move (Armor Forward)", () => {
      const armorForward = card({
        id: "armor-forward",
        effect: { kind: "move", units: 1, unitTypes: [UnitType.TANK], ignoreTerrain: true },
      });
      // The tank is ringed by forest, which stops any move at the first hex
      const ringed = { ...defender, tiles: { forest: new Hex(TANK).getNeighbors() } };
      const commandCards = [new CommandCard({ id: "tank", unitTypes: [UnitType.TANK], orders: 1 })];
      const session = new GameSession({ scenario: ringed, faction: "Allies", initialHandSize: 1, commandCards, combatCards: [armorForward] });
      session.startFirstTurn();
      session.pickCard(commandCards[0]!, undefined, armorForward);

      expect(session.getMoveOptions(TANK)!.moves).toHaveLength(6);
      expect(session.getMoveOptions(TANK, undefined, true)!.moves.length).toBeGreaterThan(6);
    });

    it("moves up to 3 through any terrain to end on a town, from next to one (Rattenkrieg)", () => {
      const rattenkrieg = card({
        id: "rattenkrieg",
        effect: {
          kind: "move",
          units: 1,
          unitTypes: [UnitType.INFANTRY],
          maxMove: 3,
          ignoreTerrain: true,
          fireInto: [HexType.TOWN],
          endOn: [HexType.TOWN],
          startNear: [HexType.TOWN],
        },
      });
      const towns: Position[] = [{ row: 6, col: 1 }, { row: 4, col: 2 }];
      const scenarioWithTowns = { ...defender, tiles: { town: towns } };
      const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
      const session = new GameSession({ scenario: scenarioWithTowns, faction: "Allies", initialHandSize: 1, commandCards, combatCards: [rattenkrieg] });
      session.startFirstTurn();
      session.pickCard(commandCards[0]!, undefined, rattenkrieg);

      const options = session.getMoveOptions(LEFT_INF, undefined, true)!;
      expect(options.moves.map(positionKey).sort()).toEqual(towns.map(positionKey).sort());
      expect(options.moveAndFire.map(positionKey).sort()).toEqual(towns.map(positionKey).sort());
      expect(session.getMoveOptions({ row: 7, col: 3 })!.canBoost).toBe(false); // not near a town
    });

    it("moves 3 through any terrain, still fires, and fires first (Tras las líneas enemigas)", () => {
      const infiltrators = card({
        id: "infiltrators",
        effect: { kind: "move", units: 1, unitTypes: [UnitType.INFANTRY], maxMove: 3, ignoreTerrain: true, moveAndFire: true, firesFirst: true },
      });
      // The infantry is ringed by forest, which stops any move at the first hex and doesn't let it fire
      const ring = new Hex(LEFT_INF).getNeighbors();
      const ringed = { ...defender, tiles: { forest: ring } };
      const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
      const session = new GameSession({ scenario: ringed, faction: "Allies", initialHandSize: 1, commandCards, combatCards: [infiltrators] });
      session.startFirstTurn();
      session.pickCard(commandCards[0]!, undefined, infiltrators);

      const options = session.getMoveOptions(LEFT_INF, undefined, true)!;
      expect(options.limits).toMatchObject({ maxMove: 3, moveAndFire: 3 });
      // Not into the forest (it couldn't fire there), but 3 hexes away on open ground
      expect(options.moveAndFire.some((p) => includesPosition(ring, p))).toBe(false);
      const far = options.moveAndFire.find((p) => hexDistance(LEFT_INF, p) === 3)!;
      expect(far).toBeDefined();
      expect(session.getMoveOptions({ row: 4, col: 6 }, undefined, true)).toBeNull(); // not infantry

      expect(session.issueOrder(LEFT_INF, far, undefined, true)).toBe(true);
      expect(session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 })).toBe(true);
      session.commitOrders();
      session.startBattle();

      // It doesn't wait for the unit that held
      expect(session.getSnapshot().orders[0]).toMatchObject({ boosted: true, shots: 1 });
      expect(session.fire(0, answersAt("2"))).toBe(true);
    });

    describe("¡Fusiles arriba!", () => {
      const riflesUp = card({ id: "rifles-up", effect: { kind: "firesWithUnmoved", unitTypes: [UnitType.INFANTRY] } });

      /** In the battle, the left infantry moved and the other held; ¡Fusiles arriba! played with the orders */
      const battle = (played = true) => {
        const { session, commandCards } = turnTwo([riflesUp]);
        session.pickCard(commandCards[0]!, undefined, played ? riflesUp : []);
        const to = session.getMoveOptions(LEFT_INF)!.moveAndFire[0]!;
        session.issueOrder(LEFT_INF, to);
        session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 });
        session.commitOrders();
        session.startBattle();
        return session;
      };

      it("lets the moved infantry fire with the units that didn't move", () => {
        expect(battle(false).fire(0, answersAt("2"))).toBe(false); // without it, it waits for the unit that held
        const session = battle();
        const summaries = () => {
          const game = session.getSnapshot();
          return summarizeOrders(game.orders, session.board, game.shots, false, [riflesUp]);
        };
        expect(summaries()[0]).toMatchObject({ hold: false, unmovedGroup: true, waiting: false, firesFirst: false });
        expect(session.fire(0, answersAt("2"))).toBe(true);
        expect(session.fire(1, answersAt("2"))).toBe(true);
      });

      it("loses the moved infantry's shot with the others' when the player moves on", () => {
        const session = battle();
        expect(session.skipUnmovedFire()).toBe(true);
        expect(session.shotsLeft(0)).toBe(0);
      });
    });

    it("isn't for a unit on the move (Rattenkrieg)", () => {
      const rattenkrieg = card({
        id: "rattenkrieg",
        effect: { kind: "move", units: 1, maxMove: 3, fireInto: [HexType.TOWN], endOn: [HexType.TOWN], notOnTheMove: true },
      });
      const towns: Position[] = [{ row: 6, col: 1 }, { row: 4, col: 2 }];
      const scenarioWithTowns = { ...defender, tiles: { town: towns } };
      const commandCards = [new CommandCard({ id: "probe", sections: [Side.LEFT], orders: 1, onTheMove: 1 })];
      const session = new GameSession({ scenario: scenarioWithTowns, faction: "Allies", initialHandSize: 1, commandCards, combatCards: [rattenkrieg] });
      session.startFirstTurn();
      session.pickCard(commandCards[0]!, undefined, rattenkrieg);

      const onTheMove = { section: null, onTheMove: true };
      expect(session.getMoveOptions(LEFT_INF)!.canBoost).toBe(true);
      expect(session.getMoveOptions(LEFT_INF, onTheMove)!.canBoost).toBe(false);
      expect(session.getMoveOptions(LEFT_INF, onTheMove, true)).toBeNull();
      expect(session.issueOrder(LEFT_INF, towns[0]!, onTheMove, true)).toBe(false);
    });

    it("adds hexes to the move (Frozen Ground) and not to units of other types", () => {
      const frozen = card({ id: "frozen", effect: { kind: "move", units: 1, moveBonus: 1, unitTypes: [UnitType.INFANTRY] } });
      const { session, commandCards } = turnTwo([frozen]);
      session.pickCard(commandCards[0]!, undefined, frozen);

      expect(session.getMoveOptions(LEFT_INF, undefined, true)!.limits).toMatchObject({ maxMove: 3, moveAndFire: 2 });
      // Holding doesn't use the card up
      session.issueOrder(LEFT_INF, LEFT_INF, undefined, true);
      expect(session.getSnapshot().orders[0]!.boosted).toBe(false);
      expect(session.getMoveOptions({ row: 7, col: 3 })!.canBoost).toBe(true);
      session.undoLastOrder();
      session.issueOrder(LEFT_INF, session.getMoveOptions(LEFT_INF, undefined, true)!.moves[0]!, undefined, true);
      expect(session.getMoveOptions({ row: 7, col: 3 })!.canBoost).toBe(false); // used up
      expect(session.getMoveOptions({ row: 7, col: 3 }, undefined, true)).toBeNull();
    });
  });

  describe("Tactician", () => {
    const tactician = card({ id: "tactician", effect: { kind: "changeSection" } });

    it("asks for a section for a one-section card, and orders units there instead", () => {
      const { session, commandCards } = turnTwo([tactician]);
      const left = commandCards[0]!;
      expect(session.cardNeedsSection(left, tactician)).toBe(true);
      expect(session.pickCard(left, undefined, tactician)).toBe(false);

      expect(session.pickCard(left, Side.RIGHT, tactician)).toBe(true);

      expect(orderablePositions(session)).toEqual(["8-11"]);
    });

    it("doesn't ask for cards that aren't for one section", () => {
      const { session } = turnTwo([tactician]);
      expect(session.cardNeedsSection(new CommandCard({ id: "all", orders: 3 }), tactician)).toBe(false);
    });

    it("can't be played, or paid for, with a card for several sections", () => {
      const generalAdvance = new CommandCard({ id: "general-advance", orders: 6, perSection: 2 });
      const { session } = turnTwo([tactician], [generalAdvance]);
      const before = session.getSnapshot();
      expect(session.combatCardFits(generalAdvance, tactician)).toBe(false);

      expect(session.pickCard(generalAdvance, undefined, tactician)).toBe(false);
      expect(session.pickCard(generalAdvance, Side.LEFT, tactician)).toBe(false);

      expect(session.getSnapshot()).toBe(before);
      expect(session.pickCard(generalAdvance)).toBe(true);
    });
  });
});

describe("GameSession paradrop", () => {
  // The Allies drop 2 infantry
  const paradropSession = (faction: "Allies" | "Axis" = "Allies", attacker: "Allies" | "Axis" = "Allies") =>
    new GameSession({
      scenario: {
        ...scenario,
        id: "paradrop",
        attacker,
        paradrop: { faction: "Allies", unitType: UnitType.INFANTRY, units: 2 },
      },
      faction,
      initialHandSize: 3,
      commandCards: cards(),
    });

  it("starts the paradrop side placing its paratroopers; the other side starts as usual", () => {
    expect(paradropSession().getSnapshot()).toMatchObject({ phase: TurnPhase.PARADROP, dropsLeft: 2, drops: [] });
    expect(paradropSession("Axis").getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
  });

  it("places a unit on each empty hex tapped, up to the paradrop's size", () => {
    const session = paradropSession();

    expect(session.dropUnit({ row: 2, col: 2 })).toBe(true);
    expect(session.dropUnit(TANK)).toBe(false); // occupied
    expect(session.dropUnit({ row: 4, col: 7 })).toBe(true); // any terrain
    expect(session.dropUnit({ row: 2, col: 5 })).toBe(false); // none left

    expect(unitAt(session, { row: 2, col: 2 })?.getUnitType()).toBe(UnitType.INFANTRY);
    expect(session.getSnapshot()).toMatchObject({ dropsLeft: 0, drops: [{ row: 2, col: 2 }, { row: 4, col: 7 }] });
  });

  it("undoes the last paratrooper placed", () => {
    const session = paradropSession();
    session.dropUnit({ row: 2, col: 2 });

    expect(session.undoDrop()).toBe(true);
    expect(unitAt(session, { row: 2, col: 2 })).toBeNull();
    expect(session.getSnapshot().dropsLeft).toBe(2);
    expect(session.undoDrop()).toBe(false);
  });

  it("goes on to the first turn, even with paratroopers lost, and then can't drop any more", () => {
    const attacker = paradropSession();
    attacker.dropUnit({ row: 2, col: 2 });

    expect(attacker.finishParadrop()).toBe(true);
    expect(attacker.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 1, dropsLeft: 0 });
    expect(attacker.dropUnit({ row: 2, col: 5 })).toBe(false);
    expect(attacker.undoDrop()).toBe(false);

    const defender = paradropSession("Allies", "Axis");
    defender.finishParadrop();
    expect(defender.getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
  });

  it("keeps the paratroopers through a reload, and can still undo them", () => {
    const session = paradropSession();
    session.dropUnit({ row: 2, col: 2 });

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), session.scenario, cards());

    expect(restored.getSnapshot()).toMatchObject({ phase: TurnPhase.PARADROP, dropsLeft: 1 });
    expect(unitAt(restored, { row: 2, col: 2 })?.getUnitType()).toBe(UnitType.INFANTRY);
    expect(restored.undoDrop()).toBe(true);
    expect(unitAt(restored, { row: 2, col: 2 })).toBeNull();
  });
});

describe("GameSession Reinforcements", () => {
  const FAR: Position = { row: 1, col: 10 };
  const reinforcements: CombatCard = {
    id: "reinforcements",
    name: same("Refuerzos"),
    description: same(""),
    cost: 0,
    marker: { kind: "cross", count: 1 },
    effect: { kind: "reinforcements", unitType: UnitType.INFANTRY },
  };
  const defending: Scenario = { ...scenario, attacker: "Axis" };
  const commandCards = () => [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 1 }), ...cards().slice(1)];

  /** The final phase of turn 2 with Reinforcements played and its cross on `cross` */
  const finalPhase = (cross = FAR) => {
    const session = new GameSession({
      scenario: defending,
      faction: "Allies",
      initialHandSize: 1,
      commandCards: commandCards(),
      combatCards: [reinforcements],
    });
    session.startFirstTurn();
    expect(session.pickCard(session.getSnapshot().hand[0]!, undefined, reinforcements)).toBe(true);
    expect(session.markHex(cross)).toBe(true);
    orderAllAndFight(session);
    expect(session.endBattle()).toBe(true);
    return session;
  };

  it("puts an infantry unit on the cross as the final phase starts, with no roll", () => {
    const session = finalPhase();

    expect(session.getSnapshot()).toMatchObject({ reinforcementToPlace: null, battleEdits: 1 });
    expect(session.board.getHex(FAR)!.unit!.getUnitType()).toBe(UnitType.INFANTRY);
  });

  it("asks for another hex when the cross is taken, and the placing can be undone", () => {
    const session = finalPhase();
    expect(session.undoBattleEdit()).toBe(true);
    expect(session.board.getHex(FAR)!.unit).toBeNull();
    expect(session.getSnapshot().reinforcementToPlace).toBe(UnitType.INFANTRY);
    session.chooseReward("coins");
    expect(session.endTurn()).toBe(false); // the unit must be placed first

    // A unit retreated onto the cross on the table
    const taken = session.getSnapshot().orders[0]!.end;
    expect(session.relocateUnit(taken, FAR)).toBe(true);
    expect(session.placeReinforcement(FAR)).toBe(false);

    expect(session.placeReinforcement(taken)).toBe(true);
    expect(session.getSnapshot().reinforcementToPlace).toBeNull();
    expect(session.board.getHex(taken)!.unit!.getUnitType()).toBe(UnitType.INFANTRY);
    expect(session.endTurn()).toBe(true);
  });

  it("keeps the new unit through a save", () => {
    const session = finalPhase();

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defending, commandCards(), [reinforcements]);

    expect(restored.board.getHex(FAR)!.unit!.getUnitType()).toBe(UnitType.INFANTRY);
    expect(restored.undoBattleEdit()).toBe(true);
    expect(restored.board.getHex(FAR)!.unit).toBeNull();
    expect(restored.getSnapshot().reinforcementToPlace).toBe(UnitType.INFANTRY);
    expect(restored.placeReinforcement(FAR)).toBe(true);
  });

  it("records the new unit in the turn log", () => {
    const session = finalPhase();
    finishTurn(session);

    expect(session.getSnapshot().log.at(-1)!.battleEdits).toEqual([{ kind: "add", unit: UnitType.INFANTRY, position: FAR }]);
  });
});

describe("GameSession taking back the card picked", () => {
  const barrage: CombatCard = {
    id: "barrage",
    name: same("Cortina de Fuego"),
    description: same(""),
    cost: 4,
    marker: { kind: "target", count: 1 },
    effect: { kind: "attack", dicePerHex: 4 },
  };
  const FAR: Position = { row: 1, col: 10 };

  /** The defender at turn 2 with 5 coins, the "left" card and Barrage in hand */
  const turnTwo = () => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }), ...cards().slice(1)];
    const session = new GameSession({
      scenario: { ...scenario, attacker: "Axis" },
      faction: "Allies",
      initialHandSize: commandCards.length,
      commandCards,
      combatCards: [barrage],
    });
    session.startFirstTurn();
    session.adjustCoins(5);
    return { session, left: commandCards[0]! };
  };

  it("goes back to picking a card, with the combat card and its coins back", () => {
    const { session, left } = turnTwo();
    expect(session.pickCard(left, undefined, barrage)).toBe(true);
    session.markHex(FAR);
    expect(session.getSnapshot()).toMatchObject({ coins: 1, canUnpickCard: true });

    expect(session.unpickCard()).toBe(true);

    expect(session.getSnapshot()).toMatchObject({
      phase: TurnPhase.PICK_CARDS,
      chosenCard: null,
      combatCardsPlayed: [],
      markers: [],
      coins: 5,
      canUnpickCard: false,
    });
    expect(session.getSnapshot().combatHand).toContain(barrage);
    expect(session.getSnapshot().hand).toContain(left);
    expect(session.pickCard(left)).toBe(true);
  });

  it("can't once an order is given, or outside giving orders", () => {
    const { session, left } = turnTwo();
    expect(session.unpickCard()).toBe(false);
    session.pickCard(left);
    const position = session.getSnapshot().orderable[0]!;
    session.issueOrder(position, position);

    expect(session.getSnapshot().canUnpickCard).toBe(false);
    expect(session.unpickCard()).toBe(false);
    session.undoLastOrder();
    expect(session.unpickCard()).toBe(true);
  });
});

describe("GameSession firing at a hex on the map", () => {
  // The tank at (4,6) holds; forest to its east at (4,7)
  const tankBattle = () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("tank"));
    orderAllAndFight(session);
    return session;
  };
  const target = (session: GameSession, p: Position) =>
    session.fireTargetsFor(0).find((t) => samePosition(t.position, p));

  it("lists the hexes the unit can fire at, with their dice", () => {
    const session = tankBattle();

    expect(target(session, { row: 4, col: 7 })).toMatchObject({ distance: 1, terrain: HexType.FOREST, dice: 1 });
    expect(target(session, { row: 4, col: 3 })).toMatchObject({ distance: 3, terrain: HexType.PLAINS, dice: 3 });
    expect(target(session, { row: 4, col: 2 })).toBeUndefined(); // out of range
    expect(target(session, TANK)).toBeUndefined();
  });

  it("fires at a hex: its distance and terrain answer those questions", () => {
    const session = tankBattle();

    expect(session.fireAt(0, { position: { row: 4, col: 7 }, infantry: true, sandbags: true })).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ dice: 1, targetPosition: { row: 4, col: 7 }, target: { infantry: true, closeAssault: true, die: "battle" } });
    expect(shot!.notes.map((note) => note.es)).toEqual(["Sacos terreros: el objetivo ignora 1 bandera."]);
  });

  it("won't fire at a hex out of range, out of sight, with a unit of its own or with no dice", () => {
    const session = tankBattle();

    expect(session.fireAt(0, { position: { row: 4, col: 2 }, infantry: true, sandbags: false })).toBe(false);
    expect(session.fireAt(0, { position: { row: 4, col: 9 }, infantry: true, sandbags: false })).toBe(false); // behind the forest
    expect(session.fireAt(0, { position: LEFT_INF, infantry: true, sandbags: false })).toBe(false);
    expect(session.getSnapshot().shots).toHaveLength(0);
  });

  it("won't fire at range when the player says an enemy is next to the unit", () => {
    const session = tankBattle();

    expect(session.fireAt(0, { position: { row: 4, col: 3 }, infantry: true, sandbags: false, adjacentEnemy: true })).toBe(false);
    expect(session.fireAt(0, { position: { row: 4, col: 7 }, infantry: true, sandbags: false, adjacentEnemy: true })).toBe(true);
    expect(session.getSnapshot().shots[0]).toMatchObject({ targetPosition: { row: 4, col: 7 } });
  });
});

describe("GameSession taking ground", () => {
  // Dice always show infantry: a hit on the infantry targets below
  const tankBattle = (random = () => 0) => {
    const commandCards = cards();
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 4, commandCards, random });
    session.pickCard(commandCards.find((c) => c.id === "tank")!);
    orderAllAndFight(session);
    return session;
  };
  const FOREST: Position = { row: 4, col: 7 };

  it("lets armour take ground after a close assault and fire once more, adjacent to the hex it took", () => {
    const session = tankBattle();
    expect(session.canTakeGround(0)).toBe(false); // hasn't fired
    session.fireAt(0, { position: FOREST, infantry: true, sandbags: false });

    expect(session.takeGround(0)).toBe(true);

    expect(session.shotsLeft(0)).toBe(1);
    const targets = session.fireTargetsFor(0);
    expect(targets.every((t) => t.distance === 1)).toBe(true);
    expect(targets.some((t) => samePosition(t.position, { row: 4, col: 8 }))).toBe(true); // next to the forest
    expect(session.fireAt(0, { position: { row: 4, col: 3 }, infantry: false, sandbags: false })).toBe(false);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(false); // not in close assault
    expect(session.fireAt(0, { position: { row: 4, col: 8 }, infantry: false, sandbags: false })).toBe(true);
    // Once per turn
    expect(session.canTakeGround(0)).toBe(false);
    expect(session.shotsLeft(0)).toBe(0);
  });

  it("only when the roll could have pushed back or eliminated the target (a flag or a hit)", () => {
    // Supplies: no hit on infantry, no flag
    const session = tankBattle(() => 0.7);
    session.fireAt(0, { position: FOREST, infantry: true, sandbags: false });

    expect(session.canTakeGround(0)).toBe(false);
  });

  it("moves the unit to the hex it took, as a map edit, and back when taken back", () => {
    const session = tankBattle();
    session.fireAt(0, { position: FOREST, infantry: true, sandbags: false });

    session.takeGround(0);
    expect(session.board.getHex(FOREST)!.hasUnit()).toBe(true);
    expect(session.board.getHex(TANK)!.hasUnit()).toBe(false);
    expect(session.getSnapshot().battleEdits).toBe(1);

    session.undoTakeGround(0);
    expect(session.board.getHex(TANK)!.hasUnit()).toBe(true);
    expect(session.board.getHex(FOREST)!.hasUnit()).toBe(false);
    expect(session.getSnapshot().battleEdits).toBe(0);
  });

  it("only after a close assault", () => {
    const session = tankBattle();
    session.fireAt(0, { position: { row: 4, col: 4 }, infantry: true, sandbags: false });

    expect(session.canTakeGround(0)).toBe(false);
    expect(session.takeGround(0)).toBe(false);
  });

  it("takes it back while the extra shot hasn't been fired", () => {
    const session = tankBattle();
    session.fireAt(0, { position: FOREST, infantry: true, sandbags: false });
    session.takeGround(0);

    expect(session.undoTakeGround(0)).toBe(true);

    expect(session.shotsLeft(0)).toBe(0);
    expect(session.canTakeGround(0)).toBe(true);
  });

  it("keeps it after a reload", () => {
    const session = tankBattle();
    session.fireAt(0, { position: FOREST, infantry: true, sandbags: false });
    session.takeGround(0);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, cards());

    expect(restored.shotsLeft(0)).toBe(1);
    expect(restored.getSnapshot().shots[0]).toMatchObject({ tookGround: true, targetPosition: FOREST });
  });

  describe("Fragor del combate", () => {
    const heat: CombatCard = {
      id: "heat-of-battle",
      name: same("Fragor del combate"),
      description: same(""),
      cost: 1,
      effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], closeAssault: true, face: DieFace.FLAG },
    };
    /** The defender at turn 2 with both left infantry ordered to hold (orders 0 and 1: (7,1) and (7,3)), in `phase` */
    const heatSession = (played: boolean) => {
      const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
      const session = new GameSession({
        scenario: { ...scenario, attacker: "Axis" },
        faction: "Allies",
        initialHandSize: 1,
        commandCards,
        combatCards: [heat],
        random: () => 0,
      });
      session.startFirstTurn();
      session.adjustCoins(1);
      session.pickCard(commandCards[0]!, undefined, played ? [heat] : []);
      return session;
    };

    it("adds a die already showing a flag to infantry's close assaults, and none at range", () => {
      const session = heatSession(true);
      orderAllAndFight(session);
      session.fireAt(0, { position: { row: 6, col: 1 }, infantry: true, sandbags: false });
      session.fireAt(1, { position: { row: 5, col: 3 }, infantry: true, sandbags: false });

      const [assault, atRange] = session.getSnapshot().shots;
      // random 0 throws infantry symbols: the flag is the card's, set rather than thrown
      expect(assault).toMatchObject({ dice: 4, faces: [DieFace.INFANTRY, DieFace.INFANTRY, DieFace.INFANTRY, DieFace.FLAG], combatBonus: true });
      expect(assault!.steps).toContainEqual(expect.objectContaining({ kind: "card", dice: 1, face: DieFace.FLAG }));
      expect(atRange!.faces).not.toContain(DieFace.FLAG);
      expect(atRange!.combatBonus).toBe(false);
    });

    it("adds its flag to an infantry collision too", () => {
      const session = heatSession(true);
      while (session.getSnapshot().ordersLeft > 0) {
        const position = session.getSnapshot().orderable[0]!;
        session.issueOrder(position, position);
      }
      session.commitOrders();

      expect(session.rollCollision(LEFT_INF, true, 0)).toBe(true);
      expect(session.getSnapshot().shots[0]!.faces.at(-1)).toBe(DieFace.FLAG);
    });

    it("never lets infantry take ground, with or without the card", () => {
      for (const played of [false, true]) {
        const session = heatSession(played);
        orderAllAndFight(session);
        session.fireAt(0, { position: { row: 6, col: 1 }, infantry: true, sandbags: false });

        expect(readRoll(session.getSnapshot().shots[0]!.faces, session.getSnapshot().shots[0]!.target).hits).toBeGreaterThan(0);
        expect(session.canTakeGround(0)).toBe(false);
        expect(session.takeGround(0)).toBe(false);
      }
    });
  });
});

describe("GameSession barbed wire", () => {
  // Wire under the left infantry (7,1) and next to the tank at (4,5)
  const WIRE: Position = { row: 4, col: 5 };
  const wireSession = () => {
    const commandCards = cards();
    return new GameSession({
      scenario: { ...scenario, wire: [LEFT_INF, WIRE] },
      faction: "Allies",
      initialHandSize: commandCards.length,
      commandCards,
    });
  };
  const pick = (session: GameSession, id: string) =>
    session.pickCard(session.getSnapshot().hand.find((c) => c.id === id)!);
  /** Hold orders on the left, then battle; the index of the left infantry's order */
  const leftBattle = () => {
    const session = wireSession();
    pick(session, "left");
    orderAllAndFight(session);
    const index = session.getSnapshot().orders.findIndex((o) => samePosition(o.start, LEFT_INF));
    return { session, index };
  };
  const hasWire = (session: GameSession, p: Position) => session.board.getHex(p)!.wire;

  it("stops a unit that moves onto it", () => {
    const session = wireSession();

    for (const rules of [{}, { ignoreTerrain: true }]) {
      const results = session.board.calculatePossibleMovesWithPaths(session.board.getHex(TANK)!, 3, false, rules);
      expect(results.map((r) => positionKey(r.position))).toContain(positionKey(WIRE));
      // No path goes on through the wire, even with a card that ignores terrain
      for (const { path } of results) expect(path.slice(1, -1).map(positionKey)).not.toContain(positionKey(WIRE));
    }
  });

  it("takes a die from infantry firing from it, and none from armour", () => {
    const { session, index } = leftBattle();
    const adjacent = session.fireTargetsFor(index).find((t) => samePosition(t.position, { row: 7, col: 2 }));

    expect(adjacent?.dice).toBe(2);
    expect(session.getSnapshot().canRemoveWire[index]).toBe(true);
    expect(session.fireAt(index, { position: { row: 7, col: 2 }, infantry: true, sandbags: false })).toBe(true);
    expect(session.getSnapshot().shots[0]!.steps).toContainEqual({ label: { es: "Desde una alambrada", en: "From barbed wire" }, dice: -1, kind: "wire" });
  });

  it("lets infantry remove it instead of firing, which uses its shot; undoing the shot puts it back", () => {
    const { session, index } = leftBattle();

    expect(session.removeWire(index)).toBe(true);
    expect(hasWire(session, LEFT_INF)).toBe(false);
    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 0, faces: [], removedWire: LEFT_INF });
    expect(session.shotsLeft(index)).toBe(0);
    expect(session.removeWire(index)).toBe(false);

    expect(session.undoShot(index)).toBe(true);
    expect(hasWire(session, LEFT_INF)).toBe(true);
    expect(session.shotsLeft(index)).toBe(1);
  });

  it("is removed by armour that enters it (official rule), and put back when the order is undone", () => {
    const session = wireSession();
    pick(session, "tank");
    expect(session.issueOrder(TANK, WIRE)).toBe(true);
    expect(hasWire(session, WIRE)).toBe(false);
    expect(session.getSnapshot().orders[0]!.clearedWire).toBe(true);

    expect(session.undoLastOrder()).toBe(true);
    expect(hasWire(session, WIRE)).toBe(true);

    // Kept in the save, so undoing after a reload puts it back too
    session.issueOrder(TANK, WIRE);
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), { ...scenario, wire: [LEFT_INF, WIRE] }, cards());
    expect(hasWire(restored, WIRE)).toBe(false);
    expect(restored.undoLastOrder()).toBe(true);
    expect(hasWire(restored, WIRE)).toBe(true);

    // The tank stands on no wire in the battle, so there's nothing to remove or lose a die to
    expect(session.commitOrders()).toBe(true);
    session.startBattle();
    expect(session.getSnapshot().canRemoveWire).toEqual([false]);
    expect(session.removeWire(0)).toBe(false);
  });

  it("is left by infantry that enters it", () => {
    const session = wireSession();
    pick(session, "left");
    const infantry = session.getSnapshot().orderable.find((p) => !samePosition(p, LEFT_INF))!;
    const free = (p: Position) => {
      const hex = session.board.getHex(p);
      return !!hex && hex.canEnter() && !hex.hasUnit();
    };
    const onto = session.board.getHex(infantry)!.getNeighbors().find(free)!;
    session.board.getHex(onto)!.setWire(true);

    expect(session.issueOrder(infantry, onto)).toBe(true);
    expect(hasWire(session, onto)).toBe(true);
    expect(session.getSnapshot().orders[0]!.clearedWire).toBe(false);
  });

  it("is removed by armour that takes ground onto it, and put back when that's taken back", () => {
    const FOREST: Position = { row: 4, col: 7 };
    const commandCards = cards();
    // Dice always show infantry: a hit on the infantry in the forest
    const session = new GameSession({ scenario: { ...scenario, wire: [FOREST] }, faction: "Allies", initialHandSize: 4, commandCards, random: () => 0 });
    session.pickCard(commandCards.find((c) => c.id === "tank")!);
    orderAllAndFight(session);
    session.fireAt(0, { position: FOREST, infantry: true, sandbags: false });

    expect(session.takeGround(0)).toBe(true);
    expect(hasWire(session, FOREST)).toBe(false);
    expect(session.undoTakeGround(0)).toBe(true);
    expect(hasWire(session, FOREST)).toBe(true);
  });

  it("can be taken off the map in the final phase, and put back with Deshacer", () => {
    const { session } = leftBattle();
    expect(session.removeWireAt(WIRE)).toBe(false); // not in the battle
    session.endBattle();

    expect(session.removeWireAt({ row: 0, col: 0 })).toBe(false); // no wire there
    expect(session.removeWireAt(WIRE)).toBe(true);
    expect(hasWire(session, WIRE)).toBe(false);
    expect(session.undoBattleEdit()).toBe(true);
    expect(hasWire(session, WIRE)).toBe(true);

    session.removeWireAt(WIRE);
    finishTurn(session);
    expect(session.getSnapshot().log[0]!.battleEdits).toEqual([{ kind: "wire", position: WIRE }]);
  });

  it("is saved with the game, flipped for the Axis", () => {
    const { session, index } = leftBattle();
    session.removeWire(index);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), { ...scenario, wire: [LEFT_INF, WIRE] }, cards());
    expect(hasWire(restored, LEFT_INF)).toBe(false);
    expect(hasWire(restored, WIRE)).toBe(true);
    expect(restored.getSnapshot().shots[0]!.removedWire).toEqual(LEFT_INF);

    const axis = new GameSession({ scenario: { ...scenario, wire: [WIRE] }, faction: "Axis", initialHandSize: 1, commandCards: cards() });
    expect(hasWire(axis, { row: 4, col: 7 })).toBe(true);
  });
});

describe("GameSession extra draws (Pegasus Bridge)", () => {
  const defender = (faction: "Allies" | "Axis") =>
    new GameSession({
      scenario: {
        ...scenario,
        attacker: "Allies",
        extraDraws: { faction: "Axis", turns: 2 },
        // Axis units in every section, so any card has a unit to order
        units: { ...scenario.units, axis: { infantry: [0, 2, 3, 5, 8, 9, 11].map((col) => ({ row: 1, col })) } },
      },
      faction,
      initialHandSize: 1,
      commandCards: cards(),
    });
  const playTurn = (session: GameSession) => {
    const card = session.getSnapshot().hand[0]!;
    expect(session.pickCard(card, session.cardNeedsSection(card) ? Side.CENTER : undefined)).toBe(true);
    orderAllAndFight(session);
    session.endBattle();
    expect(session.getSnapshot().drawnCard).not.toBeNull();
  };

  it("draws 2 cards after each of the side's first two turns, then 1", () => {
    const session = defender("Axis");
    expect(session.startFirstTurn()).toBe(true);
    const handSizes = [];
    for (let turn = 2; turn <= 4; turn++) {
      expect(session.getSnapshot().turn).toBe(turn);
      expect(session.getSnapshot().drawsExtra).toBe(turn <= 3);
      playTurn(session);
      const { hand, extraDrawn, drawnCard } = session.getSnapshot();
      expect(extraDrawn !== null).toBe(turn <= 3);
      if (extraDrawn) expect(hand).toContain(extraDrawn);
      expect(extraDrawn).not.toBe(drawnCard);
      handSizes.push(hand.length);
      if (session.getSnapshot().needsRewardChoice) session.chooseReward("coins");
      expect(session.endTurn()).toBe(true);
      expect(session.getSnapshot().extraDrawn).toBeNull();
    }
    expect(handSizes).toEqual([2, 3, 3]);
  });

  it("gives the other side nothing extra", () => {
    const session = defender("Allies");
    expect(session.getSnapshot().drawsExtra).toBe(false);
    playTurn(session);
    expect(session.getSnapshot().extraDrawn).toBeNull();
  });

  it("keeps the extra card through a save", () => {
    const session = defender("Axis");
    session.startFirstTurn();
    playTurn(session);
    const extra = session.getSnapshot().extraDrawn!;

    const restored = GameSession.restore(
      JSON.parse(JSON.stringify(session.save())),
      { ...scenario, extraDraws: { faction: "Axis", turns: 2 }, units: { ...scenario.units, axis: { infantry: [0, 2, 3, 5, 8, 9, 11].map((col) => ({ row: 1, col })) } } },
      cards()
    );
    expect(restored.getSnapshot().extraDrawn?.id).toBe(extra.id);
  });
});

describe("Experimental rule: a destroyed artillery leaves its crew as infantry", () => {
  const GUN: Position = { row: 5, col: 1 };
  const withArtillery: Scenario = {
    ...scenario,
    units: { ...scenario.units, allies: { ...scenario.units.allies, artillery: [GUN] } },
  };
  const makeGunSession = (artilleryCrew: boolean) => {
    const commandCards = cards();
    return new GameSession({ scenario: withArtillery, faction: "Allies", initialHandSize: 4, commandCards, artilleryCrew });
  };
  const toFinalPhase = (session: GameSession) => {
    session.pickCard(session.getSnapshot().hand.find((c) => c.id === "right")!);
    orderAllAndFight(session);
    expect(session.endBattle()).toBe(true);
  };
  const typeAt = (session: GameSession, p: Position) => unitAt(session, p)?.getUnitType();

  it("puts an infantry unit where the artillery was removed in the final phase", () => {
    const session = makeGunSession(true);
    toFinalPhase(session);

    expect(session.leavesCrew(GUN)).toBe(true);
    expect(session.leavesCrew(LEFT_INF)).toBe(false);
    expect(session.removeUnit(GUN)).toBe(true);
    expect(typeAt(session, GUN)).toBe(UnitType.INFANTRY);

    // The crew is an ordinary unit: it can be removed too
    expect(session.removeUnit(GUN)).toBe(true);
    expect(unitAt(session, GUN)).toBeNull();
  });

  it("brings the artillery back on undo", () => {
    const session = makeGunSession(true);
    toFinalPhase(session);
    const gun = unitAt(session, GUN);
    session.removeUnit(GUN);

    expect(session.undoBattleEdit()).toBe(true);
    expect(unitAt(session, GUN)).toBe(gun);
  });

  it("only removes the artillery without the rule, or when fixing the map in Órdenes", () => {
    const off = makeGunSession(false);
    toFinalPhase(off);
    expect(off.leavesCrew(GUN)).toBe(false);
    off.removeUnit(GUN);
    expect(unitAt(off, GUN)).toBeNull();

    const on = makeGunSession(true);
    on.pickCard(on.getSnapshot().hand.find((c) => c.id === "right")!);
    expect(on.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);
    expect(on.leavesCrew(GUN)).toBe(false);
    expect(on.removeUnit(GUN)).toBe(true);
    expect(unitAt(on, GUN)).toBeNull();
  });

  it("keeps the rule and the crew after a reload, and logs the swap", () => {
    const session = makeGunSession(true);
    toFinalPhase(session);
    session.removeUnit(GUN);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), withArtillery, cards());
    expect(restored.artilleryCrew).toBe(true);
    expect(typeAt(restored, GUN)).toBe(UnitType.INFANTRY);
    expect(restored.undoBattleEdit()).toBe(true);
    expect(typeAt(restored, GUN)).toBe(UnitType.ARTILLERY);

    restored.removeUnit(GUN);
    restored.drawCard();
    expect(restored.endTurn()).toBe(true);
    expect(restored.getSnapshot().log[0]!.battleEdits).toEqual([
      { kind: "remove", unit: UnitType.ARTILLERY, position: GUN, replacedBy: UnitType.INFANTRY },
    ]);
  });
});

describe("GameSession sandbags", () => {
  const fortify: CombatCard = {
    id: "fortify",
    name: same("Fortificar"),
    description: same(""),
    cost: 1,
    effect: { kind: "fortify", unitTypes: [UnitType.INFANTRY] },
  };
  // Sandbags on the left infantry, and on an empty hex (an enemy unit's, not known here)
  const ENEMY_BAGS: Position = { row: 2, col: 2 };
  const withSandbags: Scenario = { ...scenario, attacker: "Axis", sandbags: [LEFT_INF, ENEMY_BAGS] };
  const bagsAt = (session: GameSession, p: Position) => session.board.getHex(p)!.sandbags;
  /** Turn 2 with the left card (it orders the infantry at (7,1) and (7,3)) and Fortify in hand */
  const leftTurn = (playFortify = false) => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
    const session = new GameSession({ scenario: withSandbags, faction: "Allies", initialHandSize: 1, commandCards, combatCards: [fortify, { ...fortify, id: "other" }] });
    session.startFirstTurn();
    session.adjustCoins(1);
    expect(session.pickCard(commandCards[0]!, undefined, playFortify ? fortify : [])).toBe(true);
    return session;
  };
  const holdAllAndEndBattle = (session: GameSession) => {
    orderAllAndFight(session);
    expect(session.endBattle()).toBe(true);
  };

  it("starts with the scenario's sandbags on this side's units only", () => {
    const allies = new GameSession({ scenario: withSandbags, faction: "Allies", initialHandSize: 1, commandCards: cards() });
    const axis = new GameSession({ scenario: withSandbags, faction: "Axis", initialHandSize: 1, commandCards: cards() });

    expect(allies.board.sandbagPositions()).toEqual([LEFT_INF]);
    // The Axis has no units here: the Allies' sandbags aren't shown to it
    expect(axis.board.sandbagPositions()).toEqual([]);
  });


  it("loses the sandbags when the unit moves off them, and gets them back when the order is undone", () => {
    const session = leftTurn();

    expect(session.issueOrder(LEFT_INF, { row: 6, col: 1 })).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(false);
    expect(bagsAt(session, { row: 6, col: 1 })).toBe(false);

    expect(session.undoLastOrder()).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(true);
  });

  it("keeps the sandbags when the unit holds", () => {
    const session = leftTurn();
    session.issueOrder(LEFT_INF, LEFT_INF);

    expect(bagsAt(session, LEFT_INF)).toBe(true);
  });

  it("takes the sandbags away with a retreat or a casualty mirrored from the table, and back on undo", () => {
    const session = leftTurn();
    holdAllAndEndBattle(session);

    expect(session.relocateUnit(LEFT_INF, { row: 8, col: 1 })).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(false);
    expect(session.undoBattleEdit()).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(true);

    expect(session.removeUnit(LEFT_INF)).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(false);
    expect(session.undoBattleEdit()).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(true);
  });

  it("lets Fortify's ordered infantry put sandbags on its hex instead of firing; undoing the shot takes them off", () => {
    const session = leftTurn(true);
    orderAllAndFight(session);
    const OTHER_INF: Position = { row: 7, col: 3 };
    const other = session.getSnapshot().orders.findIndex((o) => samePosition(o.start, OTHER_INF));
    const left = session.getSnapshot().orders.findIndex((o) => samePosition(o.start, LEFT_INF));

    expect(session.getSnapshot().canFortify[left]).toBe(false); // already has them
    expect(session.getSnapshot().canFortify[other]).toBe(true);
    expect(session.fortify(other)).toBe(true);
    expect(bagsAt(session, OTHER_INF)).toBe(true);
    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 0, faces: [], fortified: OTHER_INF });
    expect(session.shotsLeft(other)).toBe(0);
    expect(session.fortify(other)).toBe(false);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), withSandbags, [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
    ], [fortify, { ...fortify, id: "other" }]);
    expect(restored.getSnapshot().shots[0]!.fortified).toEqual(OTHER_INF);
    expect(restored.board.getHex(OTHER_INF)!.sandbags).toBe(true);

    expect(session.undoShot(other)).toBe(true);
    expect(bagsAt(session, OTHER_INF)).toBe(false);
    expect(session.shotsLeft(other)).toBe(1);
  });

  it("doesn't fortify without the card", () => {
    const session = leftTurn();
    orderAllAndFight(session);

    expect(session.getSnapshot().canFortify.every((can) => !can)).toBe(true);
    expect(session.fortify(1)).toBe(false);
  });

  it("saves the sandbags, and the ones an order took away", () => {
    const session = leftTurn();
    session.issueOrder(LEFT_INF, { row: 6, col: 1 });

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), withSandbags, [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
    ], [fortify, { ...fortify, id: "other" }]);

    expect(restored.board.sandbagPositions()).toEqual([]);
    expect(restored.undoLastOrder()).toBe(true);
    expect(restored.board.sandbagPositions()).toEqual([LEFT_INF]);
  });
});

describe("GameSession elite units", () => {
  // The left infantry at (7,1) is elite; the one at (7,3) isn't
  const eliteScenario: Scenario = { ...scenario, elite: [LEFT_INF] };
  const leftTurn = () => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
    const session = new GameSession({ scenario: eliteScenario, faction: "Allies", initialHandSize: 1, commandCards });
    session.pickCard(commandCards[0]!);
    return { session, commandCards };
  };

  it("moves elite infantry 2 hexes and still fires; other infantry only 1", () => {
    const { session } = leftTurn();

    expect(session.getMoveOptions(LEFT_INF)!.limits).toMatchObject({ maxMove: 2, moveAndFire: 2 });
    expect(session.getMoveOptions({ row: 7, col: 3 })!.limits).toMatchObject({ maxMove: 2, moveAndFire: 1 });
    expect(session.issueOrder(LEFT_INF, { row: 5, col: 1 })).toBe(true);
    expect(session.getSnapshot().orders[0]!.canFire).toBe(true);
  });

  it("keeps elite units elite in a save", () => {
    const { session, commandCards } = leftTurn();

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), eliteScenario, commandCards);

    expect(restored.board.getHex(LEFT_INF)!.unit!.elite).toBe(true);
    expect(restored.board.getHex({ row: 7, col: 3 })!.unit!.elite).toBe(false);
  });
});

describe("pass and play movement", () => {
  /** The left infantry ordered 2 hexes and the left-center one to hold; the tank and the right infantry have no order */
  const movedTwo = () => {
    const { session, card } = sessionWithAllCards();
    expect(session.pickCard(card("left"))).toBe(true);
    const far = session.getMoveOptions(LEFT_INF)!.moves.find((p) => hexDistance(p, LEFT_INF) === 2)!;
    expect(session.issueOrder(LEFT_INF, far)).toBe(true);
    expect(session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 })).toBe(true);
    expect(session.commitOrders()).toBe(true);
    return { session, order: session.getSnapshot().orders[0]! };
  };

  /** The left infantry ordered 1 hex, so it can still fire; the left-center one holds */
  const movedOne = () => {
    const { session, card } = sessionWithAllCards();
    expect(session.pickCard(card("left"))).toBe(true);
    const near = session.getMoveOptions(LEFT_INF)!.moveAndFire.find((p) => hexDistance(p, LEFT_INF) === 1)!;
    expect(session.issueOrder(LEFT_INF, near)).toBe(true);
    expect(session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 })).toBe(true);
    expect(session.commitOrders()).toBe(true);
    return { session, order: session.getSnapshot().orders[0]! };
  };

  it("cuts an order short where its unit stopped, and only on its way", () => {
    const { session, order } = movedTwo();
    const halfway = order.path![1]!;

    expect(session.haltOrders([{ order: 0, at: order.end }])).toBe(false); // the end isn't a stop
    expect(session.haltOrders([{ order: 0, at: { row: 0, col: 0 } }])).toBe(false);
    expect(session.haltOrders([{ order: 0, at: halfway }])).toBe(true);

    const halted = session.getSnapshot().orders[0]!;
    expect(halted.end).toEqual(halfway);
    expect(halted.path).toEqual(order.path!.slice(0, 2));
    expect(unitAt(session, halfway)).toBe(order.unit);
    expect(unitAt(session, order.end)).toBeNull();
  });

  it("is only for the movement phase", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    expect(session.haltOrders([])).toBe(false);
    expect(session.rollCollision(LEFT_INF, true, null)).toBe(false);
  });

  it("rolls an ordered unit's collision as its shot, and an unordered unit's apart", () => {
    const { session, order } = movedOne();
    expect(session.rollCollision(order.end, false, 1)).toBe(false); // not that order's unit
    expect(session.rollCollision(order.end, false, 0)).toBe(true);
    const shot = session.getSnapshot().shots[0]!;
    expect(shot).toMatchObject({ orderIndex: 0, collision: true, target: { infantry: false, closeAssault: true } });
    // Infantry rolls 3 dice in close assault, minus 1 for the collision
    expect(shot.dice).toBe(2);

    expect(session.rollCollision(TANK, true, null)).toBe(true);
    expect(session.rollCollision({ row: 7, col: 3 }, true, null)).toBe(false); // it has an order
    expect(session.getSnapshot().standingCollisions).toHaveLength(1);
    // A tank rolls 3 dice in close assault, minus 1
    expect(session.getSnapshot().standingCollisions[0]).toMatchObject({ from: TANK, dice: 2, unitType: UnitType.TANK });

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, cards());
    expect(restored.getSnapshot().standingCollisions).toEqual(session.getSnapshot().standingCollisions);
  });

  it("doesn't roll a collision for a unit whose order doesn't let it fire", () => {
    const { session, order } = movedTwo();
    expect(order.canFire).toBe(false);
    expect(session.canRollCollision(order.end, 0)).toBe(false);
    expect(session.rollCollision(order.end, true, 0)).toBe(false);
  });
});

describe("pass and play figures", () => {
  const ARTILLERY: Position = { row: 8, col: 6 };
  const withArtillery: Scenario = {
    ...scenario,
    units: { ...scenario.units, allies: { ...scenario.units.allies, artillery: [ARTILLERY] } },
  };
  const figuresSession = () =>
    new GameSession({ scenario: withArtillery, faction: "Allies", initialHandSize: 4, commandCards: cards(), figures: true });

  it("only counts figures in pass and play", () => {
    expect(makeSession().figuresAt(TANK)).toBeNull();
    expect(makeSession().sufferHits(TANK, 1, 0)).toBe(false);
    expect(makeSession().getSnapshot().strength).toEqual([]);
  });

  it("takes hits figure by figure: 2 for an armour figure", () => {
    const session = figuresSession();
    expect(session.figuresAt(LEFT_INF)).toBe(6);
    expect(session.figuresAt(TANK)).toBe(3);

    expect(session.sufferHits(TANK, 1, 0)).toBe(true);
    expect(session.figuresAt(TANK)).toBe(3);
    expect(session.sufferHits(TANK, 1, 0)).toBe(true);
    expect(session.figuresAt(TANK)).toBe(2);
    expect(session.sufferHits(LEFT_INF, 5, 0)).toBe(true);
    expect(session.figuresAt(LEFT_INF)).toBe(1);
  });

  it("removes a unit that loses its last figure", () => {
    const session = figuresSession();
    expect(session.sufferHits(TANK, 6, 2)).toBe(true);
    expect(unitAt(session, TANK)).toBeNull();
    expect(session.getSnapshot().strength.some((s) => samePosition(s.position, TANK))).toBe(false);
  });

  it("leaves a destroyed artillery's crew behind, 1 infantry figure", () => {
    const session = figuresSession();
    expect(session.sufferHits(ARTILLERY, 3, 0)).toBe(true);
    expect(unitAt(session, ARTILLERY)?.getUnitType()).toBe(UnitType.INFANTRY);
    expect(session.figuresAt(ARTILLERY)).toBe(1);
    expect(session.sufferHits(ARTILLERY, 1, 0)).toBe(true);
    expect(unitAt(session, ARTILLERY)).toBeNull();
  });

  it("pins a unit with its first flag; each flag after it is a hex to retreat at once", () => {
    const session = figuresSession();
    expect(session.isPinned(LEFT_INF)).toBe(false);
    session.sufferHits(LEFT_INF, 0, 1);
    expect(session.isPinned(LEFT_INF)).toBe(true);
    expect(session.mustRetreat(LEFT_INF)).toBe(false);
    expect(session.hasRetreated(LEFT_INF)).toBe(false);
    expect(session.canRollCollision(LEFT_INF, null)).toBe(true);
    session.sufferHits(LEFT_INF, 1, 2);
    expect(session.mustRetreat(LEFT_INF)).toBe(true);
    expect(session.getSnapshot().strength.find((s) => samePosition(s.position, LEFT_INF))).toEqual({
      position: LEFT_INF,
      figures: 5,
      pinned: true,
      retreats: 2,
      damaged: false,
      hitThisTurn: 1,
    });
    // Two flags at once on a unit not pinned yet: it's pinned and retreats 1
    session.sufferHits(TANK, 0, 2);
    expect(session.getSnapshot().strength.find((s) => samePosition(s.position, TANK))).toMatchObject({ pinned: true, retreats: 1 });
  });

  it("takes a unit made to retreat out of the battle", () => {
    const session = figuresSession();
    session.sufferHits(LEFT_INF, 0, 2);
    expect(session.hasRetreated(LEFT_INF)).toBe(true);
    expect(session.canRollCollision(LEFT_INF, null)).toBe(false);

    // Ordered to hold, it has no shot left in the battle
    expect(session.pickCard(session.getSnapshot().hand.find((c) => c.id === "all")!)).toBe(true);
    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);
    while (session.getSnapshot().ordersLeft > 0) {
      const p = session.getSnapshot().orderable[0]!;
      expect(session.issueOrder(p, p)).toBe(true);
    }
    expect(session.commitOrders()).toBe(true);
    expect(session.startBattle()).toBe(true);
    expect(session.getSnapshot().orders[0]!.canFire).toBe(true);
    expect(session.shotsLeft(0)).toBe(0);
    expect(session.shotsLeft(1)).toBeGreaterThan(0);
  });

  it("retreats a hex toward its own edge for each flag, to a free hex", () => {
    const session = figuresSession();
    expect(session.retreatOptions(LEFT_INF)).toEqual([]); // not marked
    session.sufferHits(LEFT_INF, 0, 1);
    expect(session.retreatOptions(LEFT_INF)).toEqual([]); // only pinned
    session.sufferHits(LEFT_INF, 0, 2);

    const options = session.retreatOptions(LEFT_INF);
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((p) => p.row === LEFT_INF.row + 1 && hexDistance(p, LEFT_INF) === 1)).toBe(true);
    expect(session.retreatTo(LEFT_INF, { row: 3, col: 3 })).toBe(false);

    const to = options[0]!;
    expect(session.retreatTo(LEFT_INF, to)).toBe(true);
    expect(unitAt(session, to)?.getUnitType()).toBe(UnitType.INFANTRY);
    expect(session.getSnapshot().strength.find((u) => samePosition(u.position, to))).toMatchObject({ retreats: 1 });
  });

  it("loses a figure for each hex it can't retreat", () => {
    const session = figuresSession();
    const edge: Position = { row: 8, col: 11 }; // the right infantry, on its own edge
    session.sufferHits(edge, 0, 3);
    expect(session.retreatOptions(edge)).toEqual([]);
    expect(session.retreatBlocked(edge)).toBe(true);
    expect(session.figuresAt(edge)).toBe(5);
    expect(session.retreatBlocked(edge)).toBe(true);
    expect(session.figuresAt(edge)).toBe(4);
    expect(session.mustRetreat(edge)).toBe(false);
    expect(session.isPinned(edge)).toBe(true);
    expect(session.retreatBlocked(edge)).toBe(false);
  });

  it("counts each hex armour can't retreat as one hit", () => {
    const session = figuresSession();
    session.sufferHits(TANK, 0, 2);
    for (const behind of session.retreatOptions(TANK)) session.board.placeUnitAt(behind, new Unit(UnitType.INFANTRY));
    expect(session.retreatBlocked(TANK)).toBe(true);
    // 1 hit of its figure's 2: still 3 figures, one marked
    expect(session.getSnapshot().strength.find((s) => samePosition(s.position, TANK))).toMatchObject({ figures: 3, damaged: true });
  });

  it("takes an armour figure that already lost a hit down to the next one when it can't retreat", () => {
    const session = figuresSession();
    // A hit on the tank, then both hexes behind it taken
    session.sufferHits(TANK, 1, 2);
    for (const behind of session.retreatOptions(TANK)) session.board.placeUnitAt(behind, new Unit(UnitType.INFANTRY));
    expect(session.retreatBlocked(TANK)).toBe(true);
    expect(session.figuresAt(TANK)).toBe(2);
  });

  it("records the hits each unit took this turn, saved, until the turn ends", () => {
    const session = figuresSession();
    session.sufferHits(TANK, 1, 0);
    session.sufferHits(TANK, 1, 0);
    const tank = (s: GameSession) => s.getSnapshot().strength.find((u) => samePosition(u.position, TANK))!;
    expect(tank(session)).toMatchObject({ figures: 2, hitThisTurn: 2 });
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), withArtillery, cards());
    expect(tank(restored).hitThisTurn).toBe(2);
    // A save from before the record still loads, with none
    const { turnHits: _, ...older } = session.save();
    expect(tank(GameSession.restore(JSON.parse(JSON.stringify(older)), withArtillery, cards())).hitThisTurn).toBe(0);
  });

  it("keeps hits from turn to turn and saves them, the flags only for the turn", () => {
    const session = figuresSession();
    session.sufferHits(TANK, 3, 2);
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), withArtillery, cards());
    expect(restored.figures).toBe(true);
    expect(restored.figuresAt(TANK)).toBe(2);
    expect(restored.isPinned(TANK)).toBe(true);
    expect(restored.mustRetreat(TANK)).toBe(true);
  });
});

describe("Refuel and the cards kept out of the deck", () => {
  const reserveCards = () => [
    new CommandCard({ id: "armor-assault-1", templateId: "armor-assault", unitTypes: [UnitType.TANK], orders: 4, reserve: true }),
    new CommandCard({ id: "hq-reserve-1", templateId: "hq", orders: 4, reserve: true }),
  ];
  /** Refuel and 2 plain cards, all in the hand to start, and the reserve cards kept out of the deck */
  const refuelSession = (units: Scenario["units"] = scenario.units) => {
    const commandCards = [
      new CommandCard({
        id: "refuel-1",
        templateId: "refuel",
        orders: 1,
        endOfTurnReward: { coins: 3, combatCard: true },
        rewardCard: { card: "armor-assault", needs: UnitType.TANK, otherwise: "hq" },
      }),
      new CommandCard({ id: "plain-1", orders: 1 }),
      new CommandCard({ id: "plain-2", orders: 1 }),
      ...reserveCards(),
    ];
    const session = new GameSession({ scenario: { ...scenario, units }, faction: "Allies", initialHandSize: 3, commandCards });
    const play = (id: string) => {
      expect(session.pickCard(session.getSnapshot().hand.find((c) => c.id === id)!)).toBe(true);
      orderAllAndFight(session);
      expect(session.endBattle()).toBe(true);
    };
    const next = () => {
      if (session.getSnapshot().needsRewardChoice) session.chooseReward("coins");
      expect(session.endTurn()).toBe(true);
    };
    const hand = () => session.getSnapshot().hand.map((c) => c.id).sort();
    return { session, commandCards, play, next, hand };
  };

  it("never deals the cards kept out of the deck", () => {
    const { session, hand } = refuelSession();

    expect(hand()).toEqual(["plain-1", "plain-2", "refuel-1"]);
    expect(session.getSnapshot()).toMatchObject({ drawPileCount: 0, discardPileCount: 0 });
  });

  it("gives Armor Assault instead of a draw, which goes back out of the deck once played", () => {
    const { session, play, next, hand } = refuelSession();

    play("refuel-1");
    expect(session.getSnapshot()).toMatchObject({ drawnCard: { id: "armor-assault-1" }, canDrawAgain: false, drawPileCount: 0, discardPileCount: 1 });
    expect(session.drawAgain()).toBe(false);
    next();

    play("armor-assault-1");
    // Drawn from the deck (Refuel reshuffled in); Armor Assault is neither in the hand nor in the piles
    expect(session.getSnapshot().drawnCard!.id).toBe("refuel-1");
    expect(hand()).toEqual(["plain-1", "plain-2", "refuel-1"]);
    expect(session.getSnapshot()).toMatchObject({ drawPileCount: 0, discardPileCount: 0 });
    next();

    play("refuel-1");
    expect(session.getSnapshot().drawnCard!.id).toBe("armor-assault-1");
  });

  it("gives its 3 supplies and combat card too", () => {
    const { session, commandCards } = refuelSession();
    const restored = GameSession.restore(
      { ...session.save(), turn: 2, combatDrawPile: ["a", "b"] },
      session.scenario,
      commandCards,
      ["a", "b"].map((id) => ({ id, name: same(id), description: same(""), cost: 1 as const }))
    );
    restored.pickCard(restored.getSnapshot().hand.find((c) => c.id === "refuel-1")!);
    orderAllAndFight(restored);
    restored.endBattle();

    expect(restored.getSnapshot()).toMatchObject({ coins: 3, combatCardDue: true, needsRewardChoice: false, drawnCard: { id: "armor-assault-1" } });
  });

  it("gives the Direct from HQ kept out of the deck when no armour is left", () => {
    const { session, play } = refuelSession({ allies: { infantry: [LEFT_INF] }, axis: {} });

    play("refuel-1");

    expect(session.getSnapshot().drawnCard!.id).toBe("hq-reserve-1");
  });

  it("draws as usual when Armor Assault is still in the hand", () => {
    const { session, commandCards } = refuelSession();
    // Refuel back in the hand (after a reshuffle) while Armor Assault is still there
    const restored = GameSession.restore(
      { ...session.save(), hand: ["armor-assault-1", "refuel-1", "plain-2"], drawPile: ["plain-1"], discardPile: [] },
      session.scenario,
      commandCards
    );
    restored.pickCard(restored.getSnapshot().hand.find((c) => c.id === "refuel-1")!);
    orderAllAndFight(restored);
    restored.endBattle();

    expect(restored.getSnapshot()).toMatchObject({ drawnCard: { id: "plain-1" }, canDrawAgain: true });
  });

  it("keeps a card from out of the deck in the hand after a reload", () => {
    const { session, commandCards, play, next } = refuelSession();
    play("refuel-1");
    next();

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), session.scenario, commandCards);

    expect(restored.getSnapshot().hand.map((c) => c.id)).toContain("armor-assault-1");
    expect(restored.getSnapshot()).toMatchObject({ drawPileCount: 0, discardPileCount: 1 });
  });
});

describe("GameSession defensive combat cards", () => {
  const defensive = (id: string, effect: CombatCard["effect"], assign?: CombatCard["assign"]): CombatCard => ({
    id,
    name: same(id),
    description: same(""),
    cost: 0,
    effect,
    ...(assign && { assign }),
  });
  const notOneStepBack = defensive("not-a-step-back", { kind: "ignoreFlags", unitTypes: [UnitType.INFANTRY] });
  const personalArmor = defensive("personal-armor", { kind: "ignoreHits", face: DieFace.INFANTRY, hits: 2 }, { unitTypes: [UnitType.INFANTRY], ordered: false });
  const camouflage = defensive("camouflage", { kind: "camouflage" }, { unitTypes: [UnitType.INFANTRY], ordered: true });
  const reposition = defensive("reposition", { kind: "reposition", hexes: 2 }, { unitTypes: [UnitType.ARTILLERY], ordered: true });
  const ARTILLERY: Position = { row: 8, col: 6 };
  const OTHER_INF: Position = { row: 7, col: 3 };
  const defender: Scenario = {
    ...scenario,
    attacker: "Axis",
    units: { ...scenario.units, allies: { ...scenario.units.allies, artillery: [ARTILLERY] } },
  };
  const medic = defensive("medic", { kind: "heal", figures: 2 }, { unitTypes: [UnitType.INFANTRY], ordered: true, weakened: true });
  const mechanic = defensive("mechanic", { kind: "heal", figures: 1 }, { unitTypes: [UnitType.TANK, UnitType.ARTILLERY], ordered: true, weakened: true });
  const allCards = [notOneStepBack, personalArmor, camouflage, reposition, medic, mechanic];
  /** The defender's turn 2 in test mode, the "all" card played with `played` */
  const turnWith = (played: CombatCard[], figures = false) => {
    const commandCards = cards();
    const session = new GameSession({
      scenario: defender,
      faction: "Allies",
      initialHandSize: commandCards.length,
      commandCards,
      combatCards: allCards,
      testMode: true,
      figures,
      random: () => 0,
    });
    session.startFirstTurn();
    expect(session.pickCard(commandCards.find((c) => c.id === "all")!, undefined, played)).toBe(true);
    return session;
  };
  /** Hold orders for every unit not ordered yet, then the battle */
  const holdAndFight = (session: GameSession) => {
    while (session.getSnapshot().ordersLeft > 0 && session.getSnapshot().orderable.length > 0) {
      const position = session.getSnapshot().orderable[0]!;
      expect(session.issueOrder(position, position)).toBe(true);
    }
    expect(session.commitOrders()).toBe(true);
    expect(session.startBattle()).toBe(true);
  };
  /** Hold orders for every unit not ordered yet and confirm them: the movement phase */
  const confirmOrders = (session: GameSession) => {
    while (session.getSnapshot().ordersLeft > 0 && session.getSnapshot().orderable.length > 0) {
      const position = session.getSnapshot().orderable[0]!;
      expect(session.issueOrder(position, position)).toBe(true);
    }
    expect(session.commitOrders()).toBe(true);
  };
  const nextTurn = (session: GameSession) => {
    if (session.getSnapshot().phase === TurnPhase.BATTLE) expect(session.endBattle()).toBe(true);
    if (session.getSnapshot().needsRewardChoice) expect(session.chooseReward("coins")).toBe(true);
    expect(session.endTurn()).toBe(true);
  };

  it("Ni un paso atrás: in pass and play the side's infantry ignores every flag; its armour doesn't", () => {
    const session = turnWith([notOneStepBack], true);

    session.sufferHits(LEFT_INF, 1, 2);
    session.sufferHits(TANK, 0, 1);

    expect(session.figuresAt(LEFT_INF)).toBe(5);
    expect(session.isPinned(LEFT_INF)).toBe(false);
    expect(session.isPinned(TANK)).toBe(true);
  });

  it("Blindaje personal: its unit, ordered or not, ignores its first 2 infantry-symbol hits this turn; grenades still hit", () => {
    const session = turnWith([personalArmor], true);
    expect(session.getSnapshot().assigning?.positions).toContainEqual(LEFT_INF); // no order needed
    expect(session.assignCard(LEFT_INF)).toBe(true);

    session.sufferHits(LEFT_INF, 2, 0, [DieFace.INFANTRY, DieFace.GRENADE]);
    expect(session.figuresAt(LEFT_INF)).toBe(5); // the grenade hit
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defender, cards(), allCards);
    restored.sufferHits(LEFT_INF, 2, 0, [DieFace.INFANTRY, DieFace.INFANTRY]);
    expect(restored.figuresAt(LEFT_INF)).toBe(4); // one more ignored, then it's used up
    // Only its unit
    restored.sufferHits(OTHER_INF, 1, 0, [DieFace.INFANTRY]);
    expect(restored.figuresAt(OTHER_INF)).toBe(5);
  });

  it("Médico: only goes to a weakened ordered infantry unit, which gets up to 2 figures back as the orders are carried out", () => {
    const session = turnWith([medic], true);
    session.sufferHits(LEFT_INF, 3, 0);
    expect(session.issueOrder(OTHER_INF, OTHER_INF)).toBe(true);
    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);
    expect(session.getSnapshot().assigning?.positions).toEqual([LEFT_INF]); // not the unit that wasn't hit
    expect(session.assignCard(LEFT_INF)).toBe(true);
    expect(session.heal()).toBe(false); // not while ordering
    confirmOrders(session);

    expect(session.heal()).toBe(true);
    expect(session.figuresAt(LEFT_INF)).toBe(5);
    expect(session.heal()).toBe(false); // once a turn
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defender, cards(), allCards);
    expect(restored.heal()).toBe(false);
    expect(restored.figuresAt(LEFT_INF)).toBe(5);
  });

  it("Mecánico: mends one figure's hits, and an armour figure hit once whole", () => {
    const lost = turnWith([mechanic], true);
    lost.sufferHits(TANK, 3, 0); // a figure lost and the next one hit once
    expect(lost.issueOrder(TANK, TANK)).toBe(true);
    expect(lost.assignCard(TANK)).toBe(true);
    confirmOrders(lost);
    lost.heal();
    expect(lost.getSnapshot().strength.find((unit) => samePosition(unit.position, TANK))).toMatchObject({ figures: 3, damaged: true });

    const scratched = turnWith([mechanic], true);
    scratched.sufferHits(TANK, 1, 0);
    expect(scratched.issueOrder(TANK, TANK)).toBe(true);
    expect(scratched.assignCard(TANK)).toBe(true);
    confirmOrders(scratched);
    scratched.heal();
    expect(scratched.getSnapshot().strength.find((unit) => samePosition(unit.position, TANK))).toMatchObject({ figures: 3, damaged: false });
  });

  it("Médico on own tablets: any ordered infantry can take it, and the app heals nothing", () => {
    const session = turnWith([medic]);
    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);
    expect(session.assignCard(LEFT_INF)).toBe(true);
    confirmOrders(session);
    expect(session.heal()).toBe(false);
  });

  it("Camuflaje: the unit given it gets the badge after the battle and keeps it until it moves", () => {
    const session = turnWith([camouflage]);
    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);
    expect(session.assignCard(LEFT_INF)).toBe(true);
    holdAndFight(session);
    expect(session.getSnapshot().camouflaged).toEqual([]);

    expect(session.endBattle()).toBe(true);
    expect(session.getSnapshot().camouflaged).toEqual([LEFT_INF]);
    nextTurn(session);
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), defender, cards(), allCards);
    expect(restored.isCamouflaged(LEFT_INF)).toBe(true);

    expect(restored.pickCard(restored.getSnapshot().hand.find((c) => c.id === "all")!)).toBe(true);
    expect(restored.issueOrder(LEFT_INF, { row: 6, col: 1 })).toBe(true);
    expect(restored.getSnapshot().camouflaged).toEqual([]);
    // While its orders are secret, the enemy still sees the badge where it stood
    expect(restored.camouflagedAtStart()).toEqual([LEFT_INF]);
    expect(restored.undoLastOrder()).toBe(true);
    expect(restored.getSnapshot().camouflaged).toEqual([LEFT_INF]);
  });

  it("Camuflaje: in pass and play an enemy with the badge can only be fired at in close assault", () => {
    const session = turnWith([]);
    session.setEnemyView(() => [
      { position: { row: 6, col: 1 }, unitType: UnitType.INFANTRY, sandbags: false, camouflaged: true },
      { position: { row: 5, col: 1 }, unitType: UnitType.INFANTRY, sandbags: false, camouflaged: true },
    ]);
    holdAndFight(session);
    const left = session.getSnapshot().orders.findIndex((o) => samePosition(o.start, LEFT_INF));

    expect(session.aimAt(left, { row: 5, col: 1 })).toBeNull();
    expect(session.aimAt(left, { row: 6, col: 1 })).not.toBeNull();
  });

  it("asks whether the target is camouflaged only when the enemy's deck has Camouflage (the defender's)", () => {
    const attacker = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards: cards() });
    const defenderSide = new GameSession({ scenario: defender, faction: "Allies", initialHandSize: 1, commandCards: cards() });

    expect(attacker.enemyCamouflage).toBe(true);
    expect(defenderSide.enemyCamouflage).toBe(false);
  });

  it("Reposicionamiento: in pass and play's final phase its artillery moves up to 2 hexes, once", () => {
    const session = turnWith([reposition], true);
    expect(session.issueOrder(ARTILLERY, ARTILLERY)).toBe(true);
    expect(session.assignCard(ARTILLERY)).toBe(true);
    holdAndFight(session);
    expect(session.getSnapshot().repositioning).toBeNull();
    expect(session.endBattle()).toBe(true);

    const due = session.getSnapshot().repositioning!;
    expect(due.from).toEqual(ARTILLERY);
    expect(due.options.every((p) => hexDistance(p, ARTILLERY) <= 2)).toBe(true);
    const to = due.options.find((p) => hexDistance(p, ARTILLERY) === 2)!;
    expect(session.reposition({ row: 2, col: 2 })).toBe(false);
    expect(session.reposition(to)).toBe(true);
    expect(unitAt(session, to)?.getUnitType()).toBe(UnitType.ARTILLERY);
    expect(session.getSnapshot().repositioning).toBeNull();

    expect(session.undoBattleEdit()).toBe(true);
    expect(session.getSnapshot().repositioning?.from).toEqual(ARTILLERY);
  });

  it("Reposicionamiento: on their own tablets the player mirrors the move with the map", () => {
    const session = turnWith([reposition]);
    session.issueOrder(ARTILLERY, ARTILLERY);
    session.assignCard(ARTILLERY);
    holdAndFight(session);
    session.endBattle();

    expect(session.getSnapshot().repositioning).toBeNull();
  });
});

describe("GameSession firing combat cards", () => {
  const concentrated: CombatCard = { id: "concentrated-fire", name: same("Fuego concentrado"), description: same(""), cost: 0, effect: { kind: "concentratedFire" } };
  const suppressive: CombatCard = { id: "suppressive-fire", name: same("Fuego de supresión"), description: same(""), cost: 0, effect: { kind: "suppressiveFire" } };
  const OTHER_INF: Position = { row: 7, col: 3 };
  /** The defender's turn 2 in test mode, both left infantry holding (or the first moving), in the battle */
  const battleWith = (played: CombatCard[], { longRangeDie = false, moveLeft = false } = {}) => {
    const commandCards = [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })];
    const session = new GameSession({
      scenario: { ...scenario, attacker: "Axis" },
      faction: "Allies",
      initialHandSize: 1,
      commandCards,
      combatCards: [concentrated, suppressive],
      testMode: true,
      longRangeDie,
      random: () => 0,
    });
    session.startFirstTurn();
    expect(session.pickCard(commandCards[0]!, undefined, played)).toBe(true);
    expect(session.issueOrder(LEFT_INF, moveLeft ? { row: 6, col: 1 } : LEFT_INF)).toBe(true);
    expect(session.issueOrder(OTHER_INF, OTHER_INF)).toBe(true);
    session.commitOrders();
    session.startBattle();
    const left = session.getSnapshot().orders.findIndex((o) => samePosition(o.start, LEFT_INF));
    return { session, left, other: 1 - left };
  };
  /** A hex both units can fire at, `distance` hexes from the first */
  const sharedTarget = (session: GameSession, left: number, other: number, distance: number) =>
    session
      .fireTargetsFor(left)
      .find(
        (t) =>
          t.distance === distance &&
          t.lineOfSight &&
          t.dice > 0 &&
          session.fireTargetsFor(other).some((o) => samePosition(o.position, t.position) && o.lineOfSight && o.dice > 0)
      )!.position;

  it("Fuego de supresión: an ordered shot may roll the suppressive die, at range the 8-sided one when the game uses it", () => {
    const plain = battleWith([]);
    const target = sharedTarget(plain.session, plain.left, plain.other, 2);
    expect(plain.session.fireAt(plain.left, { position: target, infantry: true, sandbags: false, suppressive: true })).toBe(false);

    const { session, left, other } = battleWith([suppressive], { longRangeDie: true });
    expect(session.getSnapshot().suppressiveFire).toBe(true);
    expect(session.fireAt(left, { position: target, infantry: true, sandbags: false, suppressive: true })).toBe(true);
    expect(session.getSnapshot().shots[0]!.target.die).toBe("longRangeSuppressive");
    expect(session.fireAt(other, { position: target, infantry: true, sandbags: false })).toBe(true);
    expect(session.getSnapshot().shots[1]!.target.die).toBe("longRange");
  });

  it("Fuego concentrado: units that didn't move roll together at one enemy; each has used its shot, and the roll is taken back whole", () => {
    expect(battleWith([]).session.joinable(0, { position: { row: 6, col: 2 }, infantry: true, sandbags: false })).toEqual([]);
    const { session, left, other } = battleWith([concentrated]);
    const target = sharedTarget(session, left, other, 2);
    const choice = { position: target, infantry: true, sandbags: false };
    const [option] = session.joinable(left, choice);
    expect(option).toMatchObject({ order: other });

    expect(session.fireAt(left, { ...choice, joined: [other] })).toBe(true);
    const [lead, joined] = session.getSnapshot().shots;
    expect(lead).toMatchObject({ orderIndex: left, joined: [other] });
    expect(lead!.dice).toBe(lead!.steps.filter((s) => s.kind !== "joined").reduce((sum, s) => sum + s.dice, 0) + option!.dice);
    expect(lead!.faces).toHaveLength(lead!.dice);
    expect(lead!.steps.at(-1)).toMatchObject({ kind: "joined", unit: UnitType.INFANTRY, dice: option!.dice });
    expect(joined).toMatchObject({ orderIndex: other, dice: 0, faces: [], joinedTo: left, group: lead!.group });
    expect(session.shotsLeft(other)).toBe(0);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), { ...scenario, attacker: "Axis" }, [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
    ], [concentrated, suppressive]);
    expect(restored.getSnapshot().shots).toHaveLength(2);

    expect(session.undoShot(other)).toBe(true);
    expect(session.getSnapshot().shots).toEqual([]);
    expect(session.shotsLeft(left)).toBe(1);
  });

  it("Fuego concentrado: a unit that moved can't roll with the others", () => {
    const { session, left, other } = battleWith([concentrated], { moveLeft: true });
    const target = session.fireTargetsFor(other).find((t) => t.distance === 2 && t.lineOfSight)!.position;

    expect(session.joinable(other, { position: target, infantry: true, sandbags: false })).toEqual([]);
    expect(session.fireAt(other, { position: target, infantry: true, sandbags: false, joined: [left] })).toBe(false);
  });

  it("Fuego concentrado: each unit throws its own die, the battle die adjacent and the 8-sided one further away", () => {
    const { session, left, other } = battleWith([concentrated], { longRangeDie: true });
    const target = session
      .fireTargetsFor(left)
      .find((t) => t.distance === 1 && session.fireTargetsFor(other).some((o) => samePosition(o.position, t.position) && o.distance === 2 && o.lineOfSight))!.position;

    expect(session.fireAt(left, { position: target, infantry: true, sandbags: false, joined: [other] })).toBe(true);
    const kinds = session.getSnapshot().shots[0]!.kinds!;
    expect(kinds).toContain("battle");
    expect(kinds).toContain("longRange");
    expect(kinds.indexOf("longRange")).toBeGreaterThan(kinds.lastIndexOf("battle"));
  });
});
