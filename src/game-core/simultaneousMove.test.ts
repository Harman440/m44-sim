import { describe, expect, it } from "vitest";
import {
  MoveRun,
  Mover,
  Stander,
  nextPush,
  pushBlocked,
  pushTo,
  resolveCollision,
  runEnds,
  runWaitsFor,
  startRun,
  takeStep,
} from "./simultaneousMove";
import { Position } from "../types/scenario";

const row = (r: number, ...cols: number[]): Position[] => cols.map((col) => ({ row: r, col }));
const at = (r: number, col: number): Position => ({ row: r, col });

const allies = (order: number, path: Position[], extra: Partial<Mover> = {}): Mover => ({ side: "Allies", order, path, ...extra });
const axis = (order: number, path: Position[], extra: Partial<Mover> = {}): Mover => ({ side: "Axis", order, path, ...extra });
const standing = (side: Stander["side"], position: Position, extra: Partial<Stander> = {}): Stander => ({ side, order: null, position, ...extra });
const everywhere = () => true;

/** Steps until the run waits for something other than a step */
const run = (start: MoveRun): MoveRun => {
  let state = start;
  while (runWaitsFor(state) === "step") state = takeStep(state);
  return state;
};
const positions = (state: MoveRun) => state.units.map((unit) => unit.position);
/** Make every push it can on its own (back the way it came), as the match does */
const pushBack = (start: MoveRun): MoveRun => {
  let state = start;
  for (let next = nextPush(state, everywhere); next?.back; next = nextPush(state, everywhere)) state = pushTo(state, everywhere, next.back);
  return state;
};

describe("moving one hex at a time", () => {
  it("moves every unit a hex a step, all at once, to the end of its path when nothing is in the way", () => {
    const start = startRun([allies(0, row(4, 1, 2, 3)), axis(0, row(2, 5, 4))], []);
    const first = takeStep(start);
    expect(first.step).toBe(1);
    expect(positions(first)).toEqual([at(4, 2), at(2, 4)]);

    const done = run(first);
    expect(done.finished).toBe(true);
    expect(runWaitsFor(done)).toBeNull();
    expect(done.collisions).toEqual([]);
    expect(runEnds(done).map((end) => end.end)).toEqual([at(4, 3), at(2, 4)]);
  });

  it("stops at the step two enemies meet and waits for the collision: both share the hex they stepped into at once, neither there first", () => {
    const state = run(startRun([allies(0, row(4, 1, 2, 3)), axis(1, row(4, 5, 4, 3))], []));

    expect(runWaitsFor(state)).toBe("collision");
    expect(state.step).toBe(2);
    expect(state.collisions).toEqual([{ step: 2, kind: "same-hex", hex: at(4, 3), units: [0, 1], priority: null, resolved: false }]);
    expect(positions(state)).toEqual([at(4, 3), at(4, 3)]);
    // Nothing else moves until it's settled
    expect(takeStep(state)).toBe(state);
  });

  it("lets a unit into a standing enemy's hex, which keeps priority", () => {
    const state = run(startRun([allies(2, row(4, 1, 2, 3))], [standing("Axis", at(4, 2))]));

    expect(state.collisions).toEqual([{ step: 1, kind: "standing", hex: at(4, 2), units: [0, 1], priority: 1, resolved: false }]);
    expect(positions(state)).toEqual([at(4, 2), at(4, 2)]);
  });

  it("keeps two enemies that would swap hexes each on its own", () => {
    const state = run(startRun([allies(0, row(4, 1, 2, 3)), axis(0, row(4, 4, 3, 2))], []));

    expect(state.collisions).toMatchObject([{ step: 2, kind: "crossing", hex: null, units: [0, 1] }]);
    expect(positions(state)).toEqual([at(4, 2), at(4, 3)]);
  });

  it("lets a unit follow into a hex an enemy is leaving, and units of one side pass through each other", () => {
    expect(run(startRun([allies(0, row(4, 1, 2, 3)), axis(0, row(4, 2, 3, 4))], [])).collisions).toEqual([]);
    const own = run(startRun([allies(0, row(4, 1, 2, 3, 4)), allies(1, row(4, 3))], []));
    expect(own.finished).toBe(true);
    expect(positions(own)).toEqual([at(4, 4), at(4, 3)]);
  });

  it("goes on after the collision is settled: the others keep moving, the two that met don't", () => {
    let state = run(startRun([allies(0, row(4, 1, 2, 3)), allies(1, row(6, 1, 2, 3, 4)), axis(0, row(4, 4, 3, 2))], []));
    expect(state.step).toBe(2);
    state = resolveCollision(state, 0, { flags: [0, 0], gone: [false, false] });
    expect(runWaitsFor(state)).toBe("step");
    state = run(state);
    expect(state.finished).toBe(true);
    expect(positions(state)).toEqual([at(4, 2), at(6, 4), at(4, 3)]);
  });
});

