import { describe, expect, it, vi } from "vitest";
import GameSession, { SavedGame } from "./gameSession";
import CommandCard, { CommandCardType } from "./commandCard";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";

// Allies (no flip): infantry left (7,1), left-center (7,3), right (8,11);
// tank in the open center at (4,6) with forest to its east at (4,7)
const scenario: Scenario = {
  id: "test",
  name: "Test",
  description: "",
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
  new CommandCard({ id: "left", type: CommandCardType.LEFT, maxTotalOrders: 2 }),
  new CommandCard({ id: "right", type: CommandCardType.RIGHT, maxTotalOrders: 2 }),
  new CommandCard({ id: "all", type: CommandCardType.ALLSIDES, maxTotalOrders: 6 }),
  new CommandCard({ id: "tank", type: CommandCardType.TANK, maxTotalOrders: 4 }),
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

const orderablePositions = (session: GameSession) =>
  session.board
    .getAllHexes()
    .filter((h) => h.unit?.isOrderable())
    .map((h) => `${h.getPosition().row}-${h.getPosition().col}`)
    .sort();

/** Give hold orders until none are left, then commit and go to battle */
const orderAllAndFight = (session: GameSession) => {
  while (session.getSnapshot().ordersLeft > 0) {
    const hex = session.board.getAllHexes().find((h) => h.unit?.isOrderable())!;
    expect(session.issueOrder(hex.getPosition(), hex.getPosition())).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
  expect(session.startMovement()).toBe(true);
  expect(session.startBattle()).toBe(true);
};

/** From battle to the next turn: final phase, draw, end */
const finishTurn = (session: GameSession) => {
  expect(session.endBattle()).toBe(true);
  expect(session.drawCard()).toBe(true);
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
    expect(tank!.isOrderable()).toBe(true);
    expect(tank!.isOrdered()).toBe(false);
    expect(session.getSnapshot().orders).toHaveLength(0);
    expect(session.getSnapshot().ordersLeft).toBe(4);
  });

  it("only commits once every order is given, then locks the board", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    session.issueOrder(LEFT_INF, LEFT_INF);

    expect(session.commitOrders()).toBe(false);
    expect(session.startMovement()).toBe(false);

    session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 });
    expect(session.commitOrders()).toBe(true);

    expect(orderablePositions(session)).toEqual([]);
    expect(session.undoLastOrder()).toBe(false);
    expect(session.getMoveOptions(TANK)).toBeNull();
  });
});

