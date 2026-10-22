import { describe, expect, it } from "vitest";
import { DIE_SIDES, DieFace, LONG_RANGE_SUPPRESSIVE_DIE_SIDES } from "./dice";
import { hitChance, luckyChance, luckyFace, nextLuck, rollWithLuck } from "./luck";
import { seeded } from "./ai/selfPlay";
import { faceHits } from "../data/hitRules";

const atInfantry = (face: DieFace) => faceHits(face, { infantry: true, closeAssault: false, die: "battle" });
const atTanks = (face: DieFace) => faceHits(face, { infantry: false, closeAssault: false, die: "battle" });

/** The share of hits over many dice rolled at a fixed luck */
const hitShare = (luck: number, isHit = atInfantry, rolls = 60_000) => {
  const random = seeded(7);
  let hits = 0;
  for (let i = 0; i < rolls; i++) {
    const face = luckyFace(DIE_SIDES, isHit, luck, random());
    if (isHit(face)) hits++;
  }
  return hits / rolls;
};

describe("the luck meter", () => {
  it("knows a die's chance of a hit on its target", () => {
    expect(hitChance(DIE_SIDES, atInfantry)).toBe(3 / 6);
    expect(hitChance(DIE_SIDES, atTanks)).toBe(2 / 6);
    expect(hitChance(LONG_RANGE_SUPPRESSIVE_DIE_SIDES, atTanks)).toBe(0);
  });

  it("moves the chance of a hit by 5% a point, within 0 and 1", () => {
    expect(luckyChance(0.5, 3)).toBeCloseTo(0.65);
    expect(luckyChance(0.5, -2)).toBeCloseTo(0.4);
    expect(luckyChance(0.02, -3)).toBe(0);
    expect(luckyChance(0.5, 10)).toBeCloseTo(0.65); // beyond the limit counts as the limit
  });

  it("rolls hits about as often as each level says", () => {
    for (const luck of [-3, -1, 0, 2, 3]) {
      expect(Math.abs(hitShare(luck) - (0.5 + luck * 0.05))).toBeLessThan(0.01);
    }
    expect(Math.abs(hitShare(3, atTanks) - (2 / 6 + 0.15))).toBeLessThan(0.01);
  });

  it("keeps the die's own faces: good luck turns misses into its hit faces, bad luck hits into its misses", () => {
    const random = seeded(3);
    // Draws within the flag side (the last sixth), and within the grenade's (the fourth)
    const flagDraws = Array.from({ length: 2000 }, () => 5 / 6 + random() / 6);
    const lucky = flagDraws.map((r) => luckyFace(DIE_SIDES, atInfantry, 3, r));
    expect(new Set(lucky)).toEqual(new Set([DieFace.FLAG, DieFace.INFANTRY, DieFace.GRENADE]));
    const grenadeDraws = Array.from({ length: 2000 }, () => 3 / 6 + random() / 6);
    const unlucky = grenadeDraws.map((r) => luckyFace(DIE_SIDES, atInfantry, -3, r));
    expect(new Set(unlucky)).toEqual(new Set([DieFace.GRENADE, DieFace.TANK, DieFace.SUPPLY, DieFace.FLAG]));
    // A die with no face that hits can't be helped
    expect(luckyFace(LONG_RANGE_SUPPRESSIVE_DIE_SIDES, atTanks, 3, 0.99)).toBe(DieFace.SUPPLY);
  });

  it("moves on the streak: down by 1 − p on a hit, up by p on a miss, within ±3", () => {
    expect(nextLuck(0, true, 0.5)).toBe(-0.5);
    expect(nextLuck(0, false, 1 / 3)).toBeCloseTo(1 / 3);
    expect(nextLuck(-2.8, true, 0.5)).toBe(-3);
    expect(nextLuck(2.9, false, 0.5)).toBe(3);
  });

  it("stays near 0 for a unit firing at tanks for many turns", () => {
    const random = seeded(11);
    let luck = 0;
    let sum = 0;
    const turns = 5000;
    for (let turn = 0; turn < turns; turn++) {
      luck = rollWithLuck(3, DIE_SIDES, atTanks, luck, random).luck;
      sum += luck;
    }
    expect(Math.abs(sum / turns)).toBeLessThan(0.3);
  });

  it("rolls each die with the luck it has then, one draw a die", () => {
    // The start of the flag side: never turned
    let draws = 0;
    const random = () => (draws++, 5 / 6);
    const { faces, luck } = rollWithLuck(2, DIE_SIDES, atInfantry, 0, random);
    expect(faces).toEqual([DieFace.FLAG, DieFace.FLAG]);
    expect(luck).toBeCloseTo(1); // two misses at p = 0.5
    expect(draws).toBe(2);

    // The top of the flag side, with luck: turned into a hit
    expect(luckyFace(DIE_SIDES, atInfantry, 1, 0.999)).not.toBe(DieFace.FLAG);
    expect(luckyFace(DIE_SIDES, atInfantry, 0, 0.999)).toBe(DieFace.FLAG);
  });
});
