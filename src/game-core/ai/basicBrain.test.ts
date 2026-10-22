import { describe, expect, it } from "vitest";
import GameSession from "../gameSession";
import PassAndPlayMatch from "../passAndPlay";
import { AiView, seenEnemies } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { hexDistance } from "../fireTargets";
import { samePosition } from "../position";
import { UnitType } from "../unit";
import { Faction } from "../../types/faction";
import { Scenario } from "../../types/scenario";
import { same } from "../../i18n/lang";

// The computer plays the Axis, the attacker, with its infantry far from the Allies
const scenario: Scenario = {
  id: "test",
  name: same("Test"),
  description: same(""),
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 7, col: 1 }], tank: [{ row: 8, col: 6 }] },
    axis: { infantry: [{ row: 1, col: 3 }, { row: 1, col: 9 }] },
  },
};

const newMatch = () => {
  const session = (faction: Faction) => new GameSession({ scenario, faction, figures: true });
  return new PassAndPlayMatch(scenario, { Allies: session("Allies"), Axis: session("Axis") }, { computer: "Axis" });
};

const viewOf = (match: PassAndPlayMatch): AiView => ({
  side: "Axis",
  session: match.sessions.Axis,
  enemies: seenEnemies(match, "Axis"),
  random: () => 0,
});

describe("basicBrain", () => {
  it("moves a unit out of range toward the nearest enemy", () => {
    const match = newMatch();
    const session = match.sessions.Axis;
    session.pickCard(null);
    const view = viewOf(match);
    const from = view.session.getSnapshot().orderable[0]!;
    const nearest = (position: { row: number; col: number }) =>
      Math.min(...view.enemies.map((enemy) => hexDistance(enemy.position, position)));

    const { to } = basicBrain.moveFor(view, from);

    expect(nearest(to)).toBeLessThan(nearest(from));
    expect(session.getMoveOptions(from)!.moves.some((position) => samePosition(position, to))).toBe(true);
    expect(session.issueOrder(from, to)).toBe(true);
  });

  it("orders first the unit nearest the enemy", () => {
    const match = newMatch();
    const view = viewOf(match);
    const units = [{ row: 1, col: 3 }, { row: 1, col: 9 }];
    const nearest = (position: { row: number; col: number }) =>
      Math.min(...view.enemies.map((enemy) => hexDistance(enemy.position, position)));
    const expected = [...units].sort((a, b) => nearest(a) - nearest(b))[0]!;
    expect(basicBrain.nextToOrder(view, units)).toEqual(expected);
  });

  it("retreats to the hex farthest from the enemy", () => {
    const view: AiView = {
      ...viewOf(newMatch()),
      enemies: [{ position: { row: 3, col: 3 }, unitType: UnitType.INFANTRY, figures: 4 }],
    };
    expect(basicBrain.retreatTo(view, { row: 4, col: 3 }, [{ row: 5, col: 3 }, { row: 6, col: 3 }])).toEqual({ row: 6, col: 3 });
  });

  it("always takes ground", () => {
    const view = viewOf(newMatch());
    expect(basicBrain.takeGround(view, 0)).toBe(true);
  });
});
