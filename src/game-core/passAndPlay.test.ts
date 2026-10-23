import { describe, expect, it, vi } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch, { armyOf, otherSide } from "./passAndPlay";
import { SavedGame } from "./saveGame";
import { UnitType } from "./unit";
import { FIGURES } from "../data/figures";
import { turnedRound } from "./BoardManager";
import { STANDARD_BOARD } from "./boardSize";
import { readRoll } from "./rollResult";
import { Faction } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Scenario } from "../types/scenario";
import { same } from "../i18n/lang";
import { samePosition } from "./position";

const INFANTRY_FIGURES = FIGURES[UnitType.INFANTRY].figures;

// Axis attacks: it fires first, and the Allies start a shot short
const scenario: Scenario = {
  id: "test",
  name: same("Test"),
  description: same(""),
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 7, col: 1 }], tank: [{ row: 8, col: 6 }] },
    axis: { infantry: [{ row: 1, col: 3 }] },
  },
};

const newSession = (faction: Faction) => new GameSession({ scenario, faction, figures: true });

const restoreSide = (saved: SavedGame) => GameSession.restore(saved, scenario);

const newMatch = () => new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") });

/** The side holding the device picks no card and gives hold orders to every unit, then locks them */
const giveOrders = (match: PassAndPlayMatch) => {
  match.uncover();
  const session = match.activeSession();
  expect(session.pickCard(null)).toBe(true);
  while (session.getSnapshot().orderable.length > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
};

/** The side holding the device picks no card and gives no orders (its units rest), then locks them */
const restAll = (match: PassAndPlayMatch) => {
  match.uncover();
  const session = match.activeSession();
  expect(session.pickCard(null)).toBe(true);
  expect(session.commitOrders()).toBe(true);
};

/** The reveal: the units move, every collision is rolled, then a battle where nobody fires */
const carryOut = (match: PassAndPlayMatch) => {
  expect(match.moveUnits()).toBe(true);
  match.getSnapshot().movement!.collisions.forEach((_, i) => expect(match.rollCollision(i)).toBe(true));
  expect(match.finishReveal()).toBe(true);
  expect(match.endBattle()).toBe(true);
};

describe("PassAndPlayMatch", () => {
  it("starts with the attacker, behind the cover screen, both sides picking their cards", () => {
    const match = newMatch();
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    expect(match.activeSession().faction).toBe("Axis");
    expect(match.sessions.Axis.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
    expect(match.sessions.Allies.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
  });

  it("uncovers for the player holding the device, and covers again when it's passed", () => {
    const match = newMatch();

    expect(match.pass()).toBe(false); // nobody has shown their side yet
    expect(match.uncover()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: false });
    expect(match.uncover()).toBe(false);
    expect(match.pass()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true });
    expect(match.activeSession().faction).toBe("Allies");
  });

  it("hands the device over when a side locks its orders, then reveals both", () => {
    const match = newMatch();
    giveOrders(match); // the Axis' turn 1
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true, revealTurn: null });

    giveOrders(match); // the Allies'
    expect(match.getSnapshot()).toMatchObject({ revealTurn: 1 });
    expect(match.pass()).toBe(false);
    expect(match.uncover()).toBe(false);
    expect(match.finishReveal()).toBe(false); // the units haven't moved yet

    expect(match.moveUnits()).toBe(true);
    expect(match.moveUnits()).toBe(false);
    expect(match.getSnapshot().movement).toEqual({ turn: 1, collisions: [], done: true });
    expect(match.finishReveal()).toBe(true);
    // The battle, on one screen: nobody fires (hold orders but no enemy in range)
    expect(match.getSnapshot()).toMatchObject({ covered: false, revealTurn: null, movement: null, battle: { turn: 1 } });
    expect(match.finishReveal()).toBe(false);
    expect(match.pass()).toBe(false);
    expect(match.endBattle()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, battle: null });
  });

  describe("after the battle", () => {
    const FROM = { row: 7, col: 1 };
    const TO = { row: 6, col: 1 };
    /** The Axis holds; the Allied infantry goes Behind Enemy Lines; nobody fires */
    const behindLines = () => {
      const match = newMatch();
      giveOrders(match);
      match.uncover();
      const allies = match.sessions.Allies;
      expect(allies.pickCard(null)).toBe(true);
      expect(allies.giveAction(FROM, "infantry:behindEnemyLines", TO)).toBe(true);
      expect(allies.commitOrders()).toBe(true);
      expect(match.moveUnits()).toBe(true);
      expect(match.finishReveal()).toBe(true);
      for (let battle = match.getSnapshot().battle!; battle.side; battle = match.getSnapshot().battle!) {
        expect(match.holdFire(battle.fireable[0]!)).toBe(true);
      }
      expect(match.endBattle()).toBe(true);
      return match;
    };

    it("moves the Behind Enemy Lines unit on the battle screen, then starts the next turn", () => {
      const match = behindLines();
      const due = match.getSnapshot().battle!.afterBattle!;
      expect(due).toMatchObject({ side: "Allies", kind: "move", from: TO });
      expect(match.endBattle()).toBe(false); // the move comes first
      expect(match.moveAfterBattle(TO)).toBe(false); // it has to go somewhere

      const to = due.options.find((option) => option.row === 4)!;
      expect(match.moveAfterBattle(to)).toBe(true);
      expect(match.getSnapshot().battle).toBeNull();
      expect(match.sessions.Allies.board.getHex(to)?.unit?.getUnitType()).toBe(UnitType.INFANTRY);
      for (const side of ["Allies", "Axis"] as const) {
        expect(match.sessions[side].getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
      }
    });

    it("lets the unit stay where it is instead", () => {
      const match = behindLines();
      expect(match.skipMoveAfterBattle()).toBe(true);
      expect(match.getSnapshot().battle).toBeNull();
      expect(match.sessions.Allies.board.getHex(TO)?.unit?.getUnitType()).toBe(UnitType.INFANTRY);
      expect(match.sessions.Allies.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
      expect(match.sessions.Allies.getSnapshot().log.at(-1)!.battleEdits).toEqual([]);
    });
  });

  it("starts the next turn for both sides once the battle ends: there's no final phase", () => {
    const match = newMatch();
    giveOrders(match);
    giveOrders(match);
    carryOut(match);

    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, battle: null });
    for (const side of ["Allies", "Axis"] as const) {
      expect(match.sessions[side].getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
    }
  });

  it("tells listeners about its own changes and either side's", () => {
    const match = newMatch();
    const listener = vi.fn();
    const unsubscribe = match.subscribe(listener);

    match.uncover();
    expect(listener).toHaveBeenCalledTimes(1);
    match.activeSession().pickCard(null);
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
    expect(turnedRound(axis[0]!.position, STANDARD_BOARD)).toEqual({ row: 1, col: 3 });
    expect(armyOf(match.sessions.Allies).map((u) => u.position)).toEqual(
      expect.arrayContaining([{ row: 7, col: 1 }, { row: 8, col: 6 }])
    );
  });

  it("shows the other army where it stands, hiding its orders until they're revealed", () => {
    const match = newMatch();

    // The Axis moves its infantry one hex, still in secret
    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(null);
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
    expect(match.opponentOf("Allies").orders).toHaveLength(0); // the next turn has begun
  });

  it("moves both armies at once, stopping and rolling the units that collide", () => {
    // Face to face in row 4 (the Allies' view): Allied infantry on (4,2), Axis infantry on (4,4)
    const close: Scenario = {
      ...scenario,
      units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 4 }] } },
    };
    const side = (faction: Faction) => new GameSession({ scenario: close, faction, figures: true });
    const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });

    // The Axis infantry heads 2 hexes west, into the Allied unit, which rests
    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(null);
    expect(axis.issueOrder(turnedRound({ row: 4, col: 4 }, STANDARD_BOARD), turnedRound({ row: 4, col: 2 }, STANDARD_BOARD))).toBe(true);
    expect(axis.commitOrders()).toBe(true);
    restAll(match);
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
    expect(axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 3 }, STANDARD_BOARD));
    expect(match.finishReveal()).toBe(false); // the collision isn't rolled

    // Saved and restored mid-movement
    const restored = PassAndPlayMatch.restore(JSON.parse(JSON.stringify(match.save())), close, (saved) =>
      GameSession.restore(saved, close)
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
    // Its first flag pins it; each flag after that is a hex it retreats as the battle starts
    expect(axis.getSnapshot().strength).toEqual([
      {
        position: turnedRound(stays, STANDARD_BOARD),
        figures: INFANTRY_FIGURES - hits,
        pinned: retreats > 0,
        retreats: Math.max(0, retreats - 1),
        damaged: false,
        hitThisTurn: hits,
      },
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
        new GameSession({ scenario: close, faction, figures: true, random: () => face / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      match.uncover();
      const axis = match.activeSession();
      axis.pickCard(null);
      expect(axis.issueOrder(turnedRound({ row: 4, col: 4 }, STANDARD_BOARD), turnedRound({ row: 4, col: 2 }, STANDARD_BOARD))).toBe(true);
      expect(axis.commitOrders()).toBe(true);
      restAll(match);
      expect(match.moveUnits()).toBe(true);
      // It stopped on (4,3), next to the Allied unit
      expect(axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 3 }, STANDARD_BOARD));
      expect(match.rollCollision(0)).toBe(true);
      return match;
    };

    it("sends the unit that moved one hex back the way it came; the standing one stays", () => {
      const match = collide(0); // hits only
      expect(match.sessions.Axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 4 }, STANDARD_BOARD));
      expect(match.sessions.Axis.board.getHex(turnedRound({ row: 4, col: 4 }, STANDARD_BOARD))?.unit).not.toBeNull();
      expect(match.sessions.Allies.board.getHex({ row: 4, col: 2 })?.unit).not.toBeNull();
      expect(match.getSnapshot().movement!.collisions[0]!.units[0].position).toEqual({ row: 4, col: 4 });
    });

    it("leaves the units where they stopped when a flag was rolled", () => {
      const match = collide(5); // flags
      expect(match.sessions.Axis.getSnapshot().orders[0]!.end).toEqual(turnedRound({ row: 4, col: 3 }, STANDARD_BOARD));
    });
  });

  it("deals no more hits than the unit has figures, at once", () => {
    const close: Scenario = {
      ...scenario,
      units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 4 }] } },
    };
    // Every die shows infantry: a hit on infantry
    const side = (faction: Faction) =>
      new GameSession({ scenario: close, faction, figures: true, random: () => 0 });
    const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
    match.sessions.Allies.sufferHits({ row: 4, col: 2 }, INFANTRY_FIGURES - 1, 0); // 1 figure left

    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(null);
    axis.issueOrder(turnedRound({ row: 4, col: 4 }, STANDARD_BOARD), turnedRound({ row: 4, col: 2 }, STANDARD_BOARD));
    axis.commitOrders();
    restAll(match);
    match.moveUnits();
    expect(match.rollCollision(0)).toBe(true);

    // 2 hits rolled, 1 figure: 1 hit dealt, the other die set aside
    const allied = match.getSnapshot().movement!.collisions[0]!.units[1];
    expect(allied.roll).toMatchObject({ dice: 2, kept: [0] });
    expect(match.getSnapshot().movement!.collisions[0]!.applied).toBe(true);
    // No flag: the Axis unit went back the hex it came from
    expect(axis.figuresAt(turnedRound({ row: 4, col: 4 }, STANDARD_BOARD))).toBe(INFANTRY_FIGURES - 1);
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
          figures: true,
          random: () => face / 6,
        });
      return new PassAndPlayMatch(front, { Allies: side("Allies"), Axis: side("Axis") });
    };
    /** The Axis holds and the Allies rest: only the Axis fires */
    const allHold = (match: PassAndPlayMatch) => {
      giveOrders(match);
      restAll(match);
      expect(match.moveUnits()).toBe(true);
      expect(match.finishReveal()).toBe(true);
    };
    const axisView = (row: number, col: number) => turnedRound({ row, col }, STANDARD_BOARD);

    it("lets the side whose turn it is fire, dealing the hits to the enemy unit", () => {
      const match = battleMatch();
      allHold(match); // the Allies rest: only the Axis can fire
      const battle = match.getSnapshot().battle!;
      expect(battle).toMatchObject({ side: "Axis", group: "unmoved" });
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
      expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", fireable: [1 - infantry] });
      expect(match.fire(infantry, axisView(4, 2))).toBe(false); // it has fired
      // The other side sees which of its units fired
      expect(match.opponentOf("Allies").fired).toEqual([axis.getSnapshot().orders[infantry]!.unit]);

      expect(match.stillToFire("Axis")).toEqual([1 - infantry]);

      expect(match.holdFire(1 - infantry)).toBe(true);
      // A unit that held its fire keeps its shot, but isn't still to fire
      expect(match.stillToFire("Axis")).toEqual([]);
      expect(match.getSnapshot().battle).toMatchObject({ side: null, group: null, fireable: [] });
      expect(match.endBattle()).toBe(true);
      expect(match.sessions.Axis.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
    });

    it("lets a unit with an enemy next to it fire in close assault only", () => {
      // In the Allies' view: Allied infantry (4,3) next to the Axis infantry (4,4), the Allied tank 2 hexes away
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 3 }], tank: [{ row: 2, col: 4 }] }, axis: { infantry: [{ row: 4, col: 4 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, figures: true });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);

      const axis = match.sessions.Axis;
      expect(axis.fireTargetsFor(0).map((t) => t.position)).toEqual([axisView(4, 3)]);
      expect(axis.aimAt(0, axisView(2, 4))).toBeNull();
      expect(axis.aimAt(0, axisView(4, 3))).toMatchObject({ distance: 1 });
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

    it("records the hits a unit took this turn until the turn ends", () => {
      const match = battleMatch();
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));
      expect(match.fire(infantry, axisView(4, 2))).toBe(true); // 2 hits
      const hit = () => match.sessions.Allies.getSnapshot().strength.find((u) => samePosition(u.position, { row: 4, col: 2 }))!;
      expect(hit().hitThisTurn).toBe(2);
      expect(match.opponentOf("Axis").units.find((u) => u.unit.getUnitType() === UnitType.INFANTRY)).toMatchObject({ hitThisTurn: 2 });

      expect(match.endBattle()).toBe(true); // both sides' turn ends
      expect(hit().hitThisTurn).toBe(0);
      expect(hit().figures).toBe(INFANTRY_FIGURES - 2);
    });

    it("doesn't carry a turn's flags into the next", () => {
      const match = battleMatch(5); // flags
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));
      expect(match.fire(infantry, axisView(4, 2))).toBe(true); // 2 flags: pinned, then 1 hex back
      const allies = match.sessions.Allies;
      const flagged = () => allies.getSnapshot().strength.find((u) => u.pinned);
      expect(flagged()).toBeDefined();

      while (match.getSnapshot().battle!.retreat) {
        expect(match.retreat(match.getSnapshot().battle!.retreat!.options[0]!)).toBe(true);
      }
      match.holdFire(match.getSnapshot().battle!.fireable[0]!);
      expect(match.endBattle()).toBe(true);
      expect(allies.getSnapshot()).toMatchObject({ turn: 2, phase: TurnPhase.PICK_CARDS });
      expect(flagged()).toBeUndefined();
      expect(allies.getSnapshot().strength.every((u) => u.retreats === 0 && u.hitThisTurn === 0)).toBe(true);
    });

    it("alternates the sides, the attacker first", () => {
      const match = battleMatch();
      giveOrders(match); // the Axis'
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

    it("cuts a unit's hits down to its figures", () => {
      const match = battleMatch();
      match.sessions.Axis.sufferHits(axisView(4, 4), INFANTRY_FIGURES - 1, 0); // 1 figure left
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));

      expect(match.fire(infantry, axisView(4, 2))).toBe(true);
      expect(axis.getSnapshot().shots.at(-1)!.kept).toEqual([0]);
      expect(match.sessions.Allies.figuresAt({ row: 4, col: 2 })).toBe(INFANTRY_FIGURES - 1);
      expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", fireable: [1 - infantry] });
    });

    it("rolls a pinned infantry unit's shots with a die less; armour ignores the pin", () => {
      const match = battleMatch();
      const axis = match.sessions.Axis;
      axis.sufferHits(axisView(4, 4), 0, 1);
      axis.sufferHits(axisView(2, 4), 0, 1);
      allHold(match);
      const order = (row: number, col: number) => axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(row, col)));
      const aim = axis.aimAt(order(4, 4), axisView(4, 2))!;
      expect(aim.dice).toBe(1);
      expect(aim.steps.some((step) => step.kind === "pinned")).toBe(true);
      expect(axis.aimAt(order(2, 4), axisView(3, 2))!.steps.some((step) => step.kind === "pinned")).toBe(false);
    });

    it("pins a unit with its first flag, and makes it retreat at once for each flag after it", () => {
      const match = battleMatch(5); // flags
      allHold(match);
      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));
      expect(match.fire(infantry, axisView(4, 2))).toBe(true); // 2 flags on the Allied infantry: pinned, and 1 hex

      const battle = match.getSnapshot().battle!;
      expect(battle).toMatchObject({ side: null, retreat: { side: "Allies", position: { row: 4, col: 2 }, flags: 1 } });
      expect(match.endBattle()).toBe(false);
      expect(match.holdFire(1 - infantry)).toBe(false); // nobody fires while it retreats

      const to = battle.retreat!.options[0]!;
      expect(to.row).toBe(5);
      expect(match.retreat({ row: 0, col: 0 })).toBe(false);
      expect(match.retreat(to)).toBe(true);
      expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", retreat: null });
      const allies = match.sessions.Allies;
      expect(allies.getSnapshot().strength.find((u) => samePosition(u.position, to))).toMatchObject({ pinned: true, retreats: 0 });
      expect(allies.hasRetreated(to)).toBe(true);

      expect(match.holdFire(1 - infantry)).toBe(true);
      expect(match.endBattle()).toBe(true);
      expect(match.getSnapshot()).toMatchObject({ battle: null, covered: true, active: "Axis" });
    });

    it("keeps a unit that retreated out of the rest of the battle: its old hex can't fire", () => {
      const match = battleMatch(5); // flags
      giveOrders(match); // the Axis'
      giveOrders(match); // the Allies'
      match.moveUnits();
      match.finishReveal();

      const axis = match.sessions.Axis;
      const infantry = axis.getSnapshot().orders.findIndex((o) => samePosition(o.end, axisView(4, 4)));
      expect(match.fire(infantry, axisView(4, 2))).toBe(true);
      const retreat = match.getSnapshot().battle!.retreat!;
      expect(match.retreat(retreat.options[0]!)).toBe(true);

      // The Allied infantry's order still ends on (4,2), but it's out of the battle
      const allies = match.sessions.Allies;
      const own = allies.getSnapshot().orders.findIndex((o) => samePosition(o.end, { row: 4, col: 2 }));
      expect(allies.orderSummaries()[own]!.shotsLeft).toBe(0);
      expect(match.getSnapshot().battle!.fireable).not.toContain(own);
    });

    it("lets armour take ground after a close assault: the enemy retreats at once, then it moves in and fires again", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { tank: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, figures: true, random: () => 5 / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);

      // The Axis tank's close assault: 4 flags on the Allied infantry (+1 die: it held), pinned and 3 hexes back
      expect(match.fire(0, axisView(4, 2))).toBe(true);
      expect(match.getSnapshot().battle).toMatchObject({ ground: null });
      for (let i = 0; i < 3; i++) {
        const retreat = match.getSnapshot().battle!.retreat!;
        expect(retreat.side).toBe("Allies");
        expect(match.retreat(retreat.options[0]!)).toBe(true);
      }
      expect(match.getSnapshot().battle).toMatchObject({ ground: { side: "Axis", order: 0 }, side: null });
      expect(match.endBattle()).toBe(false);

      expect(match.decideGround(true)).toBe(true);
      // The tank moved in and fires once more, in close assault
      expect(match.sessions.Axis.board.getHex(axisView(4, 2))?.unit?.getUnitType()).toBe(UnitType.TANK);
      expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", fireable: [0], retreat: null });
      expect(match.holdFire(0)).toBe(true);
      expect(match.endBattle()).toBe(true);
      expect(match.getSnapshot().battle).toBeNull();
    });

    it("fires the way the unit picks, spending its ammo", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) => new GameSession({ scenario: close, faction, figures: true, random: () => 0.5 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);

      const axis = match.sessions.Axis;
      expect(match.fire(0, axisView(4, 2), "tank:normal")).toBe(false);
      expect(match.fire(0, axisView(4, 2), "infantry:suppressive")).toBe(true);
      expect(axis.getSnapshot().shots[0]).toMatchObject({ option: "infantry:suppressive", target: { die: "suppressive" } });
      const supplies = axis.getSnapshot().supplies.find((each) => samePosition(each.position, axisView(4, 3)))!.supplies;
      expect(supplies.amounts.ammo).toBe(1);
    });

    it("lets infantry move into the hex its close assault made the enemy leave, without firing again", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, figures: true, random: () => 5 / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);

      // The Axis infantry's close assault: all flags on the Allied infantry
      expect(match.fire(0, axisView(4, 2))).toBe(true);
      for (let retreat = match.getSnapshot().battle!.retreat; retreat; retreat = match.getSnapshot().battle!.retreat) {
        expect(retreat.side).toBe("Allies");
        expect(match.retreat(retreat.options[0]!)).toBe(true);
      }
      expect(match.getSnapshot().battle).toMatchObject({ ground: { side: "Axis", order: 0 } });
      expect(match.sessions.Axis.groundRuleFor(0)).toBe("pushBack");

      expect(match.decideGround(true)).toBe(true);
      // It moved in, and has no shot more
      expect(match.sessions.Axis.board.getHex(axisView(4, 2))?.unit?.getUnitType()).toBe(UnitType.INFANTRY);
      expect(match.sessions.Axis.orderSummaries()[0]).toMatchObject({ tookGround: true, shotsLeft: 0 });
      expect(match.getSnapshot().battle).toMatchObject({ side: null, fireable: [], retreat: null });
    });

    it("only pins the target of a close assault with a single flag: no ground to take", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 3 }] } },
      };
      // Dealing shuffles with 0; then the Axis close assault rolls a flag and two infantry
      let faces: number[] = [];
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, figures: true, random: () => faces.shift() ?? 0 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);
      faces = [5 / 6, 0, 0];
      expect(match.fire(0, axisView(4, 2))).toBe(true);
      expect(match.sessions.Allies.getSnapshot().strength[0]).toMatchObject({ figures: INFANTRY_FIGURES - 2, pinned: true, retreats: 0 });
      expect(match.getSnapshot().battle).toMatchObject({ ground: null, retreat: null });
    });

    it("doesn't offer infantry ground when its close assault made nobody retreat", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, figures: true, random: () => 0 });
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

    it("leaves the hex empty when the unit doesn't take ground", () => {
      const close: Scenario = {
        ...scenario,
        units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { tank: [{ row: 4, col: 3 }] } },
      };
      const side = (faction: Faction) =>
        new GameSession({ scenario: close, faction, figures: true, random: () => 5 / 6 });
      const match = new PassAndPlayMatch(close, { Allies: side("Allies"), Axis: side("Axis") });
      allHold(match);
      match.fire(0, axisView(4, 2));
      for (let retreat = match.getSnapshot().battle!.retreat; retreat; retreat = match.getSnapshot().battle!.retreat) {
        expect(match.retreat(retreat.options[0]!)).toBe(true);
      }
      expect(match.decideGround(false)).toBe(true);
      expect(match.sessions.Axis.board.getHex(axisView(4, 3))?.unit?.getUnitType()).toBe(UnitType.TANK);
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
        pinned: true,
        retreats: shot.dice - 2,
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
    giveOrders(match);
    carryOut(match);
    match.uncover();

    const saved = JSON.parse(JSON.stringify(match.save()));
    const restored = PassAndPlayMatch.restore(saved, scenario, restoreSide);

    expect(restored.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    for (const side of ["Allies", "Axis"] as const) {
      expect(restored.sessions[side].getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
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

describe("a match against the computer", () => {
  // The person plays the Allies, the defender; the computer the Axis
  const newComputerMatch = () =>
    new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") }, { computer: "Axis" });

  /** No card and hold orders for every unit of a side, given straight on its session */
  const holdAll = (session: GameSession) => {
    expect(session.pickCard(null)).toBe(true);
    while (session.getSnapshot().orderable.length > 0) {
      const position = session.getSnapshot().orderable[0]!;
      expect(session.issueOrder(position, position)).toBe(true);
    }
    expect(session.commitOrders()).toBe(true);
  };

  const endTurn = (session: GameSession) => {
    expect(session.endTurn()).toBe(true);
  };

  it("keeps the device with the person, with no cover screen, seen from their side", () => {
    const match = newComputerMatch();
    expect(match.computer).toBe("Axis");
    expect(match.mainSide).toBe("Allies");
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: false, canPass: false });
    expect(match.uncover()).toBe(false);
    expect(match.pass()).toBe(false);
  });

  it("reveals once both sides have locked their orders", () => {
    const match = newComputerMatch();
    const { Allies: person, Axis: computer } = match.sessions;

    holdAll(person);
    // Locking the person's orders hands nothing over: the computer hasn't given its own yet
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: false, revealTurn: null });
    holdAll(computer);
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: false, revealTurn: 1 });

    expect(match.moveUnits()).toBe(true);
    expect(match.finishReveal()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: false, battle: { turn: 1 } });
    expect(match.endBattle()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: false, battle: null });
    expect(person.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
  });

  it("saves and restores the computer's side, without the cover screen", () => {
    const match = newComputerMatch();
    holdAll(match.sessions.Axis);
    holdAll(match.sessions.Allies);

    const restored = PassAndPlayMatch.restore(JSON.parse(JSON.stringify(match.save())), scenario, restoreSide);

    expect(restored.computer).toBe("Axis");
    expect(restored.mainSide).toBe("Allies");
    expect(restored.getSnapshot()).toMatchObject({ active: "Allies", covered: false, revealTurn: 1 });
    expect(PassAndPlayMatch.restore(JSON.parse(JSON.stringify(newMatch().save())), scenario, restoreSide).computer).toBeNull();
  });
});

