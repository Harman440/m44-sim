import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { DIE_KINDS, SIDES_OF } from "../../game-core/dice";
import { dieShape, restingQuaternion } from "./dieGeometry";

describe("dieShape", () => {
  it.each(DIE_KINDS)("has one side per face of the %s die", (die) => {
    const shape = dieShape(die);
    expect(shape.sides).toHaveLength(SIDES_OF[die].length);
    expect(shape.geometry.groups.map((group) => group.materialIndex)).toEqual(SIDES_OF[die].map((_, i) => i));
  });

  it.each(DIE_KINDS)("lays every side of the %s die inside its texture", (die) => {
    for (const side of dieShape(die).sides) {
      for (const [u, v] of side.uvs) {
        expect(u).toBeGreaterThanOrEqual(-1e-9);
        expect(u).toBeLessThanOrEqual(1 + 1e-9);
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
      expect(side.symbolScale).toBeGreaterThan(0.3);
    }
  });

  it("gives every side its own direction, pointing out", () => {
    for (const die of DIE_KINDS) {
      const normals = dieShape(die).sides.map((side) => side.normal);
      normals.forEach((n, i) => normals.slice(i + 1).forEach((m) => expect(n.dot(m)).toBeLessThan(0.99)));
    }
  });
});

describe("restingQuaternion", () => {
  it.each(DIE_KINDS)("turns each side of the %s die to the camera, upright", (die) => {
    for (const side of dieShape(die).sides) {
      const q = restingQuaternion(side);
      const normal = side.normal.clone().applyQuaternion(q);
      const up = side.up.clone().applyQuaternion(q);
      expect(normal.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-6);
      expect(up.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-6);
    }
  });
});

describe("rounded edges", () => {
  it.each(DIE_KINDS)("keep the %s die inside its sharp shape, with unit normals", (die) => {
    const { geometry, sides } = dieShape(die);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    // The sharp die's sides are planes normal·p = distance of the middle of a side
    const reach = die === "longRange" ? 37 / Math.sqrt(3) : 21;
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i);
      for (const side of sides) expect(p.dot(side.normal)).toBeLessThanOrEqual(reach + 1e-6);
      expect(new Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 6);
    }
  });

  it("leaves the middle of a side flat, facing out", () => {
    const { geometry, sides } = dieShape("battle");
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const flat = Array.from({ length: position.count }, (_, i) => i).filter((i) =>
      new Vector3().fromBufferAttribute(normal, i).equals(sides[0]!.normal)
    );
    expect(flat.length).toBeGreaterThan(0);
    for (const i of flat) expect(new Vector3().fromBufferAttribute(position, i).dot(sides[0]!.normal)).toBeCloseTo(21, 6);
  });
});