describe("GameSession movement and final phases", () => {
  it("goes orders -> movement -> battle -> final phase, one step at a time", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    session.issueOrder(LEFT_INF, LEFT_INF);
    session.issueOrder({ row: 7, col: 3 }, { row: 7, col: 3 });

    expect(session.startMovement()).toBe(false); // orders not confirmed yet
    session.commitOrders();
    expect(session.startBattle()).toBe(false); // the pieces move on the table first
    expect(session.startMovement()).toBe(true);
    expect(session.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
    expect(session.removeUnit(LEFT_INF)).toBe(false);
    expect(session.endBattle()).toBe(false);

    expect(session.startBattle()).toBe(true);
    expect(session.endBattle()).toBe(true);
    expect(session.getSnapshot().phase).toBe(TurnPhase.END_OF_TURN);
    expect(session.fireQuick(0, 2)).toBe(false); // units that didn't fire have lost the shot
    expect(session.removeUnit(LEFT_INF)).toBe(false);
  });

  it("draws the command card once in the final phase, and only then ends the turn", () => {
    const session = makeSession(1);
    const played = session.getSnapshot().hand[0]!;
    session.pickCard(played);
    orderAllAndFight(session);
    expect(session.drawCard()).toBe(false); // still in battle
    session.endBattle();

    expect(session.endTurn()).toBe(false); // nothing drawn yet
    expect(session.drawCard()).toBe(true);
    const { drawnCard, hand, turn, phase } = session.getSnapshot();
    expect(drawnCard).not.toBeNull();
    expect(hand).toContain(drawnCard);
    expect(hand).not.toContain(played);
    expect({ turn, phase }).toEqual({ turn: 1, phase: TurnPhase.END_OF_TURN });
    expect(session.drawCard()).toBe(false);

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

  it("carries on a version 3 save from the battle phase through the new final phase", () => {
    const session = makeSession(1);
    session.pickCard(session.getSnapshot().hand[0]!);
    orderAllAndFight(session);
    const { drawnCard: _, ...v3 } = { ...session.save(), version: 3 as const };

    const restored = GameSession.restore(v3, scenario, cards());

    expect(restored.getSnapshot().drawnCard).toBeNull();
    finishTurn(restored);
    expect(restored.getSnapshot().turn).toBe(2);
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
    const units = session.board.getAllHexes().flatMap((h) => (h.unit ? [h.unit] : []));
    expect(units.some((u) => u.isOrdered())).toBe(false);
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

describe("GameSession draw-2-keep-1 (debug placeholder)", () => {
  it("keeps the chosen card, discards the other and blocks playing until then", () => {
    const session = makeSession(2); // 2 in hand, 2 in the deck
    const handCard = session.getSnapshot().hand[0]!;

    expect(session.drawChoice()).toBe(true);
    const [kept, other] = session.getSnapshot().choiceCards;
    expect(session.drawChoice()).toBe(false);
    expect(session.pickCard(handCard)).toBe(false);

    expect(session.chooseCard(kept!)).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.hand).toContain(kept);
    expect(snapshot.hand).toHaveLength(3);
    expect(snapshot.choiceCards).toEqual([]);
    expect(snapshot.discardPileCount).toBe(1);
    expect(session.chooseCard(other!)).toBe(false);
    expect(session.pickCard(handCard)).toBe(true);
  });

  it("doesn't lose cards when there aren't 2 to draw", () => {
    const session = makeSession(0); // everything in hand, nothing to draw

    expect(session.drawChoice()).toBe(false);

    const snapshot = session.getSnapshot();
    expect(snapshot.hand.length + snapshot.drawPileCount + snapshot.discardPileCount).toBe(4);
  });
});

describe("GameSession syncing the battle with the table", () => {
  const inBattle = () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    return session;
  };

  it("only allows board edits during the battle phase", () => {
    const { session, card } = sessionWithAllCards();

    expect(session.removeUnit(TANK)).toBe(false);
    session.pickCard(card("left"));
    expect(session.relocateUnit(TANK, { row: 3, col: 3 })).toBe(false);
    expect(unitAt(session, TANK)).not.toBeNull();
  });

  it("removes a destroyed unit and can undo it", () => {
    const session = inBattle();
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
    const session = inBattle();
    const tank = unitAt(session, TANK);
    const farAway = { row: 0, col: 0 };

    expect(session.relocateUnit(TANK, farAway)).toBe(true);
    expect(unitAt(session, farAway)).toBe(tank);

    expect(session.undoBattleEdit()).toBe(true);
    expect(unitAt(session, TANK)).toBe(tank);
    expect(unitAt(session, farAway)).toBeNull();
  });

  it("won't move a unit onto another unit or from an empty hex", () => {
    const session = inBattle();

    expect(session.relocateUnit(TANK, LEFT_INF)).toBe(false);
    expect(session.relocateUnit({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(false);
    expect(session.getSnapshot().battleEdits).toBe(0);
  });

  it("keeps the changes into the next turn and clears the undo history", () => {
    const session = inBattle();
    session.removeUnit(TANK);
    session.relocateUnit(LEFT_INF, { row: 6, col: 1 });

    finishTurn(session);

    expect(session.getSnapshot().battleEdits).toBe(0);
    expect(unitAt(session, TANK)).toBeNull();
    expect(unitAt(session, { row: 6, col: 1 })).not.toBeNull();
    expect(session.undoBattleEdit()).toBe(false);
    // A card that would have ordered the tank now finds nothing to order
    // (the whole deck is in hand, so the tank card is always there)
    const tankCard = session.getSnapshot().hand.find((c) => c.type === CommandCardType.TANK)!;
    session.pickCard(tankCard);
    expect(session.getSnapshot().ordersLeft).toBe(0);
  });
});

describe("GameSession firing", () => {
  // Left card: the infantry at (7,1) and (7,3) hold and fire; orders 0 and 1
  const battle = (options: { numFireTimes?: number } = {}) => {
    const commandCards = [
      new CommandCard({ id: "left", type: CommandCardType.LEFT, maxTotalOrders: 2, ...options }),
    ];
    // Always rolls the first face: infantry
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, random: () => 0 });
    session.pickCard(session.getSnapshot().hand[0]!);
    orderAllAndFight(session);
    return session;
  };

  it("works out the dice from the answers, rolls them once and keeps the result", () => {
    const session = battle();

    expect(session.fire(0, { distance: "2", lineOfSight: "yes", targetTerrain: "plains", sandbags: "no" })).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ orderIndex: 0, dice: 2, faces: ["infantry", "infantry"] });
    expect(shot!.steps.map((s) => s.dice)).toEqual([2]);
    expect(session.shotsLeft(0)).toBe(0);
    expect(session.fire(0, { distance: "1", targetTerrain: "plains", sandbags: "no" })).toBe(false);
    expect(session.fireQuick(0, 3)).toBe(false);
    expect(session.getSnapshot().shots).toHaveLength(1);
  });

  it("won't take a shot the questionnaire ruled out (no line of sight)", () => {
    const session = battle();

    expect(session.fire(0, { distance: "2", lineOfSight: "no" })).toBe(false);
    expect(session.shotsLeft(0)).toBe(1);
  });

  it("keeps the questionnaire's reminders with the shot, also after a reload", () => {
    const session = battle();
    session.fire(0, { distance: "1", targetTerrain: "plains", sandbags: "yes" });

    const [shot] = session.getSnapshot().shots;
    expect(shot!.notes).toEqual(["Sacos terreros: el objetivo ignora 1 bandera."]);
    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, [
      new CommandCard({ id: "left", type: CommandCardType.LEFT, maxTotalOrders: 2 }),
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

    expect(session.fire(0, { distance: "3", lineOfSight: "yes", targetTerrain: "town", sandbags: "no" })).toBe(true);

    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 0, faces: [] });
    expect(session.shotsLeft(0)).toBe(0);
  });

  it("rolls the number of dice the player chose for a quick shot", () => {
    const session = battle();

    expect(session.fireQuick(1, 0)).toBe(false);
    expect(session.fireQuick(1, 1.5)).toBe(false);
    expect(session.fireQuick(1, 4)).toBe(true);

    expect(session.getSnapshot().shots[0]).toMatchObject({ orderIndex: 1, dice: 4, steps: [] });
    expect(session.getSnapshot().shots[0]!.faces).toHaveLength(4);
  });

  it("only fires in battle, with a unit that can fire and is still on the board", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    session.issueOrder(TANK, { row: 4, col: 7 }); // into forest: can't fire
    expect(session.fireQuick(0, 3)).toBe(false); // not in battle yet
    orderAllAndFight(session);

    expect(session.fireQuick(0, 3)).toBe(false);
    expect(session.fireQuick(99, 3)).toBe(false);
    session.removeUnit(LEFT_INF);
    const removedOrder = session.getSnapshot().orders.findIndex((o) => o.start.row === 7 && o.start.col === 1);
    expect(session.fireQuick(removedOrder, 3)).toBe(false);
  });

  it("lets a unit fire as many times as the card says", () => {
    const session = battle({ numFireTimes: 2 });

    expect(session.getSnapshot().firesPerUnit).toBe(2);
    expect(session.fireQuick(0, 2)).toBe(true);
    expect(session.shotsLeft(0)).toBe(1);
    expect(session.fireQuick(0, 2)).toBe(true);
    expect(session.fireQuick(0, 2)).toBe(false);
  });

  it("undoes a unit's last shot so it can fire again", () => {
    const session = battle();
    session.fireQuick(0, 2);
    session.fireQuick(1, 3);

    expect(session.undoShot(0)).toBe(true);

    expect(session.getSnapshot().shots.map((s) => s.orderIndex)).toEqual([1]);
    expect(session.shotsLeft(0)).toBe(1);
    expect(session.undoShot(0)).toBe(false);
  });

  it("clears the shots when the turn ends", () => {
    const session = battle();
    session.fireQuick(0, 2);

    finishTurn(session);

    expect(session.getSnapshot().shots).toEqual([]);
    expect(session.undoShot(0)).toBe(false);
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
  const tankMoved = (closeAssaultAdditionalDice = 0) => {
    const commandCards = [
      new CommandCard({ id: "tank", name: "Blindados", type: CommandCardType.TANK, maxTotalOrders: 1, closeAssaultAdditionalDice }),
    ];
    const session = new GameSession({ scenario, faction: "Allies", initialHandSize: 1, commandCards, random: () => 0 });
    session.pickCard(session.getSnapshot().hand[0]!);
    expect(session.issueOrder(TANK, MOVED_TO)).toBe(true);
    orderAllAndFight(session);
    return session;
  };

  it("rolls close assault dice minus 1, ignoring terrain, and uses up the unit's shot", () => {
    const session = tankMoved();

    expect(session.fireCollision(0)).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ orderIndex: 0, dice: 2, collision: true });
    expect(shot!.steps.map((step) => step.dice)).toEqual([3, -1]);
    expect(shot!.faces).toHaveLength(2);
    expect(shot!.notes[0]).toMatch(/retiradas no se pueden ignorar/);
    expect(session.shotsLeft(0)).toBe(0);
    expect(session.fireQuick(0, 3)).toBe(false);
    expect(session.fireCollision(0)).toBe(false);
  });

  it("adds the card's close-assault bonus", () => {
    const session = tankMoved(1);

    session.fireCollision(0);

    expect(session.getSnapshot().shots[0]!.dice).toBe(3);
    expect(session.getSnapshot().shots[0]!.steps.at(-1)).toEqual({ label: "Carta Blindados", dice: 1 });
  });

  it("only lets a unit that moved, can fire and hasn't fired yet roll a collision", () => {
    // Holding units didn't move, so they can't have collided
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    expect(session.fireCollision(0)).toBe(false);

    // Infantry that moved 2 hexes can't fire this turn, so it doesn't roll either
    const { session: moved, card: movedCard } = sessionWithAllCards();
    moved.pickCard(movedCard("left"));
    moved.issueOrder(LEFT_INF, { row: 5, col: 1 });
    orderAllAndFight(moved);
    expect(moved.getSnapshot().orders[0]!.canFire).toBe(false);
    expect(moved.fireCollision(0)).toBe(false);

    // A unit that already fired normally
    const fired = tankMoved();
    fired.fireQuick(0, 3);
    expect(fired.fireCollision(0)).toBe(false);
  });

  it("keeps the collision flag after a reload and in the turn log", () => {
    const session = tankMoved();
    session.fireCollision(0);

    const restored = GameSession.restore(JSON.parse(JSON.stringify(session.save())), scenario, [
      new CommandCard({ id: "tank", name: "Blindados", type: CommandCardType.TANK, maxTotalOrders: 1 }),
    ]);
    expect(restored.getSnapshot().shots[0]!.collision).toBe(true);

    finishTurn(session);
    expect(session.getSnapshot().log[0]!.shots[0]!.collision).toBe(true);
  });
});

describe("GameSession turn log", () => {
  it("records each finished turn as plain JSON: card, orders, shots and map edits", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("all"));
    orderAllAndFight(session);
    const tankOrder = session.getSnapshot().orders.findIndex((o) => o.unit.getUnitType() === "tank");
    session.fireQuick(tankOrder, 2);
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
      { order: tankOrder, unit: "tank", dice: 2, steps: [], faces: expect.any(Array), notes: [], collision: false },
    ]);
    expect(record!.shots[0]!.faces).toHaveLength(2);
    expect(record!.battleEdits).toEqual([
      { kind: "remove", unit: "tank", position: TANK },
      { kind: "move", unit: "infantry", from: LEFT_INF, to: TANK },
      { kind: "move", unit: "infantry", from: TANK, to: { row: 3, col: 3 } },
    ]);
  });

  it("leaves out orders, shots and edits that were undone", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    session.fireQuick(0, 1);
    session.undoShot(0);
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
    expect(unitAt(restored, { row: 5, col: 6 })?.isOrdered()).toBe(true);
    expect(unitAt(restored, LEFT_INF)?.isOrderable()).toBe(true);
    expect(restored.getSnapshot().orders[0]!.path).toEqual(session.getSnapshot().orders[0]!.path);
    expect(restored.undoLastOrder()).toBe(true);
    expect(unitAt(restored, TANK)?.getUnitType()).toBe("tank");
  });

  it("keeps battle edits undoable, even for a unit that was destroyed", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    session.removeUnit(LEFT_INF);
    session.relocateUnit(TANK, { row: 3, col: 3 });

    const restored = reload(session);

    expect(restored.getSnapshot().phase).toBe(TurnPhase.BATTLE);
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
    session.fireQuick(0, 3);

    const restored = reload(session);

    expect(restored.getSnapshot().shots).toEqual(session.getSnapshot().shots);
    expect(restored.fireQuick(0, 3)).toBe(false);
    expect(restored.undoShot(0)).toBe(true);
  });

  it("reads a version 1 save (before shots) as a turn where nobody has fired", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    const { shots: _, ...v1 } = { ...session.save(), version: 1 as const };

    const restored = GameSession.restore(v1, scenario, cards());

    expect(restored.getSnapshot().shots).toEqual([]);
    expect(restored.shotsLeft(0)).toBe(1);
  });

  it("keeps the turn log", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    session.fireQuick(0, 2);
    finishTurn(session);

    const restored = reload(session);

    expect(restored.getSnapshot().log).toEqual(session.getSnapshot().log);
    expect(restored.getSnapshot().log).toHaveLength(1);
  });

  it("reads a version 2 save (before the turn log) as a game with no history", () => {
    const { session, card } = sessionWithAllCards();
    session.pickCard(card("left"));
    orderAllAndFight(session);
    finishTurn(session);
    const { log: _, ...v2 } = { ...session.save(), version: 2 as const };

    const restored = GameSession.restore(v2, scenario, cards());

    expect(restored.getSnapshot().log).toEqual([]);
    expect(restored.getSnapshot().turn).toBe(2);
  });

  it("restores a pending draw-2 choice", () => {
    const session = makeSession(2);
    session.drawChoice();

    const restored = reload(session);

    expect(ids(restored.getSnapshot().choiceCards)).toEqual(ids(session.getSnapshot().choiceCards));
    expect(restored.chooseCard(restored.getSnapshot().choiceCards[0]!)).toBe(true);
  });

  it("rejects a save it can't trust", () => {
    const saved = makeSession().save();
    const broken = (changes: Partial<SavedGame>) => () =>
      GameSession.restore({ ...saved, ...changes } as SavedGame, scenario, cards());

    expect(broken({ version: 5 as 4 })).toThrow();
    expect(broken({ scenarioId: "other" })).toThrow();
    expect(broken({ phase: 9 as TurnPhase })).toThrow();
    expect(broken({ phase: "BATTLE" as never })).toThrow();
    expect(broken({ hand: ["no-such-card"] })).toThrow();
    expect(broken({ shots: [{ orderIndex: 5, steps: [], dice: 1, faces: ["infantry" as never] }] })).toThrow();
    expect(broken({ units: [{ ...saved.units[0]!, position: { row: 40, col: 0 } }] })).toThrow();
  });
});