describe("winning a match", () => {
  // The Allies' infantry starts on its own objective; the Axis infantry on the Axis'
  const withVictory = (victory: Scenario["victory"]): Scenario => ({ ...scenario, victory });
  const matchOn = (map: Scenario) => {
    const side = (faction: Faction) =>
      new GameSession({ scenario: map, faction, figures: true });
    return new PassAndPlayMatch(map, { Allies: side("Allies"), Axis: side("Axis") });
  };
  const allied = { faction: "Allies" as const, name: same("Hill"), hexes: [{ row: 7, col: 1 }] };
  const german = { faction: "Axis" as const, name: same("Wood"), hexes: [{ row: 1, col: 3 }] };

  it("has no victory without the scenario's conditions", () => {
    const match = newMatch();
    giveOrders(match);
    giveOrders(match);
    carryOut(match);
    expect(match.getSnapshot()).toMatchObject({ victory: null, result: null });
  });

  it("is won at the end of a turn by the side that holds enough objectives", () => {
    const map = withVictory({ medals: 1, objectives: [allied] });
    const match = matchOn(map);
    expect(match.getSnapshot().victory).toMatchObject({ medals: 1, held: { Allies: [], Axis: [] } });
    giveOrders(match);
    giveOrders(match);
    carryOut(match);

    const { result, victory } = match.getSnapshot();
    expect(victory!.held.Allies).toEqual([{ row: 7, col: 1 }]);
    expect(result).toMatchObject({ winner: "Allies", turn: 1, wipedOut: false });
    expect(result!.medals.Allies).toEqual({ destroyed: 0, objectives: 1, total: 1 });

    const restored = PassAndPlayMatch.restore(JSON.parse(JSON.stringify(match.save())), map, (saved) =>
      GameSession.restore(saved, map)
    );
    expect(restored.getSnapshot().result).toEqual(result);
  });

  it("goes on while both sides have as many medals", () => {
    const match = matchOn(withVictory({ medals: 1, objectives: [allied, german] }));
    giveOrders(match);
    giveOrders(match);
    carryOut(match);
    expect(match.getSnapshot().result).toBeNull();
    expect(match.getSnapshot().victory!.standing.Axis.total).toBe(1);
  });
});


describe("PassAndPlayMatch keeps each side's supplies and luck its own", () => {
  it("gives the other side the enemy units' places and kind, never their supplies, changes or luck", () => {
    const match = new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") });
    const seen = match.opponentOf("Allies", { fogged: false });
    expect(seen.units.length).toBeGreaterThan(0);
    for (const unit of seen.units) {
      expect(unit).not.toHaveProperty("supplies");
      expect(unit).not.toHaveProperty("luck");
      expect(unit).not.toHaveProperty("change");
    }
    // Each side's snapshot lists only its own units' supplies
    for (const side of ["Allies", "Axis"] as const) {
      const own = match.sessions[side].board.getAllHexes().filter((hex) => hex.unit).length;
      expect(match.sessions[side].getSnapshot().supplies).toHaveLength(own);
    }
  });
});
