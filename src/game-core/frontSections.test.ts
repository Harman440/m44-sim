import { describe, expect, it } from "vitest";
import { frontLayout } from "./frontSections";
import BoardManager, { turnedRound } from "./BoardManager";
import GameSession from "./gameSession";
import CommandCard from "./commandCard";
import { STANDARD_BOARD } from "./boardSize";
import { Side } from "../types/hex";
import { Position, Scenario } from "../types/scenario";
import { TurnPhase } from "../types/gameManager";
import { same } from "../i18n/lang";
import { allCombatCards } from "../data/combatCards";

const scenario = (allies: Position[], cols = STANDARD_BOARD.cols): Scenario => ({
  id: "front",
  name: same("Front"),
  description: same(""),
  initialHandSize: { allies: 4, axis: 4 },
  attacker: "Allies",
  tiles: {},
  units: { allies: { infantry: allies }, axis: { infantry: [{ row: 0, col: 0 }] } },
  ...(cols !== STANDARD_BOARD.cols && { board: { cols, rows: 9 } }),
});

const session = (map: Scenario) =>
  new GameSession({ scenario: map, faction: "Allies", initialHandSize: 4, commandCards: [], sectionOrders: true, figures: true });

describe("the sections variant's sections", () => {
  it("splits the standard board in two sections of 7, sharing the middle column", () => {
    const layout = frontLayout(13);
    expect(layout.sections).toEqual([Side.LEFT, Side.RIGHT]);
    expect(layout.lines).toEqual([6]);
    expect(layout.hexes).toEqual({ [Side.LEFT]: 7, [Side.RIGHT]: 7 });
  });

  it("makes the sections bigger on a wider board", () => {
    expect(frontLayout(15).hexes).toEqual({ [Side.LEFT]: 8, [Side.RIGHT]: 8 });
  });

  it("runs the line through the short rows on a board with an even width", () => {
    const layout = frontLayout(14);
    expect(layout.lines).toEqual([6.5]);
    expect(layout.hexes).toEqual({ [Side.LEFT]: 7, [Side.RIGHT]: 7 });
  });

  it("has three sections once each can have 7 hexes", () => {
    expect(frontLayout(18).sections).toHaveLength(2);
    expect(frontLayout(19)).toEqual({
      sections: [Side.LEFT, Side.CENTER, Side.RIGHT],
      lines: [6, 12],
      hexes: { [Side.LEFT]: 7, [Side.CENTER]: 7, [Side.RIGHT]: 7 },
    });
    for (const cols of [19, 20, 21]) {
      const { hexes } = frontLayout(cols);
      expect(Math.min(...Object.values(hexes))).toBeGreaterThanOrEqual(7);
    }
  });

  it("puts the middle column of the long rows in both sections, and splits the short rows", () => {
    const board = new BoardManager(scenario([]));
    board.useFrontSections();
    const sections = (row: number, col: number) => board.getHex({ row, col })!.getSections();
    expect(sections(0, 6)).toEqual([Side.LEFT, Side.RIGHT]);
    expect(sections(0, 5)).toEqual([Side.LEFT]);
    expect(sections(0, 7)).toEqual([Side.RIGHT]);
    expect(sections(1, 5)).toEqual([Side.LEFT]);
    expect(sections(1, 6)).toEqual([Side.RIGHT]);
  });

  it("names the sections from each side's end of the table, the same hexes for both", () => {
    const allies = new BoardManager(scenario([]));
    const axis = new BoardManager(scenario([]), "Axis");
    [allies, axis].forEach((board) => board.useFrontSections());
    const at = { row: 2, col: 1 };
    expect(allies.getHex(at)!.getSections()).toEqual([Side.LEFT]);
    expect(axis.getHex(turnedRound(at, STANDARD_BOARD))!.getSections()).toEqual([Side.RIGHT]);
    expect(axis.getHex(turnedRound({ row: 4, col: 6 }, STANDARD_BOARD))!.getSections()).toEqual([Side.LEFT, Side.RIGHT]);
  });
});