describe("settling a collision", () => {
  const sameHex = () => run(startRun([allies(0, row(4, 1, 2, 3)), axis(1, row(4, 5, 4, 3))], []));
  const intoStander = () => run(startRun([allies(0, row(4, 1, 2, 3))], [standing("Axis", at(4, 3))]));

  it("sends both back a hex when they got there at once and neither rolled a flag: nobody keeps the hex", () => {
    const state = pushBack(resolveCollision(sameHex(), 0, { flags: [0, 0], gone: [false, false] }));
    expect(positions(state)).toEqual([at(4, 2), at(4, 4)]);
    expect(runWaitsFor(state)).toBe("step");
  });

  it("sends back the one that wasn't there first when neither rolled a flag", () => {
    const state = pushBack(resolveCollision(intoStander(), 0, { flags: [0, 0], gone: [false, false] }));
    expect(positions(state)).toEqual([at(4, 2), at(4, 3)]);
  });

  it("pushes each unit a hex per flag back the way it came, one hex at a time, and the other keeps the hex", () => {
    let state = resolveCollision(sameHex(), 0, { flags: [2, 0], gone: [false, false] });
    expect(state.pushes).toEqual([{ unit: 0, hexes: 2, enemy: at(4, 3) }]);
    expect(runWaitsFor(state)).toBe("push");
    state = pushTo(state, everywhere, nextPush(state, everywhere)!.back!);
    expect(positions(state)[0]).toEqual(at(4, 2));
    state = pushTo(state, everywhere, nextPush(state, everywhere)!.back!);
    expect(positions(state)).toEqual([at(4, 1), at(4, 3)]);
    expect(state.pushes).toEqual([]);
  });

  it("pushes the unit that was there first too when it rolls the flag, and lets its player pick a hex not nearer the enemy", () => {
    let state = resolveCollision(intoStander(), 0, { flags: [0, 1], gone: [false, false] });
    const next = nextPush(state, everywhere)!;
    // It didn't move: there is no way back, so its player picks
    expect(next.back).toBeNull();
    // It shares the hex with the enemy, so no hex round it is nearer: all 6 are free
    expect(next.options).toHaveLength(6);
    state = pushTo(state, everywhere, at(4, 4));
    expect(positions(state)).toEqual([at(4, 3), at(4, 4)]);
  });

  it("gives the hexes each unit went through: its path up to where it stopped, or to where it left it and then the hexes it was pushed to", () => {
    let state = resolveCollision(intoStander(), 0, { flags: [1, 1], gone: [false, false] });
    state = pushTo(state, everywhere, nextPush(state, everywhere)!.back!);
    state = pushTo(state, everywhere, at(4, 4));
    state = run(state);
    const [mover, stander] = runEnds(state);
    expect(mover).toMatchObject({ end: at(4, 2), path: row(4, 1, 2) });
    expect(stander).toMatchObject({ end: at(4, 4), path: row(4, 3, 4) });
  });

  it("refuses a hex its player may not pick, and takes a hit for a hex it can't retreat", () => {
    let state = resolveCollision(intoStander(), 0, { flags: [0, 1], gone: [false, false] });
    expect(pushTo(state, everywhere, at(1, 1))).toBe(state);
    const nowhere = (position: Position) => position.row === 4 && position.col === 3;
    expect(nextPush(state, nowhere)!.options).toEqual([]);
    state = pushBlocked(state, nowhere);
    expect(state.pushes).toEqual([]);
    expect(positions(state)[1]).toEqual(at(4, 3));
  });

  it("leaves nobody to push when one of them was destroyed", () => {
    const state = resolveCollision(sameHex(), 0, { flags: [0, 1], gone: [true, false] });
    expect(state.pushes).toEqual([]);
    expect(state.units[0]!.gone).toBe(true);
  });

  it("moves nobody in a crossing with no flag: nobody gained a hex", () => {
    const crossing = run(startRun([allies(0, row(4, 1, 2, 3)), axis(0, row(4, 4, 3, 2))], []));
    const state = resolveCollision(crossing, 0, { flags: [0, 0], gone: [false, false] });
    expect(state.pushes).toEqual([]);
  });
});

describe("Armor Forward through infantry", () => {
  const armorForward = (path: Position[]): Mover => allies(0, path, { throughInfantry: true });
  const infantryAt = (col: number) => standing("Axis", at(4, col), { infantry: true });

  it("goes through enemy infantry that stays put, with no collision, and records it", () => {
    const state = run(startRun([armorForward(row(4, 1, 2, 3, 4))], [infantryAt(2), infantryAt(3)]));

    expect(state.collisions).toEqual([]);
    expect(state.finished).toBe(true);
    expect(positions(state)[0]).toEqual(at(4, 4));
    expect(state.overruns).toEqual([
      { step: 1, hex: at(4, 2), armour: 0, infantry: 1 },
      { step: 2, hex: at(4, 3), armour: 0, infantry: 2 },
    ]);
  });

  it("still collides with infantry on its last hex, with armour or artillery, and without Armor Forward", () => {
    expect(run(startRun([armorForward(row(4, 1, 2, 3))], [infantryAt(3)])).collisions).toHaveLength(1);
    expect(run(startRun([armorForward(row(4, 1, 2, 3))], [{ ...infantryAt(2), infantry: false }])).collisions).toHaveLength(1);
    const assault = run(startRun([allies(0, row(4, 1, 2, 3))], [infantryAt(2)]));
    expect(assault.collisions).toHaveLength(1);
    expect(assault.overruns).toEqual([]);
  });
});
