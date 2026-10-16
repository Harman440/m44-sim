import { describe, expect, it, vi } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch, { armyOf, otherSide } from "./passAndPlay";
import { SavedGame } from "./saveGame";
import CommandCard from "./commandCard";
import { UnitType } from "./unit";
import { FIGURES } from "../data/figures";
import { turnedRound } from "./BoardManager";
import { readRoll } from "./rollResult";
import { Faction } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Scenario } from "../types/scenario";
import { same } from "../i18n/lang";
import { samePosition } from "./position";
import { Side } from "../types/hex";

const INFANTRY_FIGURES = FIGURES[UnitType.INFANTRY].figures;

// Axis attacks: it plays turn 1 alone
const scenario: Scenario = {
  id: "test",
  name: same("Test"),
  description: same(""),
  initialHandSize: { allies: 2, axis: 2 },
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 7, col: 1 }], tank: [{ row: 8, col: 6 }] },
    axis: { infantry: [{ row: 1, col: 3 }] },
  },
};

// Cards that order every unit, so a turn needs no section
const cards = () => Array.from({ length: 8 }, (_, i) => new CommandCard({ id: `all-${i}`, orders: 6 }));

const newSession = (faction: Faction) => new GameSession({ scenario, faction, initialHandSize: 2, commandCards: cards(), figures: true });

const restoreSide = (saved: SavedGame) => GameSession.restore(saved, scenario, cards());

const newMatch = () => new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") });

