import { TEST_MODE_COINS } from "../data/coinRules";
import Unit, { UnitType } from "./unit";
import { shoot } from "../test/shots";
import { describe, expect, it, vi } from "vitest";
import GameSession from "./gameSession";
import { SAVE_VERSION, SavedGame } from "./saveGame";
import { ActionCard } from "./actionCard";
import { ACTION_CARDS, actionCardById } from "../data/actionCards";
import { readRoll } from "./rollResult";
import Hex from "./hex";
import { HexType } from "../types/hex";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { includesPosition, positionKey, samePosition } from "./position";
import { hexDistance } from "./fireTargets";
import { same } from "../i18n/lang";
import { Faction } from "../types/faction";
import { Supply } from "../data/unitSupplies";
import { amountOf } from "./unitSupplies";

/** Default target for shots whose reading the test doesn't check */
const AT_INFANTRY = { infantry: true, closeAssault: false };

// Allies (no flip): infantry left (7,1), left-center (7,3), right (8,11);
// tank in the open center at (4,6) with forest to its east at (4,7)
const scenario: Scenario = {
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
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

/** The same map with the Axis attacking: the Allies defend */
const defending: Scenario = { ...scenario, attacker: "Axis" };

const TANK: Position = { row: 4, col: 6 };
const LEFT_INF: Position = { row: 7, col: 1 };
const OTHER_INF: Position = { row: 7, col: 3 };

type SessionOptions = ConstructorParameters<typeof GameSession>[0];

/** The Allies' session (the attacker unless the scenario says otherwise) */
const makeSession = (options: Partial<SessionOptions> = {}) => new GameSession({ scenario, faction: "Allies", ...options });

/** The defender (Allies) at the start of turn 1, picking a card */
const defenderTurn = (options: Partial<SessionOptions> = {}) => new GameSession({ scenario: defending, faction: "Allies", ...options });

/** An action card by id */
const card = (id: string): ActionCard => actionCardById(id)!;

const unitAt = (session: GameSession, p: Position) => session.board.getHex(p)!.unit;

const orderablePositions = (session: GameSession) => session.getSnapshot().orderable.map(positionKey).sort();

/** Hold orders for these units, in this order (so their order indexes are 0, 1…) */
const hold = (session: GameSession, ...positions: Position[]) => {
  for (const position of positions) expect(session.issueOrder(position, position)).toBe(true);
};

/** Confirm the orders given (units without one rest) and go to battle */
const fight = (session: GameSession) => {
  expect(session.commitOrders()).toBe(true);
  expect(session.startBattle()).toBe(true);
};

/** Hold orders for every unit not ordered yet, then commit and go to battle */
const orderAllAndFight = (session: GameSession) => {
  while (session.getSnapshot().orderable.length > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  fight(session);
};

/** From battle (or the final phase) to the next turn */
const finishTurn = (session: GameSession) => {
  if (session.getSnapshot().phase === TurnPhase.BATTLE) expect(session.endBattle()).toBe(true);
  expect(session.endTurn()).toBe(true);
};

/** Save to JSON and back, the way a page reload goes through localStorage */
const reload = (session: GameSession, map: Scenario = session.scenario, random?: () => number) =>
  GameSession.restore(JSON.parse(JSON.stringify(session.save())), map, random);

describe("GameSession setup", () => {
  it("starts on turn 1 picking a card, with no card played and no coins", () => {
    const snapshot = makeSession().getSnapshot();

    expect(snapshot.turn).toBe(1);
    expect(snapshot.phase).toBe(TurnPhase.PICK_CARDS);
    expect(snapshot.playedCard).toBeNull();
    expect(snapshot.coins).toBe(0);
    expect(snapshot.orderable).toEqual([]);
  });

  it("returns the same snapshot until something changes (required by useSyncExternalStore)", () => {
    const session = makeSession();
    const before = session.getSnapshot();

    expect(session.getSnapshot()).toBe(before);

    session.pickCard(null);
    expect(session.getSnapshot()).not.toBe(before);
  });

  it("notifies subscribers on changes but not on rejected actions", () => {
    const session = makeSession();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    session.startBattle(); // not allowed while picking cards
    expect(listener).not.toHaveBeenCalled();

    session.pickCard(null);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    session.issueOrder(LEFT_INF, LEFT_INF);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("GameSession picking a card", () => {
  it("moves to ordering, where every unit can be ordered", () => {
    const session = makeSession();

    expect(session.pickCard(null)).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe(TurnPhase.ORDER_UNITS);
    expect(snapshot.playedCard).toBeNull();
    expect(orderablePositions(session)).toEqual(["4-6", "7-1", "7-3", "8-11"]);
  });

  it("rejects a second pick", () => {
    const session = makeSession();

    expect(session.pickCard(null)).toBe(true);
    expect(session.pickCard(null)).toBe(false);
    expect(session.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);
  });
});

describe("GameSession command cards", () => {
  const finest = card("finest-hour");

  it("holds every card its scenario gives, at the scenario's price", () => {
    expect(makeSession().cards.map((held) => held.card.id)).toEqual(ACTION_CARDS.map((c) => c.id));

    const cheaper = makeSession({ scenario: { ...scenario, cardCosts: { allies: { barrage: 5 }, axis: {} } } });
    const costs = Object.fromEntries(cheaper.getSnapshot().cards.map((held) => [held.card.id, held.cost]));
    expect(costs).toMatchObject({ barrage: 5, "finest-hour": finest.cost, "air-power": 7 });
  });

  it("picks no card and goes on to the orders, paying nothing", () => {
    const session = defenderTurn();

    expect(session.pickCard(null)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ phase: TurnPhase.ORDER_UNITS, playedCard: null, coins: 0, coinEntries: [] });
  });

  it("pays for a card at once, and gets the coins back when it's taken back", () => {
    const session = defenderTurn();
    session.adjustCoins(15);
    expect(session.getSnapshot().cards.find((held) => held.card.id === finest.id)).toMatchObject({ playable: true, turnsLeft: 0 });

    expect(session.pickCard(finest)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ phase: TurnPhase.ORDER_UNITS, playedCard: finest, coins: 0 });
    expect(session.getSnapshot().coinEntries).toContainEqual({ kind: "card", amount: -15, card: finest.name });

    expect(session.unpickCard()).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, playedCard: null, coins: 15 });
  });

  it("won't play a card the side can't pay for", () => {
    const session = defenderTurn();
    session.adjustCoins(14);

    expect(session.getSnapshot().cards.find((held) => held.card.id === finest.id)!.playable).toBe(false);
    expect(session.pickCard(finest)).toBe(false);
    expect(session.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
    expect(session.pickCard(card("air-power"))).toBe(true); // 7 supplies
    expect(session.getSnapshot().coins).toBe(7);
  });

  it("lets the attacker play a card on turn 1", () => {
    const session = makeSession({ testMode: true });
    expect(session.getSnapshot()).toMatchObject({ turn: 1, coins: TEST_MODE_COINS });
    expect(session.pickCard(finest)).toBe(true);
  });

  it("waits out the cooldown after a card is played, also after a reload", () => {
    const session = defenderTurn();
    session.adjustCoins(30);
    expect(session.pickCard(finest)).toBe(true); // turn 1
    orderAllAndFight(session);
    finishTurn(session);

    const finestNow = (s: GameSession) => s.getSnapshot().cards.find((held) => held.card.id === finest.id)!;
    expect(session.getSnapshot().turn).toBe(2);
    expect(finestNow(session)).toMatchObject({ turnsLeft: 3, playable: false });
    expect(session.pickCard(finest)).toBe(false);
    expect(session.getSnapshot().cards.find((held) => held.card.id === "resupply")!.playable).toBe(true);
    expect(session.getSnapshot().log[0]!.card).toEqual({ id: finest.id, name: finest.name });

    const restored = reload(session);
    expect(finestNow(restored)).toMatchObject({ turnsLeft: 3, playable: false });
    expect(restored.pickCard(finest)).toBe(false);

    for (const turnsLeft of [3, 2, 1]) {
      expect(finestNow(restored).turnsLeft).toBe(turnsLeft);
      expect(restored.pickCard(null)).toBe(true);
      orderAllAndFight(restored);
      finishTurn(restored);
    }
    expect(restored.getSnapshot().turn).toBe(5);
    expect(finestNow(restored)).toMatchObject({ turnsLeft: 0, playable: true });
    expect(restored.pickCard(finest)).toBe(true);
  });

  it("ignores the cooldown in test mode", () => {
    const session = defenderTurn({ testMode: true });
    expect(session.pickCard(finest)).toBe(true);
    orderAllAndFight(session);
    finishTurn(session);

    expect(session.getSnapshot().cards.find((held) => held.card.id === finest.id)).toMatchObject({ turnsLeft: 0, playable: true });
    expect(session.getSnapshot().coins).toBe(TEST_MODE_COINS);
    expect(session.pickCard(finest)).toBe(true);
  });

  it("gives every shot a die more with Finest Hour", () => {
    const session = defenderTurn({ random: () => 0 });
    session.adjustCoins(15);
    session.pickCard(finest);
    hold(session, LEFT_INF, OTHER_INF);
    orderAllAndFight(session);

    expect(session.combatBonusesFor(0)).toEqual([{ name: finest.name, dice: 1 }]);
    expect(shoot(session, 0, AT_INFANTRY)).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ dice: 3, combatBonus: true });
    expect(shot!.steps).toContainEqual(expect.objectContaining({ kind: "card", dice: 1, card: finest.name }));
  });

  it("doesn't hold a card the scenario leaves out, nor one it isn't given", () => {
    const session = defenderTurn({ scenario: { ...defending, airPower: { allies: 0, axis: 0 }, bigGuns: [] }, testMode: true });

    expect(session.cards.map((held) => held.card.id)).toEqual(["finest-hour", "resupply", "refuel", "reinforcements"]);
    expect(session.pickCard(card("air-power"))).toBe(false);
    expect(session.pickCard(card("barrage"))).toBe(false);
    expect(session.pickCard({ ...finest, id: "stranger" })).toBe(false);
    expect(session.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
  });
});

describe("GameSession giving orders", () => {
  it("only offers moves for this side's units while giving orders", () => {
    const session = makeSession();
    expect(session.getMoveOptions(LEFT_INF)).toBeNull(); // picking a card
    session.pickCard(null);

    expect(session.getMoveOptions({ row: 0, col: 0 })).toBeNull(); // empty hex
    expect(session.getMoveOptions(LEFT_INF)?.moves.length).toBeGreaterThan(0);
    expect(session.getMoveOptions({ row: 8, col: 11 })?.moves.length).toBeGreaterThan(0);
  });

  it("moves a unit and records the path from start to destination (B5)", () => {
    const session = makeSession();
    session.pickCard(null);
    const tank = unitAt(session, TANK);
    const destination = { row: 5, col: 6 };

    expect(session.issueOrder(TANK, destination)).toBe(true);

    const [order] = session.getSnapshot().orders;
    expect(order!.path).toEqual([TANK, destination]);
    expect(order!.canFire).toBe(true);
    expect(unitAt(session, destination)).toBe(tank);
    expect(unitAt(session, TANK)).toBeNull();
    expect(orderablePositions(session)).toEqual(["7-1", "7-3", "8-11"]);
  });

  it("can't fire after moving into forest", () => {
    const session = makeSession();
    session.pickCard(null);

    session.issueOrder(TANK, { row: 4, col: 7 });

    expect(session.getSnapshot().orders[0]!.canFire).toBe(false);
  });

  it("orders a unit to hold and fire when its own hex is chosen, and leaves it out of the units to order", () => {
    const session = makeSession();
    session.pickCard(null);

    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);

    const [order] = session.getSnapshot().orders;
    expect(order!.canFire).toBe(true);
    expect(order!.action).toBe("infantry:firefight");
    expect(session.getSnapshot().orderable).not.toContainEqual(LEFT_INF);
  });

  it("rejects a destination out of range without changing anything", () => {
    const session = makeSession();
    session.pickCard(null);
    const before = session.getSnapshot();

    expect(session.issueOrder(LEFT_INF, { row: 7, col: 6 })).toBe(false);

    expect(session.getSnapshot()).toBe(before);
    expect(unitAt(session, LEFT_INF)).not.toBeNull();
  });

  it("undoes the last order, putting the unit back", () => {
    const session = makeSession();
    session.pickCard(null);
    const tank = unitAt(session, TANK);
    session.issueOrder(TANK, { row: 5, col: 6 });

    expect(session.undoLastOrder()).toBe(true);

    expect(unitAt(session, TANK)).toBe(tank);
    expect(orderablePositions(session)).toContain(positionKey(TANK));
    expect(session.getSnapshot().orders).toHaveLength(0);
  });

  it("commits whenever the player is done (units without an order rest), then locks the orders", () => {
    const session = makeSession();
    session.pickCard(null);
    session.issueOrder(LEFT_INF, LEFT_INF);

    expect(session.commitOrders()).toBe(true);

    expect(session.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
    expect(session.getSnapshot().orders).toHaveLength(1);
    expect(orderablePositions(session)).toEqual([]);
    expect(session.undoLastOrder()).toBe(false);
    expect(session.getMoveOptions(TANK)).toBeNull();
    expect(session.issueOrder(TANK, TANK)).toBe(false);
  });
});

describe("GameSession movement and final phases", () => {
  it("goes orders -> movement -> battle -> final phase, one step at a time", () => {
    const session = makeSession();
    session.pickCard(null);
    hold(session, LEFT_INF, OTHER_INF);

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

  it("keeps the phase after a reload", () => {
    const session = makeSession();
    session.pickCard(null);
    orderAllAndFight(session);
    session.endBattle();

    const restored = reload(session);

    expect(restored.getSnapshot().phase).toBe(TurnPhase.END_OF_TURN);
    expect(restored.endTurn()).toBe(true);
  });
});

describe("GameSession ending the turn", () => {
  it("clears the orders and the card played, and starts the next turn", () => {
    const session = makeSession();
    session.pickCard(null);
    orderAllAndFight(session);

    finishTurn(session);

    const snapshot = session.getSnapshot();
    expect(snapshot.turn).toBe(2);
    expect(snapshot.phase).toBe(TurnPhase.PICK_CARDS);
    expect(snapshot.orders).toEqual([]);
    expect(snapshot.playedCard).toBeNull();
  });

  it("only ends the turn from the final phase", () => {
    const session = makeSession();

    expect(session.endTurn()).toBe(false);
    session.pickCard(null);
    expect(session.endTurn()).toBe(false);
    orderAllAndFight(session);
    expect(session.endTurn()).toBe(false);
  });
});

describe("GameSession syncing the table in the final phase", () => {
  const inFinalPhase = () => {
    const session = makeSession();
    session.pickCard(null);
    orderAllAndFight(session);
    session.endBattle();
    return session;
  };

  it("only allows board edits in the final phase, or in Órdenes before any order", () => {
    const session = makeSession();

    expect(session.removeUnit(TANK)).toBe(false); // picking cards
    session.pickCard(null);
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
    const session = makeSession();
    session.pickCard(null);
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
    const restored = reload(session);
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
    session.pickCard(null);
    expect(session.getSnapshot().orderable).toHaveLength(3);
  });
});

describe("GameSession firing", () => {
  // The infantry at (7,1) and (7,3) hold and fire (orders 0 and 1); the other units hold too
  const battle = () => {
    // Always rolls the first face: infantry
    const session = makeSession({ random: () => 0 });
    session.pickCard(null);
    hold(session, LEFT_INF, OTHER_INF);
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
    const restored = reload(session);
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
    const session = makeSession();
    session.pickCard(null);
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

  it("gives a unit one shot a turn", () => {
    const session = battle();

    expect(session.getSnapshot().orders[0]!.shots).toBe(1);
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
    const session = battle();
    shoot(session, 0, { infantry: true, closeAssault: true }); // 3 dice
    shoot(session, 1, AT_INFANTRY); // 2 dice

    expect(session.keepResults(1, 0, [1])).toBe(true);
    expect(session.getSnapshot().shots.map((s) => s.kept)).toEqual([null, [1]]);
    expect(session.getSnapshot().shots[1]!.faces).toHaveLength(2); // the full roll stays
    expect(session.keepResults(0, 0, [2, 0])).toBe(true);
    expect(session.getSnapshot().shots[0]!.kept).toEqual([0, 2]);
    expect(session.keepResults(0, 0, [0, 1, 2])).toBe(true); // all of them
    expect(session.getSnapshot().shots[0]!.kept).toBeNull();
    expect(session.keepResults(1, 0, null)).toBe(true);
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

    const restored = reload(session);
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
  // The infantry at (7,1) and (7,3) hold and fire (orders 0 and 1)
  // Low in the last side (a flag, or the 8-sided die's supply), where luck never turns a die
  const battle = (longRangeDie: boolean, random = () => 0.9) => {
    const session = makeSession({ longRangeDie, random });
    session.pickCard(null);
    hold(session, LEFT_INF, OTHER_INF);
    fight(session);
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
    const restored = reload(battle(true));

    expect(restored.longRangeDie).toBe(true);
  });
});

describe("GameSession first turn", () => {
  const ARTILLERY: Position = { row: 8, col: 5 };
  const withArtillery = (attacker: Faction): Scenario => ({
    ...scenario,
    attacker,
    units: { ...scenario.units, allies: { ...scenario.units.allies, artillery: [ARTILLERY] } },
  });
  const ammoAt = (session: GameSession, at: Position, supply: Supply) =>
    amountOf(session.getSnapshot().supplies.find(({ position }) => samePosition(position, at))!.supplies, supply);

  it("has both sides pick a card on turn 1", () => {
    for (const session of [makeSession({ testMode: true }), defenderTurn({ testMode: true })]) {
      expect(session.getSnapshot()).toMatchObject({ turn: 1, phase: TurnPhase.PICK_CARDS });
      expect(session.getSnapshot().cards.some((held) => held.playable)).toBe(true);
      expect(session.pickCard(card("finest-hour"))).toBe(true);
    }
  });

  it("starts the defender's infantry with 1 ammo and its tanks and artillery with 1 shell, the attacker's with 2", () => {
    const defender = new GameSession({ scenario: withArtillery("Axis"), faction: "Allies" });
    expect(defender.attacking).toBe(false);
    expect(ammoAt(defender, LEFT_INF, Supply.AMMO)).toBe(1);
    expect(ammoAt(defender, TANK, Supply.SHELLS)).toBe(1);
    expect(ammoAt(defender, ARTILLERY, Supply.SHELLS)).toBe(1);
    expect(ammoAt(reload(defender), LEFT_INF, Supply.AMMO)).toBe(1);

    const attacker = new GameSession({ scenario: withArtillery("Allies"), faction: "Allies" });
    expect(ammoAt(attacker, LEFT_INF, Supply.AMMO)).toBe(2);
    expect(ammoAt(attacker, TANK, Supply.SHELLS)).toBe(2);
    expect(ammoAt(attacker, ARTILLERY, Supply.SHELLS)).toBe(2);
  });
});

describe("GameSession collisions", () => {
  const MOVED_TO: Position = { row: 4, col: 4 };

  /** The tank moves 2 hexes west (it can still fire); the other units rest */
  const tankMoved = (session = makeSession({ random: () => 0 })) => {
    if (session.getSnapshot().phase === TurnPhase.PICK_CARDS) session.pickCard(null);
    expect(session.issueOrder(TANK, MOVED_TO)).toBe(true);
    fight(session);
    return session;
  };

  it("rolls close assault dice minus 1, ignoring terrain, and uses up the unit's shot", () => {
    const session = tankMoved();

    expect(session.fireCollision(0, true)).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ orderIndex: 0, dice: 2, collision: true, combatBonus: false });
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

  it("adds Finest Hour's die", () => {
    const finest = card("finest-hour");
    const turn = defenderTurn({ random: () => 0, testMode: true });
    expect(turn.pickCard(finest)).toBe(true);
    const session = tankMoved(turn);

    session.fireCollision(0, true);

    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 3, combatBonus: true });
    expect(session.getSnapshot().shots[0]!.steps.at(-1)).toEqual({
      label: { es: "Carta La Hora de la Verdad", en: "Their Finest Hour card" },
      dice: 1,
      kind: "card",
      card: finest.name,
    });
  });

  it("only lets a unit that moved, can fire and hasn't fired yet roll a collision", () => {
    // Holding units didn't move, so they can't have collided
    const session = makeSession();
    session.pickCard(null);
    orderAllAndFight(session);
    expect(session.fireCollision(0, true)).toBe(false);

    // Infantry that moved 2 hexes on Motorized can't fire this turn, so it doesn't roll either
    const moved = makeSession();
    moved.pickCard(null);
    moved.giveAction(LEFT_INF, "infantry:motorized", { row: 5, col: 1 });
    orderAllAndFight(moved);
    expect(moved.getSnapshot().orders[0]!.canFire).toBe(false);
    expect(moved.fireCollision(0, true)).toBe(false);

    // A unit that already fired normally
    const fired = tankMoved();
    expect(shoot(fired, 0, AT_INFANTRY)).toBe(true);
    expect(fired.fireCollision(0, true)).toBe(false);
  });

  it("keeps the collision flag after a reload and in the turn log", () => {
    const session = tankMoved();
    session.fireCollision(0, true);

    const restored = reload(session);
    expect(restored.getSnapshot().shots[0]!.collision).toBe(true);

    finishTurn(session);
    expect(session.getSnapshot().log[0]!.shots[0]!.collision).toBe(true);
  });
});

describe("GameSession firing order", () => {
  /** Order 0 holds; order 1 moves one hex and can still fire; the other units rest */
  const oneHeldOneMoved = () => {
    const session = makeSession();
    session.pickCard(null);
    session.issueOrder(LEFT_INF, LEFT_INF);
    const to = session.getMoveOptions(OTHER_INF)!.moveAndFire.find((p) => !samePosition(p, OTHER_INF))!;
    expect(session.issueOrder(OTHER_INF, to)).toBe(true);
    fight(session);
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

    expect(makeSession().skipUnmovedFire()).toBe(false);
  });

  it("keeps the skip after a reload and forgets it at the next turn", () => {
    const session = oneHeldOneMoved();
    session.skipUnmovedFire();

    const restored = reload(session);
    expect(restored.getSnapshot().unmovedFireSkipped).toBe(true);
    expect(shoot(restored, 0, AT_INFANTRY)).toBe(false);

    finishTurn(restored);
    expect(restored.getSnapshot().unmovedFireSkipped).toBe(false);
  });
});

describe("GameSession turn log", () => {
  it("records each finished turn as plain JSON: card, orders, shots and map edits", () => {
    const session = makeSession();
    session.pickCard(null);
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
    expect(record!.card).toBeNull();
    expect(record!.orders).toHaveLength(4);
    expect(record!.orders[tankOrder]).toEqual({ unit: "tank", start: TANK, end: TANK, path: [TANK], canFire: true, action: "tank:firefight" });
    expect(record!.shots).toEqual([
      { order: tankOrder, unit: "tank", dice: 3, steps: expect.any(Array), faces: expect.any(Array), kept: null, notes: [], collision: false, target: { ...AT_INFANTRY, die: "battle" }, option: "tank:normal" },
    ]);
    expect(record!.shots[0]!.faces).toHaveLength(3);
    expect(record!.battleEdits).toEqual([
      { kind: "remove", unit: "tank", position: TANK },
      { kind: "move", unit: "infantry", from: LEFT_INF, to: TANK },
      { kind: "move", unit: "infantry", from: TANK, to: { row: 3, col: 3 } },
    ]);
  });

  it("names the card played", () => {
    const finest = card("finest-hour");
    const session = defenderTurn({ testMode: true });
    session.pickCard(finest);
    orderAllAndFight(session);
    finishTurn(session);

    const [record] = session.getSnapshot().log;
    expect(record!.card).toEqual({ id: "finest-hour", name: finest.name });
    expect(record!.coins).toContainEqual({ kind: "card", amount: -finest.cost, card: finest.name });
  });

  it("marks the scenario's elite units in the orders, shots and map edits", () => {
    const session = makeSession({ scenario: { ...scenario, elite: [LEFT_INF] } });
    session.pickCard(null);
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
    const session = makeSession();
    session.pickCard(null);
    const fixed = { row: 3, col: 3 };
    // The tank wasn't where the map had it; once fixed, it's ordered on from there
    expect(session.relocateUnit(TANK, fixed)).toBe(true);
    expect(session.issueOrder(fixed, { row: 3, col: 4 })).toBe(true);
    orderAllAndFight(session);
    session.endBattle();
    // Reloaded in the final phase, the edit still knows its unit
    const restored = reload(session);

    finishTurn(restored);

    expect(restored.getSnapshot().log[0]!.battleEdits).toEqual([{ kind: "move", unit: "tank", from: TANK, to: fixed }]);
  });

  it("leaves out orders, shots and edits that were undone", () => {
    const session = makeSession();
    session.pickCard(null);
    hold(session, LEFT_INF, OTHER_INF);
    session.undoLastOrder();
    fight(session);
    shoot(session, 0, AT_INFANTRY);
    session.undoShot(0);
    session.endBattle();
    session.removeUnit(LEFT_INF);
    session.undoBattleEdit();
    finishTurn(session);

    const [record] = session.getSnapshot().log;
    expect(record!.orders).toHaveLength(1);
    expect(record!.shots).toEqual([]);
    expect(record!.battleEdits).toEqual([]);
  });

  it("adds one record per turn, oldest first", () => {
    const session = makeSession();
    for (let turn = 1; turn <= 3; turn++) {
      session.pickCard(null);
      orderAllAndFight(session);
      finishTurn(session);
    }

    expect(session.getSnapshot().log.map((r) => r.turn)).toEqual([1, 2, 3]);
  });
});

describe("GameSession saving and restoring", () => {
  it("restores the phase and the card being played", () => {
    const session = defenderTurn({ testMode: true });
    session.pickCard(card("finest-hour"));

    const restored = reload(session).getSnapshot();
    const original = session.getSnapshot();

    expect(restored.playedCard).toBe(card("finest-hour"));
    expect(restored.phase).toBe(TurnPhase.ORDER_UNITS);
    expect(restored.coins).toBe(original.coins);
    expect(restored.orderable).toEqual(original.orderable);
  });

  it("carries on giving orders where it left off, including undoing a move", () => {
    const session = makeSession();
    session.pickCard(null);
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
    const session = makeSession();
    session.pickCard(null);
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
    const session = makeSession();
    session.pickCard(null);
    orderAllAndFight(session);
    shoot(session, 0, AT_INFANTRY);

    const restored = reload(session);

    expect(restored.getSnapshot().shots).toEqual(session.getSnapshot().shots);
    expect(shoot(restored, 0, AT_INFANTRY)).toBe(false);
    expect(restored.undoShot(0)).toBe(true);
  });

  it("keeps the turn log", () => {
    const session = makeSession();
    session.pickCard(null);
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
      GameSession.restore({ ...saved, ...changes } as SavedGame, scenario);

    expect(broken({})).not.toThrow();
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
    expect(broken({ playedCard: "no-such-card" })).toThrow();
    expect(broken({ cardsPlayedOn: { "finest-hour": 1.5 } })).toThrow();
    expect(broken({ cardsPlayedOn: null as never })).toThrow();
    const shot = { steps: [], dice: 1, faces: [], notes: [], collision: false, combatBonus: false, kept: null, target: { infantry: true, closeAssault: false, die: "battle" as const } };
    expect(broken({ shots: [{ ...shot, orderIndex: 5 }] })).toThrow();
    expect(broken({ shots: [{ ...shot, orderIndex: 0, target: { ...shot.target, die: "d20" as never } }] })).toThrow();
    expect(broken({ startCoins: "3" as never })).toThrow();
    expect(broken({ coinAdjustments: [1.5] })).toThrow();
    expect(broken({ units: [{ ...saved.units[0]!, position: { row: 40, col: 0 } }] })).toThrow();
  });
});

describe("GameSession coins", () => {
  /** The defender at turn 1, with `coins` added by hand and no card played */
  const turnWithCoins = (coins: number, random = () => 0) => {
    const session = defenderTurn({ random });
    if (coins > 0) expect(session.adjustCoins(coins)).toBe(true);
    expect(session.pickCard(null)).toBe(true);
    return session;
  };

  /** The infantry at (7,1) and (7,3) hold (orders 0 and 1), and the other units too */
  const leftBattle = (session: GameSession) => {
    hold(session, LEFT_INF, OTHER_INF);
    orderAllAndFight(session);
  };

  it("starts with none", () => {
    expect(makeSession().getSnapshot()).toMatchObject({ coins: 0, coinEntries: [] });
  });

  it("earns 1 coin per supply rolled in battle, and gives it back if the shot is undone", () => {
    const session = turnWithCoins(0, () => 0.7); // every die a supply
    leftBattle(session);

    shoot(session, 0, AT_INFANTRY);

    expect(session.getSnapshot().coins).toBe(2);
    expect(session.getSnapshot().coinEntries).toEqual([{ kind: "supplies", amount: 2, unit: UnitType.INFANTRY }]);
    session.undoShot(0);
    expect(session.getSnapshot().coins).toBe(0);
  });

  it("always counts the supplies: only hits can be left out", () => {
    const session = turnWithCoins(0, () => 0.7);
    leftBattle(session);
    shoot(session, 0, AT_INFANTRY);
    const rolled = session.getSnapshot().shots[0]!.faces.length;

    expect(session.keepResults(0, 0, [1])).toBe(false);

    expect(session.getSnapshot().coins).toBe(rolled);
  });

  it("earns a coin for every supply, in close assault on armour or artillery too", () => {
    const session = turnWithCoins(0, () => 0.7);
    leftBattle(session);

    shoot(session, 0, { infantry: false, closeAssault: true });

    const [shot] = session.getSnapshot().shots;
    expect(shot!.faces.every((face) => face === "supply")).toBe(true);
    expect(session.getSnapshot().coins).toBe(shot!.faces.length);
  });

  it("earns coins for supplies on turn 1 and carries them into turn 2", () => {
    const session = makeSession({ random: () => 0.7 });
    session.pickCard(null);
    orderAllAndFight(session);

    shoot(session, 0, AT_INFANTRY); // every die a supply: a coin each
    const earned = session.getSnapshot().coins;
    expect(earned).toBeGreaterThan(0);
    expect(session.getSnapshot().coinEntries.map((entry) => entry.kind)).toEqual(["supplies"]);
    session.endBattle();

    finishTurn(session);
    expect(session.getSnapshot()).toMatchObject({ turn: 2, coins: earned });
    expect(session.adjustCoins(-1)).toBe(true);
  });

  it("lets the player pay and add coins by hand, never below 0, and undo it", () => {
    const session = turnWithCoins(3);

    expect(session.adjustCoins(-4)).toBe(false);
    expect(session.adjustCoins(-2)).toBe(true);
    expect(session.adjustCoins(0)).toBe(false);
    expect(session.adjustCoins(1.5)).toBe(false);
    expect(session.getSnapshot().coins).toBe(1);

    expect(session.undoCoinAdjustment()).toBe(true);
    expect(session.getSnapshot().coins).toBe(3);
  });

  it("carries the coins into the next turn, with the turn's ledger in the log", () => {
    const session = turnWithCoins(0, () => 0.7);
    leftBattle(session);
    shoot(session, 0, AT_INFANTRY);

    finishTurn(session);

    const snapshot = session.getSnapshot();
    expect(snapshot).toMatchObject({ coins: 2, coinEntries: [] });
    expect(snapshot.log.at(-1)).toMatchObject({
      coins: [{ kind: "supplies", amount: 2, unit: UnitType.INFANTRY }],
      coinsAfter: 2,
    });
  });

  it("keeps the coins and this turn's changes after a reload", () => {
    const session = turnWithCoins(6);
    session.adjustCoins(-1);

    const restored = reload(session);

    expect(restored.getSnapshot().coins).toBe(5);
    expect(restored.getSnapshot().coinEntries).toEqual(session.getSnapshot().coinEntries);
    expect(restored.undoCoinAdjustment()).toBe(true);
    expect(restored.getSnapshot().coins).toBe(6);
  });
});

describe("GameSession map markers", () => {
  const barrage = card("barrage");
  const FAR: Position = { row: 1, col: 10 };

  /** The defender at turn 2, playing Barrage, the left infantry ordered to hold */
  const withBarrage = () => {
    const session = defenderTurn();
    session.adjustCoins(barrage.cost);
    expect(session.pickCard(barrage)).toBe(true);
    hold(session, LEFT_INF, OTHER_INF);
    return session;
  };

  it("marks the card's hexes, and won't confirm the orders until they're all marked", () => {
    const session = withBarrage();
    expect(session.getSnapshot().marking).toMatchObject({ card: barrage, marked: 0 });
    expect(session.getSnapshot().markable.length).toBeGreaterThan(0);
    expect(session.commitOrders()).toBe(false);

    expect(session.markHex(LEFT_INF)).toBe(false); // one of your units
    expect(session.markHex(FAR)).toBe(true);

    expect(session.getSnapshot()).toMatchObject({ markers: [FAR], markerKinds: ["target"], markable: [], marking: null });
    expect(session.markHex({ row: 1, col: 9 })).toBe(false);
    expect(session.commitOrders()).toBe(true);
    expect(session.undoMarker()).toBe(false); // confirmed
  });

  it("undoes the last mark, and the card can be taken back once no order nor mark is left", () => {
    const session = withBarrage();
    session.markHex(FAR);

    expect(session.undoMarker()).toBe(true);
    expect(session.getSnapshot().markers).toEqual([]);
    session.markHex(FAR);
    expect(session.unpickCard()).toBe(false); // orders given
    session.undoLastOrder();
    session.undoLastOrder();
    expect(session.unpickCard()).toBe(false); // a hex marked
    session.undoMarker();

    expect(session.unpickCard()).toBe(true);
    expect(session.getSnapshot().markers).toEqual([]);
    session.pickCard(null);
    expect(session.getSnapshot().marking).toBeNull();
    expect(session.commitOrders()).toBe(true);
  });

  it("keeps the marks after a reload and in the turn log", () => {
    const session = withBarrage();
    session.markHex(FAR);

    const restored = reload(session);
    expect(restored.getSnapshot().markers).toEqual([FAR]);
    expect(restored.getSnapshot().playedCard).toBe(barrage);

    restored.commitOrders();
    restored.startBattle();
    finishTurn(restored);
    expect(restored.getSnapshot().log.at(-1)!.markers).toEqual([FAR]);
    expect(restored.getSnapshot().markers).toEqual([]);
  });
});

describe("GameSession attack cards", () => {
  const barrage = card("barrage");
  const FAR: Position = { row: 1, col: 10 };

  /** The defender at turn 2, with coins for any card; dice show supplies */
  const turnTwo = () => {
    const session = defenderTurn({ random: () => 0.7 });
    session.adjustCoins(20);
    return session;
  };

  const barrageBattle = () => {
    const session = turnTwo();
    session.pickCard(barrage);
    session.markHex(FAR);
    orderAllAndFight(session);
    return session;
  };

  it("keeps your units off the marked hexes and next to them for Barrage and Air Bombardment", () => {
    const session = turnTwo();
    const mark = { row: 4, col: 2 };
    const nextToMark = new Hex(mark).getNeighbors();
    for (const id of ["barrage", "air-bombardment"]) {
      session.pickCard(card(id));
      expect(session.getMoveOptions(LEFT_INF)!.moves.some((p) => includesPosition(nextToMark, p))).toBe(true);
      expect(session.markHex(mark)).toBe(true);
      expect(session.getMoveOptions(LEFT_INF)!.moves).not.toContainEqual(mark);
      expect(session.getMoveOptions(LEFT_INF)!.moves.some((p) => includesPosition(nextToMark, p))).toBe(false);
      session.undoMarker();
      session.unpickCard();
    }
  });

  it("erases a mark when undoing an order brings a unit back on it or next to it", () => {
    const session = turnTwo();
    session.pickCard(barrage);
    const to = session.getMoveOptions(LEFT_INF)!.moves.find((p) => hexDistance(p, LEFT_INF) === 2)!;
    session.issueOrder(LEFT_INF, to);
    expect(session.markHex(LEFT_INF)).toBe(true); // empty now, and the unit two hexes off
    session.undoLastOrder();
    expect(session.getSnapshot().markers).toEqual([]);
  });

  it("rolls the card's dice on each marked hex before any unit fires on the attack die", () => {
    const session = barrageBattle();
    expect(session.getSnapshot().attackMarks).toEqual([{ marker: 0, position: FAR, card: barrage, dicePerHex: 4 }]);
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

    const restored = reload(session);
    expect(restored.getSnapshot().cardAttacks).toEqual(session.getSnapshot().cardAttacks);
    finishTurn(restored);
    expect(restored.getSnapshot().log.at(-1)!.cardAttacks).toHaveLength(1);
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
    });

  it("starts the paradrop side placing its paratroopers; the other side starts as usual", () => {
    expect(paradropSession().getSnapshot()).toMatchObject({ phase: TurnPhase.PARADROP, dropsLeft: 2, drops: [] });
    expect(paradropSession("Axis").getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
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
    defender.dropUnit({ row: 2, col: 2 });
    defender.finishParadrop();
    expect(defender.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 1 });
    // A defender's paratroopers start a shot short too
    const dropped = defender.getSnapshot().supplies.find(({ position }) => samePosition(position, { row: 2, col: 2 }));
    expect(amountOf(dropped!.supplies, Supply.AMMO)).toBe(1);
  });

  it("keeps the paratroopers through a reload, and can still undo them", () => {
    const session = paradropSession();
    session.dropUnit({ row: 2, col: 2 });

    const restored = reload(session);

    expect(restored.getSnapshot()).toMatchObject({ phase: TurnPhase.PARADROP, dropsLeft: 1 });
    expect(unitAt(restored, { row: 2, col: 2 })?.getUnitType()).toBe(UnitType.INFANTRY);
    expect(restored.undoDrop()).toBe(true);
    expect(unitAt(restored, { row: 2, col: 2 })).toBeNull();
  });
});

describe("GameSession Reinforcements", () => {
  const FAR: Position = { row: 1, col: 10 };
  const reinforcements = card("reinforcements");

  /** The final phase of turn 2 with Reinforcements played and its cross on `cross` */
  const finalPhase = (cross = FAR) => {
    const session = defenderTurn();
    session.adjustCoins(reinforcements.cost);
    expect(session.pickCard(reinforcements)).toBe(true);
    expect(session.markHex(cross)).toBe(true);
    expect(session.getSnapshot().markerKinds).toEqual(["cross"]);
    orderAllAndFight(session);
    expect(session.getSnapshot().reinforcementToPlace).toBeNull(); // not before the final phase
    expect(session.endBattle()).toBe(true);
    return session;
  };

  it("puts an infantry unit on the cross as the final phase starts, with no roll", () => {
    const session = finalPhase();

    expect(session.getSnapshot()).toMatchObject({ reinforcementToPlace: null, battleEdits: 1 });
    expect(session.board.getHex(FAR)!.unit!.getUnitType()).toBe(UnitType.INFANTRY);
  });

  it("brings the unit with no energy and everything else full", () => {
    const session = finalPhase();
    const { supplies } = session.getSnapshot().supplies.find((each) => samePosition(each.position, FAR))!;
    expect(supplies.amounts).toMatchObject({ energy: 0, morale: 4, ammo: 2 });
    expect(supplies.equipment).toMatchObject({ explosives: 1, sandbags: 1, medicKit: 1, camouflageNet: 1 });
  });

  it("asks for another hex when the cross is taken, and the placing can be undone", () => {
    const session = finalPhase();
    expect(session.undoBattleEdit()).toBe(true);
    expect(session.board.getHex(FAR)!.unit).toBeNull();
    expect(session.getSnapshot().reinforcementToPlace).toBe(UnitType.INFANTRY);
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

    const restored = reload(session);

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
  const barrage = card("barrage");
  const FAR: Position = { row: 1, col: 10 };

  /** The defender at turn 2 with 10 coins */
  const turnTwo = () => {
    const session = defenderTurn();
    session.adjustCoins(10);
    return session;
  };

  it("goes back to picking a card, with its coins back", () => {
    const session = turnTwo();
    expect(session.pickCard(barrage)).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ coins: 2, canUnpickCard: true });
    session.markHex(FAR);
    expect(session.getSnapshot().canUnpickCard).toBe(false); // a hex is marked
    session.undoMarker();

    expect(session.unpickCard()).toBe(true);

    expect(session.getSnapshot()).toMatchObject({
      phase: TurnPhase.PICK_CARDS,
      playedCard: null,
      markers: [],
      coins: 10,
      canUnpickCard: false,
    });
    expect(session.pickCard(null)).toBe(true);
  });

  it("can't once an order is given, or outside giving orders", () => {
    const session = turnTwo();
    expect(session.unpickCard()).toBe(false);
    session.pickCard(null);
    const position = session.getSnapshot().orderable[0]!;
    session.issueOrder(position, position);

    expect(session.getSnapshot().canUnpickCard).toBe(false);
    expect(session.unpickCard()).toBe(false);
    session.undoLastOrder();
    expect(session.unpickCard()).toBe(true);
  });
});

describe("GameSession firing at a hex on the map", () => {
  // The tank at (4,6) holds (order 0); forest to its east at (4,7)
  const tankBattle = () => {
    const session = makeSession();
    session.pickCard(null);
    hold(session, TANK);
    fight(session);
    return session;
  };
  const target = (session: GameSession, p: Position) =>
    session.fireTargetsFor(0).find((t) => samePosition(t.position, p));

  it("lists the hexes the unit can fire at, with their dice", () => {
    const session = tankBattle();

    // Close assault 3, −2 for armour firing into a forest, +1 for armour's normal fire when it held
    expect(target(session, { row: 4, col: 7 })).toMatchObject({ distance: 1, terrain: HexType.FOREST, dice: 2 });
    expect(target(session, { row: 4, col: 3 })).toMatchObject({ distance: 3, terrain: HexType.PLAINS, dice: 3 });
    expect(target(session, { row: 4, col: 2 })).toBeUndefined(); // out of range
    expect(target(session, TANK)).toBeUndefined();
  });

  it("fires at a hex: its distance and terrain answer those questions", () => {
    const session = tankBattle();

    expect(session.fireAt(0, { position: { row: 4, col: 7 }, infantry: true, sandbags: true })).toBe(true);

    const [shot] = session.getSnapshot().shots;
    expect(shot).toMatchObject({ dice: 2, targetPosition: { row: 4, col: 7 }, target: { infantry: true, closeAssault: true, die: "battle" } });
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
  // Dice always show infantry: a hit on the infantry targets below. The tank holds (order 0)
  const tankBattle = (random = () => 0) => {
    const session = makeSession({ random });
    session.pickCard(null);
    hold(session, TANK);
    fight(session);
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

    const restored = reload(session);

    expect(restored.shotsLeft(0)).toBe(1);
    expect(restored.getSnapshot().shots[0]).toMatchObject({ tookGround: true, targetPosition: FOREST });
  });

  it("never lets infantry take ground", () => {
    const session = makeSession({ random: () => 0 });
    session.pickCard(null);
    hold(session, LEFT_INF, OTHER_INF);
    fight(session);
    session.fireAt(0, { position: { row: 6, col: 1 }, infantry: true, sandbags: false });

    expect(readRoll(session.getSnapshot().shots[0]!.faces, session.getSnapshot().shots[0]!.target).hits).toBeGreaterThan(0);
    expect(session.canTakeGround(0)).toBe(false);
    expect(session.takeGround(0)).toBe(false);
  });
});

describe("GameSession barbed wire", () => {
  // Wire under the left infantry (7,1) and next to the tank at (4,5)
  const WIRE: Position = { row: 4, col: 5 };
  const wired: Scenario = { ...scenario, wire: [LEFT_INF, WIRE] };
  const wireSession = () => {
    const session = makeSession({ scenario: wired });
    session.pickCard(null);
    return session;
  };
  /** Hold orders for every unit, then battle; the index of the left infantry's order */
  const leftBattle = () => {
    const session = wireSession();
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
      // No path goes on through the wire, even with a rule that ignores terrain
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
    expect(session.issueOrder(TANK, WIRE)).toBe(true);
    expect(hasWire(session, WIRE)).toBe(false);
    expect(session.getSnapshot().orders[0]!.clearedWire).toBe(true);

    expect(session.undoLastOrder()).toBe(true);
    expect(hasWire(session, WIRE)).toBe(true);

    // Kept in the save, so undoing after a reload puts it back too
    session.issueOrder(TANK, WIRE);
    const restored = reload(session);
    expect(hasWire(restored, WIRE)).toBe(false);
    expect(restored.undoLastOrder()).toBe(true);
    expect(hasWire(restored, WIRE)).toBe(true);

    // The tank stands on no wire in the battle, so there's nothing to remove or lose a die to
    fight(session);
    expect(session.getSnapshot().canRemoveWire).toEqual([false]);
    expect(session.removeWire(0)).toBe(false);
  });

  it("is left by infantry that enters it", () => {
    const session = wireSession();
    const free = (p: Position) => {
      const hex = session.board.getHex(p);
      return !!hex && hex.canEnter() && !hex.hasUnit();
    };
    const onto = session.board.getHex(OTHER_INF)!.getNeighbors().find(free)!;
    session.board.getHex(onto)!.setWire(true);

    expect(session.issueOrder(OTHER_INF, onto)).toBe(true);
    expect(hasWire(session, onto)).toBe(true);
    expect(session.getSnapshot().orders[0]!.clearedWire).toBe(false);
  });

  it("is removed by armour that takes ground onto it, and put back when that's taken back", () => {
    const FOREST: Position = { row: 4, col: 7 };
    // Dice always show infantry: a hit on the infantry in the forest
    const session = makeSession({ scenario: { ...scenario, wire: [FOREST] }, random: () => 0 });
    session.pickCard(null);
    hold(session, TANK);
    fight(session);
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

    const restored = reload(session);
    expect(hasWire(restored, LEFT_INF)).toBe(false);
    expect(hasWire(restored, WIRE)).toBe(true);
    expect(restored.getSnapshot().shots[0]!.removedWire).toEqual(LEFT_INF);

    const axis = new GameSession({ scenario: { ...scenario, wire: [WIRE] }, faction: "Axis" });
    expect(hasWire(axis, { row: 4, col: 7 })).toBe(true);
  });
});

describe("Experimental rule: a destroyed artillery leaves its crew as infantry", () => {
  const GUN: Position = { row: 5, col: 1 };
  const withArtillery: Scenario = {
    ...scenario,
    units: { ...scenario.units, allies: { ...scenario.units.allies, artillery: [GUN] } },
  };
  const makeGunSession = (artilleryCrew: boolean) => makeSession({ scenario: withArtillery, artilleryCrew });
  const toFinalPhase = (session: GameSession) => {
    session.pickCard(null);
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
    on.pickCard(null);
    expect(on.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);
    expect(on.leavesCrew(GUN)).toBe(false);
    expect(on.removeUnit(GUN)).toBe(true);
    expect(unitAt(on, GUN)).toBeNull();
  });

  it("keeps the rule and the crew after a reload, and logs the swap", () => {
    const session = makeGunSession(true);
    toFinalPhase(session);
    session.removeUnit(GUN);

    const restored = reload(session);
    expect(restored.artilleryCrew).toBe(true);
    expect(typeAt(restored, GUN)).toBe(UnitType.INFANTRY);
    expect(restored.undoBattleEdit()).toBe(true);
    expect(typeAt(restored, GUN)).toBe(UnitType.ARTILLERY);

    restored.removeUnit(GUN);
    expect(restored.endTurn()).toBe(true);
    expect(restored.getSnapshot().log[0]!.battleEdits).toEqual([
      { kind: "remove", unit: UnitType.ARTILLERY, position: GUN, replacedBy: UnitType.INFANTRY },
    ]);
  });
});

describe("GameSession sandbags", () => {
  // Sandbags on the left infantry, and on an empty hex (an enemy unit's, not known here)
  const ENEMY_BAGS: Position = { row: 2, col: 2 };
  const withSandbags: Scenario = { ...scenario, attacker: "Axis", sandbags: [LEFT_INF, ENEMY_BAGS] };
  const bagsAt = (session: GameSession, p: Position) => session.board.getHex(p)!.sandbags;
  /** Turn 2 giving orders, no card played */
  const leftTurn = () => {
    const session = defenderTurn({ scenario: withSandbags });
    expect(session.pickCard(null)).toBe(true);
    return session;
  };

  it("starts with the scenario's sandbags on this side's units only", () => {
    const allies = new GameSession({ scenario: withSandbags, faction: "Allies" });
    const axis = new GameSession({ scenario: withSandbags, faction: "Axis" });

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
    orderAllAndFight(session);
    expect(session.endBattle()).toBe(true);

    expect(session.relocateUnit(LEFT_INF, { row: 8, col: 1 })).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(false);
    expect(session.undoBattleEdit()).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(true);

    expect(session.removeUnit(LEFT_INF)).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(false);
    expect(session.undoBattleEdit()).toBe(true);
    expect(bagsAt(session, LEFT_INF)).toBe(true);
  });

  it("saves the sandbags, and the ones an order took away", () => {
    const session = leftTurn();
    session.issueOrder(LEFT_INF, { row: 6, col: 1 });

    const restored = reload(session);

    expect(restored.board.sandbagPositions()).toEqual([]);
    expect(restored.undoLastOrder()).toBe(true);
    expect(restored.board.sandbagPositions()).toEqual([LEFT_INF]);
  });
});

describe("GameSession elite units", () => {
  // The left infantry at (7,1) is elite; the one at (7,3) isn't
  const eliteScenario: Scenario = { ...scenario, elite: [LEFT_INF] };
  const leftTurn = () => {
    const session = makeSession({ scenario: eliteScenario });
    session.pickCard(null);
    return session;
  };

  it("moves and fires elite infantry as any infantry, with more supplies", () => {
    const session = leftTurn();
    const suppliesAt = (position: Position) =>
      session.getSnapshot().supplies.find((each) => samePosition(each.position, position))!.supplies;

    expect(session.getMoveOptions(LEFT_INF, "infantry:moveOut")!.limits).toMatchObject({ maxMove: 2, moveAndFire: 1 });
    expect(session.giveAction(LEFT_INF, "infantry:moveOut", { row: 5, col: 1 })).toBe(true);
    expect(session.getSnapshot().orders[0]!.canFire).toBe(false);
    expect(suppliesAt({ row: 5, col: 1 }).amounts).toMatchObject({ morale: 10, energy: 10 });
    expect(suppliesAt(OTHER_INF).amounts).toMatchObject({ morale: 4, energy: 5 });
  });

  it("keeps elite units elite in a save", () => {
    const restored = reload(leftTurn());

    expect(restored.board.getHex(LEFT_INF)!.unit!.elite).toBe(true);
    expect(restored.board.getHex(OTHER_INF)!.unit!.elite).toBe(false);
  });
});

describe("pass and play movement", () => {
  /** The left infantry ordered 2 hexes and the left-center one to hold; the tank and the right infantry have no order */
  const movedTwo = () => {
    const session = makeSession();
    expect(session.pickCard(null)).toBe(true);
    const far = session.getMoveOptions(LEFT_INF)!.moves.find((p) => hexDistance(p, LEFT_INF) === 2)!;
    expect(session.giveAction(LEFT_INF, "infantry:motorized", far)).toBe(true);
    expect(session.issueOrder(OTHER_INF, OTHER_INF)).toBe(true);
    expect(session.commitOrders()).toBe(true);
    return { session, order: session.getSnapshot().orders[0]! };
  };

  /** The left infantry ordered 1 hex, so it can still fire; the left-center one holds */
  const movedOne = () => {
    const session = makeSession();
    expect(session.pickCard(null)).toBe(true);
    const near = session.getMoveOptions(LEFT_INF)!.moveAndFire.find((p) => hexDistance(p, LEFT_INF) === 1)!;
    expect(session.issueOrder(LEFT_INF, near)).toBe(true);
    expect(session.issueOrder(OTHER_INF, OTHER_INF)).toBe(true);
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
    const session = makeSession();
    session.pickCard(null);
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
    expect(session.rollCollision(OTHER_INF, true, null)).toBe(false); // it has an order
    expect(session.getSnapshot().standingCollisions).toHaveLength(1);
    // A tank rolls 3 dice in close assault, minus 1
    expect(session.getSnapshot().standingCollisions[0]).toMatchObject({ from: TANK, dice: 2, unitType: UnitType.TANK });

    const restored = reload(session);
    expect(restored.getSnapshot().standingCollisions).toEqual(session.getSnapshot().standingCollisions);
  });

  it("gives a unit in the ocean no shot, whether it holds or wades in", () => {
    // Infantry at 7-1 holds in the ocean; the one at 7-3 wades into the ocean at 6-3, not 2 hexes to 5-3
    const session = makeSession({ scenario: { ...scenario, tiles: { ocean: [LEFT_INF, { row: 6, col: 3 }, { row: 5, col: 3 }] } } });
    expect(session.pickCard(null)).toBe(true);
    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);
    // A move into the ocean is 1 hex
    expect(session.issueOrder(OTHER_INF, { row: 5, col: 3 })).toBe(false);
    expect(session.issueOrder(OTHER_INF, { row: 6, col: 3 })).toBe(true);
    expect(session.issueOrder(TANK, TANK)).toBe(true);
    expect(session.getSnapshot().orders.map((order) => order.canFire)).toEqual([false, false, true]);
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
  const figuresSession = () => makeSession({ scenario: withArtillery, figures: true });

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
    expect(session.pickCard(null)).toBe(true);
    expect(session.issueOrder(LEFT_INF, LEFT_INF)).toBe(true);
    orderAllAndFight(session);
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

  it("makes each hex a unit in the ocean should retreat a hit, as it can't retreat", () => {
    const session = makeSession({ scenario: { ...withArtillery, tiles: { ocean: [LEFT_INF] } }, figures: true });
    // The first flag only pins it; the next two are hexes to retreat
    session.sufferHits(LEFT_INF, 0, 3);
    expect(session.retreatOptions(LEFT_INF)).toEqual([]);
    expect(session.retreatBlocked(LEFT_INF)).toBe(true);
    expect(session.retreatBlocked(LEFT_INF)).toBe(true);
    expect(session.figuresAt(LEFT_INF)).toBe(4);
    expect(session.mustRetreat(LEFT_INF)).toBe(false);
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
    const restored = reload(session);
    expect(tank(restored).hitThisTurn).toBe(2);
    // A save from before the record still loads, with none
    const { turnHits: _, ...older } = session.save();
    expect(tank(GameSession.restore(JSON.parse(JSON.stringify(older)), withArtillery)).hitThisTurn).toBe(0);
  });

  it("keeps hits from turn to turn and saves them, the flags only for the turn", () => {
    const session = figuresSession();
    session.sufferHits(TANK, 3, 2);
    const restored = reload(session);
    expect(restored.figures).toBe(true);
    expect(restored.figuresAt(TANK)).toBe(2);
    expect(restored.isPinned(TANK)).toBe(true);
    expect(restored.mustRetreat(TANK)).toBe(true);
  });
});

describe("GameSession camouflage", () => {
  it("in pass and play an enemy with the badge can only be fired at in close assault", () => {
    const session = defenderTurn();
    session.pickCard(null);
    session.setEnemyView(() => [
      { position: { row: 6, col: 1 }, unitType: UnitType.INFANTRY, sandbags: false, camouflaged: true },
      { position: { row: 5, col: 1 }, unitType: UnitType.INFANTRY, sandbags: false, camouflaged: true },
    ]);
    orderAllAndFight(session);
    const left = session.getSnapshot().orders.findIndex((o) => samePosition(o.start, LEFT_INF));

    expect(session.aimAt(left, { row: 5, col: 1 })).toBeNull();
    expect(session.aimAt(left, { row: 6, col: 1 })).not.toBeNull();
  });

  it("asks whether the target is camouflaged only when the enemy has infantry", () => {
    const against = (axis: Scenario["units"]["axis"]) => makeSession({ scenario: { ...scenario, units: { ...scenario.units, axis } } });

    expect(against({ infantry: [{ row: 1, col: 1 }] }).enemyCamouflage).toBe(true);
    expect(against({ tank: [{ row: 1, col: 1 }] }).enemyCamouflage).toBe(false);
  });
});

describe("GameSession fordable rivers", () => {
  it("lets a unit wade into a fordable river and fire from it with a die less", () => {
    const FORD: Position = { row: 6, col: 1 };
    const session = makeSession({ scenario: { ...scenario, tiles: { river: [FORD] }, fordableRivers: true } });
    session.pickCard(null);
    expect(session.getMoveOptions(LEFT_INF)!.moveAndFire).toContainEqual(FORD);
    expect(session.issueOrder(LEFT_INF, FORD)).toBe(true);
    hold(session, OTHER_INF);
    fight(session);
    const index = session.getSnapshot().orders.findIndex((o) => samePosition(o.end, FORD));

    expect(session.fireTargetsFor(index).find((t) => samePosition(t.position, { row: 5, col: 1 }))?.dice).toBe(2);
    // It moved, so the unit that held fires first, or gives its shot up
    expect(session.skipUnmovedFire()).toBe(true);
    expect(session.fireAt(index, { position: { row: 5, col: 1 }, infantry: true, sandbags: false })).toBe(true);
    expect(session.getSnapshot().shots[0]!.steps).toContainEqual({ label: { es: "Desde un vado", en: "From a ford" }, dice: -1, kind: "ford" });
  });
});
