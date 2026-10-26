import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import { SavedGame } from "./saveGame";
import { amountOf } from "./unitSupplies";
import { samePosition } from "./position";
import { Equipment, Supply } from "../data/unitSupplies";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

// Hexes in one row are always next to each other
const INF: Position = { row: 6, col: 2 };
const INF_NEXT: Position = { row: 6, col: 3 };
const INF_FAR: Position = { row: 6, col: 8 };
const ELITE_INF: Position = { row: 6, col: 1 };
const TANK: Position = { row: 2, col: 4 };
const TANK_NEXT: Position = { row: 2, col: 5 };
const ARTILLERY: Position = { row: 8, col: 6 };
const ARTILLERY_NEXT: Position = { row: 8, col: 7 };

const scenario: Scenario = {
  id: "regroup",
  name: same("Regroup"),
  description: same(""),
  attacker: "Allies",
  tiles: {},
  elite: [ELITE_INF],
  units: {
    allies: { infantry: [INF, INF_NEXT, INF_FAR, ELITE_INF], tank: [TANK, TANK_NEXT], artillery: [ARTILLERY, ARTILLERY_NEXT] },
    axis: {},
  },
};

const restore = (saved: SavedGame) => GameSession.restore(JSON.parse(JSON.stringify(saved)), scenario);

/** Pass and play (figures), giving orders */
const ordering = ({ figures = true }: { figures?: boolean } = {}) => {
  const session = new GameSession({ scenario, faction: "Allies", figures });
  expect(session.pickCard(null)).toBe(true);
  return session;
};

const indexAt = (saved: SavedGame, position: Position) => saved.units.findIndex((each) => each.position && samePosition(each.position, position));

/** The session saved and restored with these units' figures (the hits each has taken) and supplies */
function withUnits(
  session: GameSession,
  figures: [Position, number[]][],
  supplies: [Position, Partial<Record<Supply, number>>, Partial<Record<Equipment, number>>?][] = []
): GameSession {
  const saved = session.save();
  for (const [position, hits] of figures) {
    const unit = indexAt(saved, position);
    saved.figureHits = [...saved.figureHits.filter((each) => each.unit !== unit), { unit, figures: hits }];
  }
  for (const [position, amounts, equipment = {}] of supplies) {
    const unit = indexAt(saved, position);
    const now = suppliesAt(session, position);
    saved.supplies = [
      ...saved.supplies.filter((each) => each.unit !== unit),
      { unit, amounts: { ...now.amounts, ...amounts }, equipment: { ...now.equipment, ...equipment } },
    ];
  }
  return restore(saved);
}

const suppliesAt = (session: GameSession, position: Position) =>
  session.getSnapshot().supplies.find((each) => samePosition(each.position, position))!.supplies;
const figuresAt = (session: GameSession, position: Position) => session.figuresAt(position);
const refusal = (session: GameSession, position: Position, id: string) =>
  session.getActions(position)?.find((option) => option.action.id === id)?.refusal;
const commit = (session: GameSession) => {
  expect(session.commitOrders()).toBe(true);
  return session;
};