describe("a game in the sections variant", () => {
  // Five infantry on the left, one on the middle column and two on the right
  const left = [0, 1, 2, 3, 4].map((col) => ({ row: 8, col }));
  const middle = { row: 6, col: 6 };
  const right = [{ row: 8, col: 10 }, { row: 8, col: 11 }];
  const map = scenario([...left, middle, ...right]);
  const byTemplate = (play: GameSession, id: string) => play.getSnapshot().hand.find((card) => card.templateId === id);
  /** A session whose hand is these cards, from the variant's deck */
  const withHand = (...ids: string[]) => {
    const play = session(map);
    const deck = play.commandCards.filter((card) => !card.reserve);
    const hand: CommandCard[] = [];
    ids.forEach((id) => hand.push(deck.find((card) => card.templateId === id && !hand.includes(card))!));
    const saved = play.save();
    return GameSession.restore({ ...saved, hand: hand.map((card) => card.id), drawPile: deck.filter((card) => !hand.includes(card)).map((card) => card.id), discardPile: [] }, map, []);
  };

  it("has no section cards: they're all Attack, 4 orders", () => {
    const deck = session(map).commandCards;
    expect(deck).toHaveLength(24);
    expect(deck.filter((card) => card.templateId === "attack")).toHaveLength(14);
    expect(deck.every((card) => card.sections !== "chosen" && card.perSection === null && card.drawChoice === 1)).toBe(true);
    expect(deck.find((card) => card.templateId === "attack")!.orders).toBe(4);
    expect(deck.find((card) => card.templateId === "firefight")!.orders).toBe(6);
    expect(deck.find((card) => card.templateId === "move-out")!.orders).toBe(6);
  });

  it("plays a card for the left section, then one for the right, each ordering only its section", () => {
    const play = withHand("attack", "attack", "attack", "attack");
    expect(play.getSnapshot().playSection).toBe(Side.LEFT);
    expect(play.pickCard(play.getSnapshot().hand[0]!)).toBe(true);
    let game = play.getSnapshot();
    expect(game.chosenSection).toBe(Side.LEFT);
    expect(game.nextPlaySection).toBe(Side.RIGHT);
    expect(game.orderable).toHaveLength(6); // the five on the left and the one on the line
    expect(play.issueOrder(right[0]!, right[0]!)).toBe(false);
    left.slice(0, 4).forEach((at) => expect(play.issueOrder(at, at)).toBe(true));
    expect(play.commitOrders()).toBe(true);

    game = play.getSnapshot();
    expect(game.phase).toBe(TurnPhase.PICK_CARDS);
    expect(game.playSection).toBe(Side.RIGHT);
    // The left card has left the hand
    expect(game.hand).toHaveLength(3);
    expect(play.pickCard(game.plays[0]!.card)).toBe(false);
    expect(play.pickCard(game.hand[0]!)).toBe(true);
    game = play.getSnapshot();
    expect(game.plays.map((p) => p.section)).toEqual([Side.LEFT, Side.RIGHT]);
    expect(game.nextPlaySection).toBe(null);
    // The middle unit can be ordered here too; the left ones no longer can, and earlier orders stay
    expect(game.orderable.length).toBe(3);
    expect(game.canUndoOrder).toBe(false);
    [middle, ...right].forEach((at) => expect(play.issueOrder(at, at)).toBe(true));
    expect(play.getSnapshot().orders).toHaveLength(7);
    expect(play.commitOrders()).toBe(true);
    expect(play.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
  });

  it("takes back only the card being played, with its combat card", () => {
    const play = withHand("attack", "attack", "attack");
    play.pickCard(play.getSnapshot().hand[0]!);
    left.slice(0, 4).forEach((at) => play.issueOrder(at, at));
    play.commitOrders();
    play.pickCard(play.getSnapshot().hand[0]!);
    expect(play.unpickCard()).toBe(true);
    const game = play.getSnapshot();
    expect(game.phase).toBe(TurnPhase.PICK_CARDS);
    expect(game.playSection).toBe(Side.RIGHT);
    expect(game.orders).toHaveLength(4);
  });

  it("plays Firefight in one section only", () => {
    const play = withHand("firefight", "attack", "attack");
    play.pickCard(byTemplate(play, "attack")!);
    play.commitOrders();
    // An Attack card with fewer units than orders must give them all
    expect(play.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);
    left.slice(0, 4).forEach((at) => play.issueOrder(at, at));
    play.commitOrders();
    play.pickCard(byTemplate(play, "firefight")!);
    const options = play.getMoveOptions(right[0]!)!;
    expect(options.moves).toEqual([]);
  });

  it("draws a card for each card played, straight into the hand", () => {
    const play = withHand("attack", "attack", "attack", "attack");
    const hand = play.getSnapshot().hand;
    play.pickCard(hand[0]!);
    left.slice(0, 4).forEach((at) => play.issueOrder(at, at));
    play.commitOrders();
    expect(play.pickCard(hand[1]!)).toBe(true);
    [middle, ...right].forEach((at) => play.issueOrder(at, at));
    play.commitOrders();
    play.startBattle();
    play.endBattle();
    const end = play.getSnapshot();
    expect(end.drawnCards).toHaveLength(2);
    expect(end.canDrawAgain).toBe(false);
    expect(end.hand).toHaveLength(4);
    expect(end.hand).not.toContain(hand[0]);
    if (end.needsRewardChoice) play.chooseReward("coins");
    expect(play.endTurn()).toBe(true);
    const record = play.getSnapshot().log[0]!;
    expect(record.plays?.map((p) => p.section)).toEqual([Side.LEFT, Side.RIGHT]);
  });

  it("is saved and picked back up between the two cards", () => {
    const play = withHand("attack", "attack", "attack");
    play.pickCard(play.getSnapshot().hand[0]!);
    left.slice(0, 4).forEach((at) => play.issueOrder(at, at));
    play.commitOrders();
    const restored = GameSession.restore(play.save(), map, []);
    expect(restored.sectionOrders).toBe(true);
    const game = restored.getSnapshot();
    expect(game.playSection).toBe(Side.RIGHT);
    expect(game.plays).toHaveLength(1);
    expect(game.orders).toHaveLength(4);
    expect(restored.board.getHex(middle)!.getSections()).toEqual([Side.LEFT, Side.RIGHT]);
  });

  it("leaves Tactician out of the combat deck, and plays 1 combat card with each card", () => {
    const play = new GameSession({ scenario: map, faction: "Allies", initialHandSize: 4, commandCards: [], combatCards: allCombatCards(), sectionOrders: true, testMode: true });
    expect(play.combatCards.some((card) => card.effect?.kind === "changeSection")).toBe(false);
    expect(play.getSnapshot().maxCombatCards).toBe(1);
  });
});
