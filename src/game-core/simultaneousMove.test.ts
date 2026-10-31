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

  it("lets a unit pass through a hex where one of its own has finished its move", () => {
    const result = moveSimultaneously([allies(0, row(4, 3, 4)), allies(1, row(3, 3, 4)), allies(2, [{ row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }, { row: 4, col: 5 }])], []);
    // Allied 0 ends on (4,4) at step 1; Allied 2 passes through it at step 2 and goes on
    expect(result.collisions).toEqual([]);
    expect(result.ends.map((end) => [end.end, end.stopped])).toEqual([
      [{ row: 4, col: 4 }, false],
      [{ row: 3, col: 4 }, false],
      [{ row: 4, col: 5 }, false],
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

  it("lets two units of the same side step into the same hex at once", () => {
    const same = moveSimultaneously([allies(1, row(4, 1, 2, 3)), allies(0, [{ row: 3, col: 1 }, { row: 4, col: 2 }])], []);
    // Both step into (4,2) at step 1: only the hex each ends on counts, so neither waits
    expect(same.collisions).toEqual([]);
    expect(same.ends).toEqual([
      { side: "Allies", order: 1, end: { row: 4, col: 3 }, stopped: false },
      { side: "Allies", order: 0, end: { row: 4, col: 2 }, stopped: false },
    ]);
  });

  it("stops a unit short of its end when one of its own was stopped there first by a collision", () => {
    const result = moveSimultaneously(
      [allies(0, row(4, 3, 4, 5, 6)), allies(1, row(4, 1, 2, 3, 4)), axis(0, row(4, 7, 6))],
      []
    );
    // Step 3: Allied 0, on (4,5), steps into the Axis unit on (4,6): a collision. Allied 1 ends
    // on (4,4), which Allied 0 has passed: no clash
    expect(result.collisions).toHaveLength(1);
    expect(result.ends.map((end) => [end.order, end.side, end.end, end.stopped])).toEqual([
      [0, "Allies", { row: 4, col: 5 }, true],
      [1, "Allies", { row: 4, col: 4 }, false],
      [0, "Axis", { row: 4, col: 6 }, false],
    ]);

    const late = moveSimultaneously(
      [allies(0, row(4, 4, 5, 6)), allies(1, row(4, 1, 2, 3, 4, 5)), axis(0, row(4, 7, 6))],
      []
    );
    // Allied 0 is stopped on (4,5) at step 2; Allied 1 would end there at step 4, so it stops on (4,4)
    expect(late.ends.map((end) => [end.order, end.side, end.end, end.stopped])).toEqual([
      [0, "Allies", { row: 4, col: 5 }, true],
      [1, "Allies", { row: 4, col: 4 }, true],
      [0, "Axis", { row: 4, col: 6 }, false],
    ]);
  });

  it("sends back a unit stopped by a collision on a hex where one of its own already ended", () => {
    const result = moveSimultaneously(
      [allies(0, row(4, 3, 4)), allies(1, row(4, 1, 2, 3, 4, 5)), axis(0, row(4, 6, 5))],
      []
    );
    // Allied 0 ends on (4,4) at step 1. Allied 1 reaches it at step 3 and steps into the Axis
    // unit on (4,5): a collision, after which it goes back to (4,3), the collision with it
    expect(result.ends.map((end) => [end.order, end.side, end.end, end.stopped])).toEqual([
      [0, "Allies", { row: 4, col: 4 }, false],
      [1, "Allies", { row: 4, col: 3 }, true],
      [0, "Axis", { row: 4, col: 5 }, false],
    ]);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]!.units[0]).toEqual({ side: "Allies", order: 1, position: { row: 4, col: 3 } });
  });

  describe("Armor Forward through infantry", () => {
    const armorForward = (path: Position[]): Mover => ({ side: "Allies", order: 0, path, throughInfantry: true });
    const infantryAt = (col: number) => ({ side: "Axis" as const, order: null, position: { row: 4, col }, infantry: true });

    it("goes through enemy infantry that stays put, with no collision, and records it", () => {
      const result = moveSimultaneously([armorForward(row(4, 1, 2, 3, 4))], [infantryAt(2), infantryAt(3)]);

      expect(result.collisions).toEqual([]);
      expect(result.ends[0]).toEqual({ side: "Allies", order: 0, end: { row: 4, col: 4 }, stopped: false });
      expect(result.overruns).toEqual([
        { step: 1, hex: { row: 4, col: 2 }, armour: { side: "Allies", order: 0 }, infantry: { side: "Axis", order: null, position: { row: 4, col: 2 } } },
        { step: 2, hex: { row: 4, col: 3 }, armour: { side: "Allies", order: 0 }, infantry: { side: "Axis", order: null, position: { row: 4, col: 3 } } },
      ]);
    });

    it("still collides with infantry on its last hex, with armour or artillery, and without Armor Forward", () => {
      expect(moveSimultaneously([armorForward(row(4, 1, 2, 3))], [infantryAt(3)]).collisions).toHaveLength(1);
      expect(moveSimultaneously([armorForward(row(4, 1, 2, 3))], [{ ...infantryAt(2), infantry: false }]).collisions).toHaveLength(1);
      const assault = moveSimultaneously([allies(0, row(4, 1, 2, 3))], [infantryAt(2)]);
      expect(assault.collisions).toHaveLength(1);
      expect(assault.overruns).toEqual([]);
    });

    it("goes through infantry stopped on its way, but collides with infantry stepping into the same hex", () => {
      // The Axis infantry is stopped by the Allied infantry at once, and the armour then goes through it
      const stopped = moveSimultaneously(
        [armorForward(row(4, 1, 2, 3, 4)), allies(1, row(5, 3)), { side: "Axis", order: 0, path: [{ row: 4, col: 3 }, { row: 5, col: 3 }], infantry: true }],
        []
      );
      expect(stopped.overruns.map((each) => each.hex)).toEqual([{ row: 4, col: 3 }]);

      const meeting = moveSimultaneously([armorForward(row(4, 1, 2, 3)), { side: "Axis", order: 0, path: row(4, 3, 2), infantry: true }], []);
      expect(meeting.overruns).toEqual([]);
      expect(meeting.collisions).toHaveLength(1);
    });
  });
});
