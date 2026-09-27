import { describe, expect, it } from "vitest";
import { DieFace } from "./dice";
import { UnitType } from "./unit";
import { appliedFaces, readRoll } from "./rollResult";

const { INFANTRY, TANK, GRENADE, STAR, FLAG } = DieFace;
const ALL = [INFANTRY, INFANTRY, TANK, GRENADE, STAR, FLAG];
const at = (unitType: UnitType, closeAssault = false) => ({ unitType, closeAssault });

describe("readRoll", () => {
  it("counts the matching unit symbols and grenades as hits on infantry and tanks", () => {
    expect(readRoll(ALL, at(UnitType.INFANTRY))).toMatchObject({ hits: 3, hitFaces: [INFANTRY, INFANTRY, GRENADE] });
    expect(readRoll(ALL, at(UnitType.TANK))).toMatchObject({ hits: 2, hitFaces: [TANK, GRENADE] });
  });

  it("counts a grenade as a hit at any range", () => {
    expect(readRoll([GRENADE], at(UnitType.INFANTRY, false)).hits).toBe(1);
    expect(readRoll([GRENADE], at(UnitType.INFANTRY, true)).hits).toBe(1);
  });

  it("hits artillery with grenades, and with stars only in close assault", () => {
    expect(readRoll(ALL, at(UnitType.ARTILLERY)).hits).toBe(1);
    expect(readRoll(ALL, at(UnitType.ARTILLERY, true))).toMatchObject({ hits: 2, hitFaces: [GRENADE, STAR] });
  });

  it("counts flags as retreats", () => {
    expect(readRoll([FLAG, FLAG, INFANTRY], at(UnitType.TANK)).retreats).toBe(2);
  });

  it("earns a coin per star, but not for a star that counted as a hit", () => {
    expect(readRoll([STAR, STAR], at(UnitType.INFANTRY, true)).coins).toBe(2);
    expect(readRoll([STAR, STAR], at(UnitType.ARTILLERY))).toMatchObject({ coins: 2, hits: 0 });
    expect(readRoll([STAR, STAR], at(UnitType.ARTILLERY, true))).toMatchObject({ coins: 0, hits: 2 });
  });

  it("reads an empty roll as nothing", () => {
    expect(readRoll([], at(UnitType.INFANTRY))).toEqual({ hits: 0, retreats: 0, coins: 0, hitFaces: [] });
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
