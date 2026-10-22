import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import { SavedGame } from "./saveGame";
import { UnitSupplies } from "./unitSupplies";
import { samePosition } from "./position";
import { DieFace } from "./dice";
import { actionCardById } from "../data/actionCards";
import { Equipment, Supply } from "../data/unitSupplies";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

const INF: Position = { row: 7, col: 1 };
const TANK: Position = { row: 4, col: 6 };
const ELITE_TANK: Position = { row: 4, col: 8 };
const ARTILLERY: Position = { row: 8, col: 9 };

const scenario: Scenario = {
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  attacker: "Allies",
  tiles: {},
  elite: [ELITE_TANK],
  units: {
    allies: { infantry: [INF], tank: [TANK, ELITE_TANK], artillery: [ARTILLERY] },
    axis: {},
  },
};

/** Pass and play (figures) by default, giving orders */
const ordering = ({ figures = true, testMode = false }: { figures?: boolean; testMode?: boolean } = {}) => {
  const session = new GameSession({ scenario, faction: "Allies", figures, testMode });
  return session;
};
const withNoCard = (session: GameSession) => {
  expect(session.pickCard(null)).toBe(true);
  return session;
};

const suppliesAt = (session: GameSession, position: Position): UnitSupplies =>
  session.getSnapshot().supplies.find((each) => samePosition(each.position, position))!.supplies;
const amount = (session: GameSession, position: Position, supply: Supply) => suppliesAt(session, position).amounts[supply];
const strengthAt = (session: GameSession, position: Position) =>
  session.getSnapshot().strength.find((each) => samePosition(each.position, position))!;

const restore = (saved: SavedGame) => GameSession.restore(JSON.parse(JSON.stringify(saved)), scenario);

/** The session saved and restored with the unit at `position` holding these supplies */
function withSupplies(
  session: GameSession,
  position: Position,
  amounts: Partial<Record<Supply, number>>,
  equipment: Partial<Record<Equipment, number>> = {}
): GameSession {
  const saved = session.save();
  const unit = saved.units.findIndex((each) => each.position && samePosition(each.position, position));
  const now = suppliesAt(session, position);
  saved.supplies = [
    ...saved.supplies.filter((each) => each.unit !== unit),
    { unit, amounts: { ...now.amounts, ...amounts }, equipment: { ...now.equipment, ...equipment } },
  ];
  return restore(saved);
}

const holdWith = (session: GameSession, position: Position, actionId: string) => {
  expect(session.giveAction(position, actionId, position)).toBe(true);
  return session;
};
const commit = (session: GameSession) => {
  expect(session.commitOrders()).toBe(true);
  return session;
};

describe("GameSession morale", () => {
  it("takes a point of infantry's morale for each flag, never below 0; armour has none to lose", () => {
    const session = withNoCard(ordering());
    expect(session.sufferHits(INF, 0, 2)).toBe(true);
    expect(amount(session, INF, Supply.MORALE)).toBe(3);
    expect(session.sufferHits(INF, 1, 5)).toBe(true);
    expect(amount(session, INF, Supply.MORALE)).toBe(0);

    expect(session.sufferHits(TANK, 0, 1)).toBe(true);
    expect(amount(session, TANK, Supply.MORALE)).toBeUndefined();
  });

  it("gives all the morale back with Morale Up, the only action at morale 0", () => {
    const session = withSupplies(withNoCard(ordering()), INF, { [Supply.MORALE]: 0 });
    expect(session.giveAction(INF, "infantry:firefight", INF)).toBe(false);
    commit(holdWith(session, INF, "infantry:moraleUp"));
    expect(amount(session, INF, Supply.MORALE)).toBe(5);
  });
});

describe("GameSession healing", () => {
  it("gives back a lost figure with Medic, using up the kit; refused with none lost", () => {
    const session = withNoCard(ordering());
    expect(session.giveAction(INF, "infantry:medic", INF)).toBe(false);

    expect(session.sufferHits(INF, 2, 0)).toBe(true);
    expect(strengthAt(session, INF).figures).toBe(4);
    commit(holdWith(session, INF, "infantry:medic"));
    expect(strengthAt(session, INF).figures).toBe(5);
    expect(suppliesAt(session, INF).equipment[Equipment.MEDIC_KIT]).toBe(0);
  });

  it("mends the figure that's hit with Mechanic, not one already lost; refused with none hit", () => {
    const session = withNoCard(ordering());
    expect(session.giveAction(TANK, "tank:mechanic", TANK)).toBe(false);

    // A figure lost and the next one hit
    expect(session.sufferHits(TANK, 3, 0)).toBe(true);
    expect(strengthAt(session, TANK)).toMatchObject({ figures: 2, damaged: true });
    commit(holdWith(session, TANK, "tank:mechanic"));
    expect(strengthAt(session, TANK)).toMatchObject({ figures: 2, damaged: false });
  });

  it("offers Medic and Mechanic on own tablets, where the table carries them out", () => {
    const session = withNoCard(ordering({ figures: false }));
    holdWith(session, INF, "infantry:medic");
    holdWith(session, TANK, "tank:mechanic");
    expect(session.getSnapshot().tableReminders).toEqual([]);
    commit(session);
    expect(session.getSnapshot().tableReminders.map(({ position, action }) => [position, action.id])).toEqual([
      [INF, "infantry:medic"],
      [TANK, "tank:mechanic"],
    ]);
  });

  it("loses an elite tank's figure on its third hit", () => {
    const session = withNoCard(ordering());
    expect(session.sufferHits(ELITE_TANK, 2, 0)).toBe(true);
    expect(strengthAt(session, ELITE_TANK)).toMatchObject({ figures: 3, damaged: true });
    expect(session.sufferHits(ELITE_TANK, 1, 0)).toBe(true);
    expect(strengthAt(session, ELITE_TANK)).toMatchObject({ figures: 2, damaged: false });
  });
});

