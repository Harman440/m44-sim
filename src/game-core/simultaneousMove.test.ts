import { describe, expect, it } from "vitest";
import { moveSimultaneously, Mover } from "./simultaneousMove";
import { Position } from "../types/scenario";

const row = (r: number, ...cols: number[]): Position[] => cols.map((col) => ({ row: r, col }));

const allies = (order: number, path: Position[]): Mover => ({ side: "Allies", order, path });
const axis = (order: number, path: Position[]): Mover => ({ side: "Axis", order, path });

describe("moveSimultaneously", () => {
  it("moves every unit to the end of its path when nothing is in the way", () => {
    const result = moveSimultaneously([allies(0, row(4, 1, 2, 3)), axis(0, row(2, 5, 4))], []);

    expect(result.collisions).toEqual([]);
    expect(result.ends).toEqual([
      { side: "Allies", order: 0, end: { row: 4, col: 3 }, stopped: false },
      { side: "Axis", order: 0, end: { row: 2, col: 4 }, stopped: false },
    ]);
  });

  it("stops two enemies stepping into the same hex, outside it", () => {
    const result = moveSimultaneously([allies(0, row(4, 1, 2, 3)), axis(1, row(4, 5, 4, 3))], []);

    expect(result.collisions).toEqual([
      {
        step: 2,
        kind: "same-hex",
        hex: { row: 4, col: 3 },
        units: [
          { side: "Allies", order: 0, position: { row: 4, col: 2 } },
          { side: "Axis", order: 1, position: { row: 4, col: 4 } },
        ],
      },
    ]);
    expect(result.ends.map((end) => [end.end, end.stopped])).toEqual([
      [{ row: 4, col: 2 }, true],
      [{ row: 4, col: 4 }, true],
    ]);
  });

  it("stops two enemies that would swap hexes, each on its own", () => {
    const result = moveSimultaneously([allies(0, row(4, 1, 2, 3)), axis(0, row(4, 4, 3, 2))], []);

    expect(result.collisions).toEqual([
      {
        step: 2,
        kind: "crossing",
        hex: null,
        units: [
          { side: "Allies", order: 0, position: { row: 4, col: 2 } },
          { side: "Axis", order: 0, position: { row: 4, col: 3 } },
        ],
      },
    ]);
  });

  it("stops a unit stepping into a standing enemy's hex", () => {
    const result = moveSimultaneously([allies(2, row(4, 1, 2, 3))], [{ side: "Axis", order: null, position: { row: 4, col: 2 } }]);

    expect(result.collisions).toEqual([
      {
        step: 1,
        kind: "standing",
        hex: { row: 4, col: 2 },
        units: [
          { side: "Allies", order: 2, position: { row: 4, col: 1 } },
          { side: "Axis", order: null, position: { row: 4, col: 2 } },
        ],
      },
    ]);
    expect(result.ends[0]).toEqual({ side: "Allies", order: 2, end: { row: 4, col: 1 }, stopped: true });
  });

  it("lets a unit follow into a hex an enemy is leaving", () => {
    const result = moveSimultaneously([allies(0, row(4, 1, 2, 3)), axis(0, row(4, 2, 3, 4))], []);
    // The Axis unit moves on ahead; the Allies follow without meeting it
    expect(result.collisions).toEqual([]);
    expect(result.ends.map((end) => end.end)).toEqual([{ row: 4, col: 3 }, { row: 4, col: 4 }]);
  });

  it("holds up a unit behind one of its own that doesn't move", () => {
    const result = moveSimultaneously(
      [axis(0, row(4, 6, 5)), allies(0, row(4, 2, 3, 4, 5))],
      [{ side: "Allies", order: null, position: { row: 4, col: 4 } }]
    );
    // The moving Allied unit reaches (4,3), then waits behind its own unit on (4,4)
    expect(result.collisions).toEqual([]);
    expect(result.ends).toEqual([
      { side: "Axis", order: 0, end: { row: 4, col: 5 }, stopped: false },
      { side: "Allies", order: 0, end: { row: 4, col: 3 }, stopped: true },
    ]);
  });

  it("collides with an enemy that has finished its move, holding up the units behind", () => {
    const result = moveSimultaneously(
      [allies(0, row(4, 3, 4, 5)), allies(1, row(4, 2, 3, 4)), axis(0, row(4, 6, 5))],
      []
    );
    // Step 1: Allied 0 → (4,4), Allied 1 → (4,3), the Axis unit → (4,5), the end of its move
    // Step 2: Allied 0 steps into the Axis unit: a collision; Allied 1 waits behind it
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]).toMatchObject({ step: 2, kind: "standing", hex: { row: 4, col: 5 } });
    expect(result.ends.map((end) => [end.order, end.side, end.end])).toEqual([
      [0, "Allies", { row: 4, col: 4 }],
      [1, "Allies", { row: 4, col: 3 }],
      [0, "Axis", { row: 4, col: 5 }],
    ]);
  });

  it("lets the earlier order go first when two units of the same side want the same hex", () => {
    const same = moveSimultaneously([allies(1, [{ row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 }]), allies(0, [{ row: 3, col: 1 }, { row: 4, col: 2 }])], []);
    // Both want (4,2) at step 1: the earlier order goes, the later waits
    expect(same.ends).toEqual([
      { side: "Allies", order: 1, end: { row: 4, col: 1 }, stopped: true },
      { side: "Allies", order: 0, end: { row: 4, col: 2 }, stopped: false },
    ]);
  });
});