/** The side holding the device picks a card and gives hold orders to every unit, then locks them */
const giveOrders = (match: PassAndPlayMatch) => {
  match.uncover();
  const session = match.activeSession();
  expect(session.pickCard(session.getSnapshot().hand[0]!)).toBe(true);
  while (session.getSnapshot().ordersLeft > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
};

/** The reveal: the units move, every collision is rolled, then a battle where nobody fires */
const carryOut = (match: PassAndPlayMatch) => {
  expect(match.moveUnits()).toBe(true);
  match.getSnapshot().movement!.collisions.forEach((_, i) => expect(match.rollCollision(i)).toBe(true));
  expect(match.finishReveal()).toBe(true);
  expect(match.endBattle()).toBe(true);
};

/** The final phase of the side holding the device, to the next turn */
const finishTurn = (match: PassAndPlayMatch) => {
  match.uncover();
  const session = match.activeSession();
  expect(session.getSnapshot().phase).toBe(TurnPhase.END_OF_TURN);
  if (session.getSnapshot().needsRewardChoice) expect(session.chooseReward("coins")).toBe(true);
  expect(session.endTurn()).toBe(true);
};

describe("PassAndPlayMatch", () => {
  it("starts with the attacker, behind the cover screen, while the defender waits", () => {
    const match = newMatch();
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    expect(match.activeSession().faction).toBe("Axis");
    expect(match.sessions.Axis.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
    expect(match.sessions.Allies.getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
  });

  it("uncovers for the player holding the device, and covers again when it's passed", () => {
    const match = newMatch();

    expect(match.pass()).toBe(false); // nobody has shown their side yet
    expect(match.uncover()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: false });
    expect(match.uncover()).toBe(false);
    expect(match.pass()).toBe(false); // the Allies wait out the Axis' extra turn

    giveOrders(match);
    carryOut(match);
    finishTurn(match);
    expect(match.pass()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true });
    expect(match.activeSession().faction).toBe("Allies");
  });

  it("keeps the device with the attacker through the extra turn, then starts the defender's turn 2", () => {
    const match = newMatch();
    giveOrders(match);
    // The defender has no orders to give in turn 1: the attacker's alone are carried out
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", revealTurn: 1 });
    carryOut(match);
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });

    finishTurn(match);

    expect(match.sessions.Allies.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
    expect(match.sessions.Axis.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: false });
  });

  it("hands the device over when a side locks its orders, then reveals both", () => {
    const match = newMatch();
    giveOrders(match);
    carryOut(match);
    finishTurn(match);

    giveOrders(match); // the Axis' turn 2
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true, revealTurn: null });

    giveOrders(match); // the Allies'
    expect(match.getSnapshot()).toMatchObject({ revealTurn: 2 });
    expect(match.pass()).toBe(false);
    expect(match.uncover()).toBe(false);
    expect(match.finishReveal()).toBe(false); // the units haven't moved yet

    expect(match.moveUnits()).toBe(true);
    expect(match.moveUnits()).toBe(false);
    expect(match.getSnapshot().movement).toEqual({ turn: 2, collisions: [], done: true });
    expect(match.finishReveal()).toBe(true);
    // The battle, on one screen: nobody fires (hold orders but no enemy in range)
    expect(match.getSnapshot()).toMatchObject({ covered: false, revealTurn: null, movement: null, battle: { turn: 2 } });
    expect(match.finishReveal()).toBe(false);
    expect(match.pass()).toBe(false);
    expect(match.endBattle()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, battle: null });
  });

  it("hands the device to a side still finishing the last turn", () => {
    const match = newMatch();
    giveOrders(match);
    carryOut(match);
    finishTurn(match);
    giveOrders(match);
    giveOrders(match);
    carryOut(match);

    finishTurn(match); // the Axis' turn 2
    giveOrders(match); // and its turn 3 orders, while the Allies are still moving in turn 2

    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true, revealTurn: null });
    expect(match.activeSession().getSnapshot()).toMatchObject({ phase: TurnPhase.END_OF_TURN, turn: 2 });
  });

  it("tells listeners about its own changes and either side's", () => {
    const match = newMatch();
    const listener = vi.fn();
    const unsubscribe = match.subscribe(listener);

    match.uncover();
    expect(listener).toHaveBeenCalledTimes(1);
    match.activeSession().pickCard(match.activeSession().getSnapshot().hand[0]!);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    match.pass();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("lists each side's army where it stands, turned round for the other side", () => {
    const match = newMatch();
    const axis = armyOf(match.sessions.Axis);
    expect(axis).toHaveLength(1);
    expect(axis[0]!.unit.getUnitType()).toBe(UnitType.INFANTRY);
    // The Axis sees its own board turned round
    expect(turnedRound(axis[0]!.position)).toEqual({ row: 1, col: 3 });
    expect(armyOf(match.sessions.Allies).map((u) => u.position)).toEqual(
      expect.arrayContaining([{ row: 7, col: 1 }, { row: 8, col: 6 }])
    );
  });

  it("shows the other army where it stands, hiding its orders until they're revealed", () => {
    const match = newMatch();
    giveOrders(match);
    carryOut(match);
    finishTurn(match);

    // The Axis moves its infantry one hex, still in secret
    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(axis.getSnapshot().hand[0]!);
    const from = axis.getSnapshot().orderable[0]!;
    const to = { row: from.row, col: from.col - 1 }; // the next hex in the row
    expect(axis.issueOrder(from, to)).toBe(true);
    expect(axis.commitOrders()).toBe(true);

    expect(match.opponentOf("Allies")).toMatchObject({
      faction: "Axis",
      units: [{ position: from, unit: expect.anything(), figures: INFANTRY_FIGURES, retreats: 0, damaged: false }],
      orders: [],
    });

    giveOrders(match); // the Allies' orders: both are revealed
    expect(match.opponentOf("Allies").units[0]!.position).toEqual(to);
    expect(match.opponentOf("Allies").orders).toHaveLength(1);
    expect(match.opponentOf("Axis").orders).toHaveLength(2);

    carryOut(match);
    expect(match.opponentOf("Allies").orders).toHaveLength(1);
  });

  it("moves both armies at once, stopping and rolling the units that collide", () => {
    // Face to face in row 4 (the Allies' view): Allied infantry on (4,2), Axis infantry on (4,4)
    const close: Scenario = {
      ...scenario,
      units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 4 }] } },
    };
    const side = (faction: Faction) => new GameSession({ scenario: close, faction, initialHandSize: 2, commandCards: cards(), figures: true });
    const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });

    // The Axis' extra turn: its infantry heads 2 hexes west, into the Allied unit
    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(axis.getSnapshot().hand[0]!);
    expect(axis.issueOrder(turnedRound({ row: 4, col: 4 }), turnedRound({ row: 4, col: 2 }))).toBe(true);
    expect(axis.commitOrders()).toBe(true);
    expect(match.rollCollision(0)).toBe(false); // nothing has moved yet

    expect(match.moveUnits()).toBe(true);
    const movement = match.getSnapshot().movement!;
    expect(movement.done).toBe(false);
    expect(movement.collisions).toHaveLength(1);
    expect(movement.collisions[0]).toMatchObject({
      step: 2,
      kind: "standing",
      hex: { row: 4, col: 2 },
      rolled: false,
      applied: false,
      units: [
        { side: "Axis", order: 0, position: { row: 4, col: 3 }, unitType: UnitType.INFANTRY, roll: null },
        { side: "Allies", order: null, position: { row: 4, col: 2 }, unitType: UnitType.INFANTRY, roll: null },
      ],
    });
    // The Axis unit stopped short, on its own board too
    expect(axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 3 }));
    expect(match.finishReveal()).toBe(false); // the collision isn't rolled

    // Saved and restored mid-movement
    const restored = PassAndPlayMatch.restore(JSON.parse(JSON.stringify(match.save())), close, (saved) =>
      GameSession.restore(saved, close, cards())
    );
    expect(restored.getSnapshot().movement).toEqual(movement);

    expect(match.rollCollision(0)).toBe(true);
    expect(match.rollCollision(0)).toBe(false);
    const [axisUnit, alliedUnit] = match.getSnapshot().movement!.collisions[0]!.units;
    // Ordered 2 hexes, the Axis infantry couldn't have fired: it doesn't roll
    expect(axisUnit.roll).toBeNull();
    expect(axis.getSnapshot().shots).toHaveLength(0);
    // The Allied unit, without an order, rolls infantry's 3 close assault dice minus 1
    expect(alliedUnit.roll).toMatchObject({ dice: 2, collision: true, target: { infantry: true } });
    expect(match.sessions.Allies.getSnapshot().standingCollisions).toHaveLength(1);

    // Dealt at once: the Axis unit took the Allied hits and flags
    const { hits, retreats } = readRoll(alliedUnit.roll!.faces, alliedUnit.roll!.target);
    expect(match.getSnapshot().movement!.collisions[0]!.applied).toBe(true);
    // Without a flag the Axis unit goes back the hex it came from (bounceBack)
    const stays = retreats > 0 ? { row: 4, col: 3 } : { row: 4, col: 4 };
    expect(axis.getSnapshot().strength).toEqual([
      { position: turnedRound(stays), figures: INFANTRY_FIGURES - hits, retreats, damaged: false, hitThisTurn: hits },
    ]);
    expect(match.sessions.Allies.figuresAt({ row: 4, col: 2 })).toBe(INFANTRY_FIGURES);
    expect(match.finishReveal()).toBe(true);
  });

  describe("a collision without a flag", () => {
    // The Axis infantry moves 2 hexes west from (4,4), into the Allied infantry on (4,2)
    const collide = (face: number) => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 4 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, initialHandSize: 2, commandCards: cards(), figures: true, random: () => face / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      match.uncover();
      const axis = match.activeSession();
      axis.pickCard(axis.getSnapshot().hand[0]!);
      expect(axis.issueOrder(turnedRound({ row: 4, col: 4 }), turnedRound({ row: 4, col: 2 }))).toBe(true);
      expect(axis.commitOrders()).toBe(true);
      expect(match.moveUnits()).toBe(true);
      // It stopped on (4,3), next to the Allied unit
      expect(axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 3 }));
      expect(match.rollCollision(0)).toBe(true);
      return match;
    };

    it("sends the unit that moved one hex back the way it came; the standing one stays", () => {
      const match = collide(0); // hits only
      expect(match.sessions.Axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 4 }));
      expect(match.sessions.Axis.board.getHex(turnedRound({ row: 4, col: 4 }))?.unit).not.toBeNull();
      expect(match.sessions.Allies.board.getHex({ row: 4, col: 2 })?.unit).not.toBeNull();
      expect(match.getSnapshot().movement!.collisions[0]!.units[0].position).toEqual({ row: 4, col: 4 });
    });

    it("leaves the units where they stopped when a flag was rolled", () => {
      const match = collide(5); // flags
      expect(match.sessions.Axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 3 }));
    });
  });

  it("lets a unit with fewer figures than results pick the ones it applies", () => {
    const close: Scenario = {
      ...scenario,
      units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 4 }] } },
    };
    // Every die shows infantry: a hit on infantry
    const side = (faction: Faction) =>
      new GameSession({ scenario: close, faction, initialHandSize: 2, commandCards: cards(), figures: true, random: () => 0 });
    const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
    match.sessions.Allies.sufferHits({ row: 4, col: 2 }, INFANTRY_FIGURES - 1, 0); // 1 figure left

    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(axis.getSnapshot().hand[0]!);
    axis.issueOrder(turnedRound({ row: 4, col: 4 }), turnedRound({ row: 4, col: 2 }));
    axis.commitOrders();
    match.moveUnits();
    expect(match.rollCollision(0)).toBe(true);

    // 2 hits rolled, 1 figure: nothing is dealt until the player picks
    const allied = match.getSnapshot().movement!.collisions[0]!.units[1];
    expect(allied).toMatchObject({ limit: 1, mustChoose: true });
    expect(match.applyCollision(0)).toBe(false);
    expect(match.finishReveal()).toBe(false);

    expect(match.keepCollisionResults(0, 1, [0])).toBe(true);
    expect(match.getSnapshot().movement!.collisions[0]!.units[1].mustChoose).toBe(false);
    expect(match.applyCollision(0)).toBe(true);
    // No flag: the Axis unit went back the hex it came from
    expect(axis.figuresAt(turnedRound({ row: 4, col: 4 }))).toBe(INFANTRY_FIGURES - 1);
    expect(match.finishReveal()).toBe(true);
  });

  describe("the shared battle", () => {
    // In the Allies' view: Allied infantry (4,2) and tank (3,2), behind sandbags; Axis infantry (4,4) and tank (2,4)
    const front: Scenario = {
      ...scenario,
      units: {
        allies: { infantry: [{ row: 4, col: 2 }], tank: [{ row: 3, col: 2 }] },
        axis: { infantry: [{ row: 4, col: 4 }], tank: [{ row: 2, col: 4 }] },
      },
      sandbags: [{ row: 3, col: 2 }],
    };
    /** Every die shows `face` (0: infantry, 5: flag) */
    const battleMatch = (face = 0) => {
      const side = (faction: Faction) =>
        new GameSession({
          scenario: front,
          faction,
          initialHandSize: 2,
          commandCards: cards(),
          figures: true,
          random: () => face / 6,
        });
      return new PassAndPlayMatch(front, { Allies: side("Allies"), Axis: side("Axis") });
    };
    const allHold = (match: PassAndPlayMatch) => {
      giveOrders(match);
      expect(match.moveUnits()).toBe(true);
      expect(match.finishReveal()).toBe(true);
    };
    const axisView = (row: number, col: number) => turnedRound({ row, col });

    it("lets the side whose turn it is fire, dealing the hits to the enemy unit", () => {
      const match = battleMatch();
      allHold(match); // the Axis' extra turn: only the Axis can fire
      const battle = match.getSnapshot().battle!;
      expect(battle).toMatchObject({ side: "Axis", group: "unmoved", pending: null });
      expect(battle.fireable).toHaveLength(2);

      // Its targets are the enemy units only
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));
      const targets = axis.fireTargetsFor(infantry).map((t) => t.position);
      expect(targets).toContainEqual(axisView(4, 2));
      expect(targets.every((p) => axis.enemyAt(p) !== null)).toBe(true);

      expect(match.fire(infantry, axisView(4, 3))).toBe(false); // no enemy there
      expect(match.fire(infantry, axisView(4, 2))).toBe(true);
      // 2 dice at 2 hexes, both infantry: 2 hits on the Allied infantry
      expect(match.sessions.Allies.figuresAt({ row: 4, col: 2 })).toBe(INFANTRY_FIGURES - 2);
      expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", pending: null, fireable: [1 - infantry] });
      expect(match.fire(infantry, axisView(4, 2))).toBe(false); // it has fired

      expect(match.holdFire(1 - infantry)).toBe(true);
      expect(match.getSnapshot().battle).toMatchObject({ side: null, group: null, fireable: [] });
      expect(match.endBattle()).toBe(true);
      expect(match.sessions.Axis.getSnapshot().phase).toBe(TurnPhase.END_OF_TURN);
    });

    it("shows a shot's dice before it's rolled, as the shot rolls them", () => {
      const match = battleMatch();
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));

      expect(axis.aimAt(infantry, axisView(4, 3))).toBeNull(); // no enemy there
      const aim = axis.aimAt(infantry, axisView(4, 2))!;
      expect(aim).toMatchObject({ distance: 2, dice: 2, eightSided: false });
      expect(aim.enemy.unitType).toBe(UnitType.INFANTRY);

      expect(match.fire(infantry, axisView(4, 2))).toBe(true);
      expect(axis.getSnapshot().shots.at(-1)!.dice).toBe(aim.dice);
      expect(axis.aimAt(infantry, axisView(4, 2))).toBeNull(); // it has fired
    });

    it("records the hits a unit took this turn until its side's turn ends", () => {
      const match = battleMatch();
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));
      expect(match.fire(infantry, axisView(4, 2))).toBe(true); // 2 hits
      const hit = () => match.sessions.Allies.getSnapshot().strength.find((u) => samePosition(u.position, { row: 4, col: 2 }))!;
      expect(hit().hitThisTurn).toBe(2);
      expect(match.opponentOf("Axis").units.find((u) => u.unit.getUnitType() === UnitType.INFANTRY)).toMatchObject({ hitThisTurn: 2 });

      match.endBattle();
      finishTurn(match); // the Axis' extra turn ends; the Allies' turn 2 is still to come
      expect(hit().hitThisTurn).toBe(2);
      giveOrders(match);
      giveOrders(match);
      carryOut(match);
      finishTurn(match); // the Axis
      expect(hit().hitThisTurn).toBe(2);
      expect(match.pass()).toBe(true);
      finishTurn(match); // the Allies' turn 2 ends
      expect(hit().hitThisTurn).toBe(0);
      expect(hit().figures).toBe(INFANTRY_FIGURES - 2);
    });

    it("alternates the sides, the attacker first", () => {
      const match = battleMatch();
      allHold(match);
      match.endBattle();
      finishTurn(match);
      giveOrders(match); // the Axis' turn 2
      giveOrders(match); // the Allies'
      match.moveUnits();
      match.finishReveal();

      const order = () => match.getSnapshot().battle!.side;
      const fireFirst = () => {
        const battle = match.getSnapshot().battle!;
        expect(match.holdFire(battle.fireable[0]!)).toBe(true);
      };
      expect(order()).toBe("Axis");
      fireFirst();
      expect(order()).toBe("Allies");
      fireFirst();
      expect(order()).toBe("Axis");
      fireFirst();
      expect(order()).toBe("Allies");
      fireFirst();
      expect(order()).toBeNull();
    });

    it("waits for the player of a unit with fewer figures than results to pick them", () => {
      const match = battleMatch();
      match.sessions.Axis.sufferHits(axisView(4, 4), INFANTRY_FIGURES - 1, 0); // 1 figure left
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));

      expect(match.fire(infantry, axisView(4, 2))).toBe(true);
      expect(match.getSnapshot().battle!.pending).toMatchObject({ side: "Axis", limit: 1, mustChoose: true });
      expect(match.sessions.Allies.figuresAt({ row: 4, col: 2 })).toBe(INFANTRY_FIGURES); // nothing dealt yet
      expect(match.applyShot()).toBe(false);
      expect(match.endBattle()).toBe(false);
      expect(match.getSnapshot().battle).toMatchObject({ side: null, fireable: [] });

      expect(match.keepShotResults([1])).toBe(true);
      expect(match.applyShot()).toBe(true);
      expect(match.sessions.Allies.figuresAt({ row: 4, col: 2 })).toBe(INFANTRY_FIGURES - 1);
      expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", pending: null });
    });

    it("carries out the retreats after the firing, each hex picked by the unit's player", () => {
      const match = battleMatch(5); // flags
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));
      expect(match.fire(infantry, axisView(4, 2))).toBe(true); // 2 flags on the Allied infantry
      expect(match.getSnapshot().battle).toMatchObject({ ground: null, retreat: null, retreating: false });

      expect(match.endBattle()).toBe(true);
      const battle = match.getSnapshot().battle!;
      expect(battle).toMatchObject({ retreating: true, side: null, retreat: { side: "Allies", position: { row: 4, col: 2 }, flags: 2 } });
      expect(match.endBattle()).toBe(false);

      const first = battle.retreat!.options[0]!;
      expect(first.row).toBe(5);
      expect(match.retreat({ row: 0, col: 0 })).toBe(false);
      expect(match.retreat(first)).toBe(true);
      const second = match.getSnapshot().battle!.retreat!;
      expect(second).toMatchObject({ position: first, flags: 1 });
      expect(match.retreat(second.options[0]!)).toBe(true);

      // Nothing left to retreat: the final phase, behind the cover screen
      expect(match.getSnapshot()).toMatchObject({ battle: null, covered: true, active: "Axis" });
      expect(match.sessions.Allies.figuresAt({ row: 6, col: second.options[0]!.col })).toBe(INFANTRY_FIGURES);
    });

    it("lets armour take ground after a close assault: the enemy retreats at once and it fires again", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { tank: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, initialHandSize: 2, commandCards: cards(), figures: true, random: () => 5 / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);

      // The Axis tank's close assault: 3 flags on the Allied infantry
      expect(match.fire(0, axisView(4, 2))).toBe(true);
      expect(match.getSnapshot().battle).toMatchObject({ ground: { side: "Axis", order: 0 }, side: null });
      expect(match.endBattle()).toBe(false);

      expect(match.decideGround(true)).toBe(true);
      // The Allied infantry retreats its 3 hexes now
      for (let i = 0; i < 3; i++) {
        const retreat = match.getSnapshot().battle!.retreat!;
        expect(retreat.side).toBe("Allies");
        expect(match.retreat(retreat.options[0]!)).toBe(true);
      }
      // The tank moved in and fires once more, in close assault
      expect(match.sessions.Axis.board.getHex(axisView(4, 2))?.unit?.getUnitType()).toBe(UnitType.TANK);
      expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", fireable: [0], retreat: null });
      expect(match.holdFire(0)).toBe(true);
      expect(match.endBattle()).toBe(true);
      expect(match.getSnapshot().battle).toBeNull();
    });

    it("lets infantry that made the enemy retreat in close assault push it out now, without firing again", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, initialHandSize: 2, commandCards: cards(), figures: true, random: () => 5 / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);

      // The Axis infantry's close assault: all flags on the Allied infantry
      expect(match.fire(0, axisView(4, 2))).toBe(true);
      expect(match.getSnapshot().battle).toMatchObject({ ground: { side: "Axis", order: 0 } });
      expect(match.sessions.Axis.groundRuleFor(0)).toBe("pushBack");

      expect(match.decideGround(true)).toBe(true);
      for (let retreat = match.getSnapshot().battle!.retreat; retreat; retreat = match.getSnapshot().battle!.retreat) {
        expect(retreat.side).toBe("Allies");
        expect(match.retreat(retreat.options[0]!)).toBe(true);
      }
      // It moved in, and has no shot more
      expect(match.sessions.Axis.board.getHex(axisView(4, 2))?.unit?.getUnitType()).toBe(UnitType.INFANTRY);
      expect(match.sessions.Axis.orderSummaries()[0]).toMatchObject({ tookGround: true, shotsLeft: 0 });
      expect(match.getSnapshot().battle).toMatchObject({ side: null, fireable: [], retreat: null });
    });

    it("doesn't offer infantry ground when its close assault made nobody retreat", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, initialHandSize: 2, commandCards: cards(), figures: true, random: () => 0 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);
      expect(match.fire(0, axisView(4, 2))).toBe(true); // hits only
      expect(match.getSnapshot().battle).toMatchObject({ ground: null });
    });

    it("marks armour hit once: its next hit takes a figure", () => {
      const match = battleMatch();
      const allies = match.sessions.Allies;
      const tank = () => allies.getSnapshot().strength.find((u) => samePosition(u.position, { row: 3, col: 2 }))!;
      expect(tank()).toMatchObject({ figures: 3, damaged: false });
      allies.sufferHits({ row: 3, col: 2 }, 1, 0);
      expect(tank()).toMatchObject({ figures: 3, damaged: true });
      expect(match.opponentOf("Axis").units.find((u) => u.unit.getUnitType() === UnitType.TANK)).toMatchObject({ damaged: true });
      allies.sufferHits({ row: 3, col: 2 }, 1, 0);
      expect(tank()).toMatchObject({ figures: 2, damaged: false });
    });

    it("leaves the enemy marked when the unit doesn't take ground", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { tank: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, initialHandSize: 2, commandCards: cards(), figures: true, random: () => 5 / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);
      match.fire(0, axisView(4, 2));
      expect(match.decideGround(false)).toBe(true);
      expect(match.sessions.Allies.isRetreating({ row: 4, col: 2 })).toBe(true);
      expect(match.getSnapshot().battle).toMatchObject({ ground: null, retreat: null });
    });

    it("lets sandbags ignore a flag", () => {
      const match = battleMatch(5); // flags
      allHold(match);
      const axis = match.sessions.Axis;
      const tank = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(2, 4)));
      // The Axis tank fires at the Allied tank behind sandbags: 3 flags, 1 ignored
      expect(match.fire(tank, axisView(3, 2))).toBe(true);
      const shot = axis.getSnapshot().shots.at(-1)!;
      expect(shot.dice).toBeGreaterThan(1);
      expect(match.sessions.Allies.getSnapshot().strength.find((u) => samePosition(u.position, { row: 3, col: 2 }))).toEqual({
        position: { row: 3, col: 2 },
        figures: 3,
        retreats: shot.dice - 1,
        damaged: false,
        hitThisTurn: 0,
      });
    });
  });

  it("refuses sessions of the wrong side", () => {
    expect(() => new PassAndPlayMatch(scenario, { Allies: newSession("Axis"), Axis: newSession("Axis") })).toThrow();
  });

  it("saves and restores both sides and the turn revealed, behind the cover screen", () => {
    const match = newMatch();
    giveOrders(match);
    carryOut(match);
    finishTurn(match);
    giveOrders(match);
    giveOrders(match);
    carryOut(match);
    match.uncover();

    const saved = JSON.parse(JSON.stringify(match.save()));
    const restored = PassAndPlayMatch.restore(saved, scenario, restoreSide);

    expect(restored.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    for (const side of ["Allies", "Axis"] as const) {
      expect(restored.sessions[side].getSnapshot()).toMatchObject({ phase: TurnPhase.END_OF_TURN, turn: 2 });
    }
    expect(otherSide(restored.getSnapshot().active)).toBe("Allies");
  });

  it("keeps the main side the map is seen from, the attacker's by default", () => {
    expect(newMatch().mainSide).toBe("Axis");
    const match = new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") }, { mainSide: "Allies" });
    const restored = PassAndPlayMatch.restore(JSON.parse(JSON.stringify(match.save())), scenario, restoreSide);
    expect(restored.mainSide).toBe("Allies");
    const { mainSide: _, ...older } = match.save();
    expect(PassAndPlayMatch.restore(older, scenario, restoreSide).mainSide).toBe("Axis");
  });

  it("drops a save of another version", () => {
    const saved = { ...newMatch().save(), version: 0 };
    expect(() => PassAndPlayMatch.restore(saved as never, scenario, restoreSide)).toThrow();
  });
});

describe("sections in pass and play", () => {
  it("follow the main side's left and right for both sides", () => {
    // Allies at the device: a hex on the Allies' left is the left for the Axis too
    const match = new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") }, { mainSide: "Allies" });
    const alliesLeft = { row: 4, col: 0 };
    const hex = (side: Faction, position: { row: number; col: number }) =>
      match.sessions[side].board.getHex(position)!;
    expect(hex("Allies", alliesLeft).getSide()).toBe(Side.LEFT);
    expect(hex("Axis", turnedRound(alliesLeft)).getSide()).toBe(Side.LEFT);
    expect(hex("Axis", turnedRound({ row: 3, col: 8 })).getSide()).toBe(Side.RIGHT_CENTER);
  });

  it("keep the main side's own sections", () => {
    const match = new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") }, { mainSide: "Axis" });
    expect(match.sessions.Axis.board.getHex({ row: 4, col: 0 })!.getSide()).toBe(Side.LEFT);
    expect(match.sessions.Allies.board.getHex({ row: 4, col: 0 })!.getSide()).toBe(Side.RIGHT);
  });
});