describe("GameSession Regroup", () => {
  it("is offered to infantry and armour that have lost a figure and have a unit of their kind next to them", () => {
    const session = ordering();
    expect(refusal(session, INF, "infantry:regroup")).toBe("notNeeded");
    expect(refusal(session, TANK, "tank:regroup")).toBe("notNeeded");
    expect(session.getActions(ARTILLERY)!.some((option) => option.action.effect === "regroup")).toBe(false);

    const hit = withUnits(session, [
      [INF, [0, 0, 0]],
      [INF_FAR, [0, 0]],
      [TANK, [0, 0]],
    ]);
    expect(refusal(hit, INF, "infantry:regroup")).toBeNull();
    expect(refusal(hit, TANK, "tank:regroup")).toBeNull();
    // The unit next to it is elite, and the others are far away
    expect(refusal(hit, INF_FAR, "infantry:regroup")).toBe("noPartner");
    expect(hit.regroupPartners(INF)).toEqual([INF_NEXT]);
  });

  it("isn't offered on own tablets, which don't count figures", () => {
    const session = ordering({ figures: false });
    expect(session.getActions(INF)!.some((option) => option.action.effect === "regroup")).toBe(false);
  });

  it("takes no infantry at morale 0 as a partner, nor a unit with an order", () => {
    const tired = withUnits(ordering(), [[INF, [0, 0]]], [[INF_NEXT, { [Supply.MORALE]: 0 }]]);
    expect(tired.regroupPartners(INF)).toEqual([]);

    const busy = withUnits(ordering(), [[INF, [0, 0]]]);
    expect(busy.giveAction(INF_NEXT, "infantry:firefight", INF_NEXT)).toBe(true);
    expect(busy.regroupPartners(INF)).toEqual([]);
  });

  it("needs a partner: given only with giveRegroup, to a unit next to it", () => {
    const session = withUnits(ordering(), [[INF, [0, 0]]]);
    expect(session.giveAction(INF, "infantry:regroup", INF)).toBe(false);
    expect(session.giveRegroup(INF, INF_FAR)).toBe(false);
    expect(session.giveRegroup(INF, INF_NEXT)).toBe(true);
    expect(session.getSnapshot().orders[0]).toMatchObject({ action: "infantry:regroup", partner: INF_NEXT, shots: 0 });
  });

  it("keeps the partner from being ordered until the Regroup is taken back", () => {
    const session = withUnits(ordering(), [[INF, [0, 0]]]);
    expect(session.giveRegroup(INF, INF_NEXT)).toBe(true);
    expect(session.getActions(INF_NEXT)).toBeNull();
    expect(session.giveAction(INF_NEXT, "infantry:firefight", INF_NEXT)).toBe(false);

    expect(session.undoLastOrder()).toBe(true);
    expect(session.getActions(INF_NEXT)).not.toBeNull();
  });

  it("frees the partner when the unit is given another action in its place", () => {
    const session = withUnits(ordering(), [[INF, [0, 0]]]);
    expect(session.giveRegroup(INF, INF_NEXT)).toBe(true);
    expect(session.giveAction(INF, "infantry:firefight", INF)).toBe(true);
    expect(session.getActions(INF_NEXT)).not.toBeNull();
  });

  it("moves all the partner's figures when they fit: it leaves the map, with its sandbags, and counts as no loss", () => {
    const session = withUnits(ordering(), [
      [INF, [0, 0, 0]],
      [INF_NEXT, [0, 0]],
    ]);
    session.board.getHex(INF_NEXT)!.setSandbags(true);
    expect(session.giveRegroup(INF, INF_NEXT)).toBe(true);
    commit(session);

    expect(figuresAt(session, INF)).toBe(5);
    expect(session.board.getHex(INF_NEXT)!.unit).toBeNull();
    expect(session.board.getHex(INF_NEXT)!.sandbags).toBe(false);
    expect(session.unitsLost()).toEqual([]);
    expect(session.leftByRegroup()).toEqual([expect.objectContaining({ position: INF_NEXT, figures: 2, sandbags: true })]);
    // A map edit nobody can take back
    expect(session.getSnapshot().canUndoMapEdit).toBe(false);
  });

  it("leaves the partner on the map with what doesn't fit, its squad leader among them", () => {
    const session = withUnits(ordering(), [[INF, [0, 0, 0, 0]]]);
    expect(session.giveRegroup(INF, INF_NEXT)).toBe(true);
    commit(session);
    expect(figuresAt(session, INF)).toBe(6);
    expect(figuresAt(session, INF_NEXT)).toBe(4);
    expect(session.leftByRegroup()).toEqual([]);
  });

  it("pays 2 energy and keeps the better of both units' supplies", () => {
    const session = withUnits(
      ordering(),
      [[INF, [0, 0]]],
      [
        [INF, { [Supply.AMMO]: 0, [Supply.ENERGY]: 3 }],
        [INF_NEXT, { [Supply.ENERGY]: 4 }, { [Equipment.MEDIC_KIT]: 0 }],
      ]
    );
    expect(session.giveRegroup(INF, INF_NEXT)).toBe(true);
    commit(session);
    const supplies = suppliesAt(session, INF);
    // 3 − 2 = 1 energy, the partner's 4 is better; its ammo is full
    expect(amountOf(supplies, Supply.ENERGY)).toBe(4);
    expect(amountOf(supplies, Supply.AMMO)).toBe(2);
    expect(supplies.equipment[Equipment.MEDIC_KIT]).toBe(1);
  });

  it("moves armour's healthy figures first; a damaged one keeps its damage", () => {
    const session = withUnits(
      ordering(),
      [
        [TANK, [1, 0]],
        [TANK_NEXT, [1, 0, 1]],
      ],
      [[TANK, {}]]
    );
    expect(session.giveRegroup(TANK, TANK_NEXT)).toBe(true);
    commit(session);
    const saved = session.save();
    const figures = (position: Position) => saved.figureHits.find((each) => each.unit === indexAt(saved, position))?.figures;
    expect(figures(TANK)).toEqual([0, 1, 0]);
    expect(figures(TANK_NEXT)).toEqual([1, 1]);
    expect(amountOf(suppliesAt(session, TANK), Supply.FUEL)).toBeGreaterThan(0);
  });

  it("keeps the partner through a save", () => {
    const session = withUnits(ordering(), [[INF, [0, 0]]]);
    expect(session.giveRegroup(INF, INF_NEXT)).toBe(true);
    const restored = commit(restore(session.save()));
    expect(figuresAt(restored, INF)).toBe(6);
    expect(restore(restored.save()).leftByRegroup()).toEqual([]);
    expect(figuresAt(restored, INF_NEXT)).toBe(2);
  });
});
