import { describe, expect, it } from "vitest";
import { ATTACK_DIE_SIDES, DIE_SIDES, DieFace, DieKind, LONG_RANGE_DIE_SIDES } from "./dice";
import { appliedFaces, readRoll } from "./rollResult";

const { INFANTRY, TANK, GRENADE, SUPPLY, FLAG } = DieFace;
const ALL = [INFANTRY, INFANTRY, TANK, GRENADE, SUPPLY, FLAG];
const at = (infantry: boolean, closeAssault = false, die: DieKind = "battle") => ({ infantry, closeAssault, die });

describe("readRoll", () => {
  it("hits infantry with the infantry symbol and grenades, any other unit with the tank symbol and grenades", () => {
    expect(readRoll(ALL, at(true))).toMatchObject({ hits: 3, hitFaces: [INFANTRY, INFANTRY, GRENADE] });
    expect(readRoll(ALL, at(false))).toMatchObject({ hits: 2, hitFaces: [TANK, GRENADE] });
  });

  it("counts a grenade as a hit at any range", () => {
    expect(readRoll([GRENADE], at(true, false)).hits).toBe(1);
    expect(readRoll([GRENADE], at(true, true)).hits).toBe(1);
    expect(readRoll([GRENADE], at(false, true)).hits).toBe(1);
  });

  it("reads close assault like a shot at range: a supply never hits", () => {
    expect(readRoll(ALL, at(false, true))).toMatchObject({ hits: 2, hitFaces: [TANK, GRENADE] });
  });

  it("counts flags as retreats", () => {
    expect(readRoll([FLAG, FLAG, INFANTRY], at(false)).retreats).toBe(2);
  });

  it("earns a coin per supply", () => {
    expect(readRoll([SUPPLY, SUPPLY], at(true, true)).coins).toBe(2);
    expect(readRoll([SUPPLY, SUPPLY], at(false, true))).toMatchObject({ coins: 2, hits: 0 });
  });

  it("reads an empty roll as nothing", () => {
    expect(readRoll([], at(true))).toEqual({ hits: 0, retreats: 0, coins: 0, hitFaces: [] });
  });
});

describe("appliedFaces", () => {
  const faces = [DieFace.INFANTRY, DieFace.FLAG, DieFace.GRENADE];

  it("applies every face when none were set aside", () => {
    expect(appliedFaces(faces, null)).toEqual(faces);
  });

  it("applies only the kept dice, in the order rolled", () => {
    expect(appliedFaces(faces, [2, 0])).toEqual([DieFace.INFANTRY, DieFace.GRENADE]);
    expect(appliedFaces(faces, [])).toEqual([]);
  });
});

// One die of each side: how many of its sides hit, retreat or earn a coin
const chances = (sides: readonly DieFace[], infantry: boolean, closeAssault: boolean, die: DieKind) => {
  const { hits, retreats, coins } = readRoll(sides, at(infantry, closeAssault, die));
  return { hits, retreats, coins };
};

describe("the chances of each die (sides out of 6 or 8)", () => {
  it("battle die: infantry 3/6, any other unit 2/6, in close assault and at range", () => {
    for (const closeAssault of [true, false]) {
      expect(chances(DIE_SIDES, true, closeAssault, "battle")).toEqual({ hits: 3, retreats: 1, coins: 1 });
      expect(chances(DIE_SIDES, false, closeAssault, "battle")).toEqual({ hits: 2, retreats: 1, coins: 1 });
    }
  });

  it("long-range die: infantry 3/8, any other unit 2/8, whoever fires", () => {
    expect(chances(LONG_RANGE_DIE_SIDES, true, false, "longRange")).toEqual({ hits: 3, retreats: 1, coins: 2 });
    expect(chances(LONG_RANGE_DIE_SIDES, false, false, "longRange")).toEqual({ hits: 2, retreats: 1, coins: 2 });
  });

  it("attack cards' die: infantry 4/6, any other unit 3/6, no coins", () => {
    expect(chances(ATTACK_DIE_SIDES, true, false, "attack")).toEqual({ hits: 4, retreats: 1, coins: 0 });
    expect(chances(ATTACK_DIE_SIDES, false, false, "attack")).toEqual({ hits: 3, retreats: 1, coins: 0 });
  });
});
