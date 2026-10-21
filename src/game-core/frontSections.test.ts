import { describe, expect, it } from "vitest";
import { frontLayout, sectionQuota } from "./frontSections";
import BoardManager, { turnedRound } from "./BoardManager";
import GameSession from "./gameSession";
import { STANDARD_BOARD } from "./boardSize";
import { Side } from "../types/hex";
import { Position, Scenario } from "../types/scenario";
import { TurnPhase } from "../types/gameManager";
import { same } from "../i18n/lang";
import { sectionOrdersCard } from "../data/commandCards";
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
    expect(sectionQuota(layout, Side.LEFT)).toBe(4);
    expect(sectionQuota(layout, Side.CENTER)).toBe(0);
  });

  it("gives a section bigger than 7 hexes a fifth order", () => {
    const layout = frontLayout(15);
    expect(layout.hexes).toEqual({ [Side.LEFT]: 8, [Side.RIGHT]: 8 });
    expect(sectionQuota(layout, Side.RIGHT)).toBe(5);
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
  // Five infantry on the left, one on the middle column and one on the right
  const left = [0, 1, 2, 3, 4].map((col) => ({ row: 8, col }));
  const middle = { row: 6, col: 6 };
  const right = { row: 8, col: 10 };
  const map = scenario([...left, middle, right]);

  it("has the one card, with every section's orders", () => {
    const game = session(map).getSnapshot();
    expect(game.hand).toHaveLength(1);
    expect(game.hand[0]!.id).toBe(sectionOrdersCard(map).id);
    expect(game.hand[0]!.orders).toBe(8);
  });

  it("leaves Tactician out of the combat deck: there's no command card's section to change", () => {
    const play = new GameSession({ scenario: map, faction: "Allies", initialHandSize: 4, commandCards: [], combatCards: allCombatCards(), sectionOrders: true });
    expect(play.combatCards.length).toBeGreaterThan(0);
    expect(play.combatCards.some((card) => card.effect?.kind === "changeSection")).toBe(false);
  });

  it("orders at most 4 units in a section, a unit on the line counting for either", () => {
    const play = session(map);
    expect(play.pickCard(play.getSnapshot().hand[0]!)).toBe(true);
    left.slice(0, 4).forEach((at) => expect(play.issueOrder(at, at)).toBe(true));
    expect(play.issueOrder(left[4]!, left[4]!)).toBe(false);

    // The unit on the middle column now only fits the right section's orders
    const slots = play.getMoveOptions(middle)!.slots;
    expect(slots.map((slot) => slot.section)).toEqual([Side.RIGHT]);
    expect(play.issueOrder(middle, middle)).toBe(true);
    expect(play.issueOrder(right, right)).toBe(true);
  });

  it("asks which section a unit on the line counts for while both have orders left", () => {
    const play = session(map);
    play.pickCard(play.getSnapshot().hand[0]!);
    expect(play.getMoveOptions(middle)!.slots.map((slot) => slot.section)).toEqual([Side.LEFT, Side.RIGHT]);
    expect(play.issueOrder(middle, middle)).toBe(false);
    expect(play.issueOrder(middle, middle, { section: Side.LEFT, onTheMove: false })).toBe(true);
  });

  it("lets the player give fewer orders, and keeps the card for the next turn", () => {
    const play = session(map);
    const card = play.getSnapshot().hand[0]!;
    play.pickCard(card);
    play.issueOrder(right, right);
    expect(play.commitOrders()).toBe(true);
    expect(play.startBattle()).toBe(true);
    expect(play.endBattle()).toBe(true);
    const end = play.getSnapshot();
    expect(end.canDrawAgain).toBe(false);
    expect(end.drawnCard).toBe(card);
    if (end.needsRewardChoice) expect(play.chooseReward("coins")).toBe(true);
    expect(play.endTurn()).toBe(true);
    const next = play.getSnapshot();
    expect(next.phase).toBe(TurnPhase.PICK_CARDS);
    expect(next.hand).toEqual([card]);
    expect(play.pickCard(card)).toBe(true);
  });

  it("is saved and picked back up", () => {
    const play = session(map);
    play.pickCard(play.getSnapshot().hand[0]!);
    play.issueOrder(right, right);
    const restored = GameSession.restore(play.save(), map, []);
    expect(restored.sectionOrders).toBe(true);
    expect(restored.getSnapshot().orders).toHaveLength(1);
    expect(restored.board.getHex(middle)!.getSections()).toEqual([Side.LEFT, Side.RIGHT]);
  });
});