describe("GameSession Fortify, Take Cover and Camouflage", () => {
  it("puts sandbags on the hex with Fortify as the orders are revealed, using infantry's sandbags", () => {
    const session = withNoCard(ordering());
    holdWith(session, INF, "infantry:fortify");
    holdWith(session, ARTILLERY, "artillery:fortify");
    expect(session.board.getHex(INF)!.sandbags).toBe(false);
    commit(session);

    expect(session.board.getHex(INF)!.sandbags).toBe(true);
    expect(session.board.getHex(ARTILLERY)!.sandbags).toBe(true);
    expect(suppliesAt(session, INF).equipment[Equipment.SANDBAGS]).toBe(0);
    expect(amount(session, ARTILLERY, Supply.FUEL)).toBe(0);
    expect(session.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
  });

  it("ignores the first 2 infantry-symbol hits with Take Cover, but not grenades, kept through a save", () => {
    const session = commit(holdWith(withNoCard(ordering()), INF, "infantry:takeCover"));
    expect(session.sufferHits(INF, 3, 0, [DieFace.INFANTRY, DieFace.GRENADE, DieFace.INFANTRY])).toBe(true);
    expect(strengthAt(session, INF).figures).toBe(5);

    const restored = restore(session.save());
    expect(restored.sufferHits(INF, 1, 0, [DieFace.INFANTRY])).toBe(true);
    expect(strengthAt(restored, INF).figures).toBe(4);
  });

  it("takes every hit on a unit that didn't take cover", () => {
    const session = commit(holdWith(withNoCard(ordering()), INF, "infantry:firefight"));
    expect(session.sufferHits(INF, 2, 0, [DieFace.INFANTRY, DieFace.INFANTRY])).toBe(true);
    expect(strengthAt(session, INF).figures).toBe(4);
  });

  it("gives the camouflage badge after the battle, using up the net", () => {
    const session = commit(holdWith(withNoCard(ordering()), INF, "infantry:camouflage"));
    expect(session.isCamouflaged(INF)).toBe(false);
    expect(session.startBattle()).toBe(true);
    expect(session.endBattle()).toBe(true);
    expect(session.endTurn()).toBe(true);

    expect(session.isCamouflaged(INF)).toBe(true);
    expect(suppliesAt(session, INF).equipment[Equipment.CAMOUFLAGE_NET]).toBe(0);
  });
});

describe("GameSession Behind Enemy Lines", () => {
  const to: Position = { row: 5, col: 1 };

  it("moves 3 more hexes after the battle in pass and play", () => {
    const session = withNoCard(ordering());
    expect(session.giveAction(INF, "infantry:behindEnemyLines", to)).toBe(true);
    commit(session);
    expect(session.startBattle()).toBe(true);
    expect(session.endBattle()).toBe(true);

    const move = session.getSnapshot().finalMove!;
    expect(move.from).toEqual(to);
    expect(move.name.en).toBe("Behind Enemy Lines");
    expect(session.makeFinalMove(move.options[0]!)).toBe(true);
    expect(session.getSnapshot().finalMove).toBeNull();
  });

  it("is a reminder for the table on own tablets", () => {
    const session = withNoCard(ordering({ figures: false }));
    expect(session.giveAction(INF, "infantry:behindEnemyLines", to)).toBe(true);
    commit(session);
    expect(session.getSnapshot().tableReminders.map(({ action }) => action.id)).toEqual(["infantry:behindEnemyLines"]);
  });
});

describe("GameSession Resupply and Refuel", () => {
  it("gives all infantry its morale, ammo and equipment back with Resupply as the orders are revealed", () => {
    let session = ordering({ testMode: true });
    session = withSupplies(session, INF, { [Supply.MORALE]: 0, [Supply.AMMO]: 0, [Supply.ENERGY]: 1 }, { [Equipment.EXPLOSIVES]: 0 });
    session = withSupplies(session, TANK, { [Supply.SHELLS]: 0 });
    expect(session.pickCard(actionCardById("resupply")!)).toBe(true);
    commit(session);

    expect(suppliesAt(session, INF).amounts).toEqual({ morale: 5, energy: 1, ammo: 2 });
    expect(suppliesAt(session, INF).equipment[Equipment.EXPLOSIVES]).toBe(1);
    expect(amount(session, TANK, Supply.SHELLS)).toBe(0);
  });

  it("tops up the fuel of tanks and artillery with Refuel", () => {
    let session = ordering({ testMode: true });
    session = withSupplies(session, ELITE_TANK, { [Supply.FUEL]: 1 });
    session = withSupplies(session, ARTILLERY, { [Supply.FUEL]: 0 });
    expect(session.pickCard(actionCardById("refuel")!)).toBe(true);
    commit(session);

    expect(amount(session, ELITE_TANK, Supply.FUEL)).toBe(7);
    expect(amount(session, ARTILLERY, Supply.FUEL)).toBe(1);
  });
});

describe("GameSession artillery crews", () => {
  it("leaves its crew as infantry with everything full", () => {
    const session = withNoCard(ordering());
    expect(session.sufferHits(ARTILLERY, 3, 0)).toBe(true);
    expect(session.board.getHex(ARTILLERY)!.unit!.getUnitType()).toBe("infantry");
    expect(suppliesAt(session, ARTILLERY).amounts).toEqual({ morale: 5, energy: 5, ammo: 2 });
  });
});
