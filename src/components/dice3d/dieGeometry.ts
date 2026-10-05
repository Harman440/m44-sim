import { BufferGeometry, Float32BufferAttribute, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import { DieKind } from "../../game-core/dice";

/** Where one side of a die is and how its picture is laid on it */
export interface DieSideLayout {
  /** Points out of the side */
  normal: Vector3;
  /** The way up of the side's picture */
  up: Vector3;
  /** The side's corners on its texture, in [0, 1], in the order of the geometry */
  uvs: [number, number][];
  /** The width of the picture's 48-unit box, as a share of the texture */
  symbolScale: number;
  /** How wide the texture is on the die, in CSS pixels (the scene draws 1 unit as 1 pixel) */
  textureSpan: number;
}

export interface DieShape {
  geometry: BufferGeometry;
  /** One per side, in the order of the die's sides (`SIDES_OF`); side i uses material i */
  sides: DieSideLayout[];
}

/** The faces of a cube with half-edge 1, corners in a cycle round each face */
function cubeFaces(): Vector3[][] {
  const faces: Vector3[][] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [1, -1]) {
      const b = (axis + 1) % 3;
      const c = (axis + 2) % 3;
      const corner = (sb: number, sc: number) => {
        const v = [0, 0, 0];
        v[axis] = sign;
        v[b] = sb;
        v[c] = sc;
        return new Vector3(...v);
      };
      faces.push([corner(1, 1), corner(-1, 1), corner(-1, -1), corner(1, -1)]);
    }
  }
  return faces;
}

/** The faces of an octahedron with its corners at distance 1 */
function octahedronFaces(): Vector3[][] {
  const faces: Vector3[][] = [];
  for (const sx of [1, -1])
    for (const sy of [1, -1])
      for (const sz of [1, -1])
        faces.push([new Vector3(sx, 0, 0), new Vector3(0, sy, 0), new Vector3(0, 0, sz)]);
  return faces;
}

/** Turn each face's corners counter-clockwise as seen from outside (the polyhedron is centred on the origin) */
function facingOut(face: Vector3[]): Vector3[] {
  const [a, b, c] = face as [Vector3, Vector3, Vector3];
  const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
  const centroid = face.reduce((sum, v) => sum.add(v), new Vector3()).divideScalar(face.length);
  return normal.dot(centroid) < 0 ? [...face].reverse() : face;
}

/** A side's layout: its normal, the picture's way up (towards a corner of a triangle, an edge otherwise) and texture coordinates */
function layoutSide(face: Vector3[], size: number): DieSideLayout {
  const [a, b, c] = face as [Vector3, Vector3, Vector3];
  const centroid = face.reduce((sum, v) => sum.clone().add(v), new Vector3()).divideScalar(face.length);
  const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
  const towards = face.length === 3 ? a.clone() : a.clone().add(b).multiplyScalar(0.5);
  const up = towards.sub(centroid).normalize();
  const right = up.clone().cross(normal);

  const flat = face.map((v) => {
    const p = v.clone().sub(centroid);
    return [p.dot(right), p.dot(up)] as const;
  });
  const extent = Math.max(...flat.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
  // The largest circle round the centre that stays on the side
  const inradius = Math.min(
    ...flat.map(([x1, y1], i) => {
      const [x2, y2] = flat[(i + 1) % flat.length]!;
      return Math.abs(x1 * y2 - x2 * y1) / Math.hypot(x2 - x1, y2 - y1);
    })
  );
  return {
    normal,
    up,
    uvs: flat.map(([x, y]) => [0.5 + x / (2 * extent), 0.5 + y / (2 * extent)]),
    // The symbols fill most of their 48-unit box, so a triangle's can be drawn larger than its inscribed circle
    symbolScale: (inradius / extent) * (face.length === 3 ? 1.25 : 0.95),
    textureSpan: 2 * extent * size,
  };
}

/** Splits a side into small triangles (a grid on a square, rows on a triangle), so its edges can be rounded */
const SUBDIVISIONS = 12;

/** Points across a side and their texture coordinates, as triangles counter-clockwise from outside */
function subdivide(face: Vector3[], faceUvs: [number, number][]): { point: Vector3; uv: [number, number] }[] {
  const n = SUBDIVISIONS;
  const mix = (weights: number[]) => ({
    point: face.reduce((sum, v, k) => sum.addScaledVector(v, weights[k]!), new Vector3()),
    uv: [0, 1].map((axis) => faceUvs.reduce((sum, uv, k) => sum + uv[axis]! * weights[k]!, 0)) as [number, number],
  });
  const corners: { point: Vector3; uv: [number, number] }[] = [];
  if (face.length === 4) {
    // Bilinear: corner 0 at (0, 0), 1 at (1, 0), 2 at (1, 1), 3 at (0, 1)
    const at = (i: number, j: number) => {
      const [s, t] = [i / n, j / n];
      return mix([(1 - s) * (1 - t), s * (1 - t), s * t, (1 - s) * t]);
    };
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        corners.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  } else {
    // Barycentric: corner 0 at (0, 0), 1 at (1, 0), 2 at (0, 1)
    const at = (i: number, j: number) => mix([1 - (i + j) / n, i / n, j / n]);
    for (let i = 0; i < n; i++)
      for (let j = 0; i + j < n; j++) {
        corners.push(at(i, j), at(i + 1, j), at(i, j + 1));
        if (i + j < n - 1) corners.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
      }
  }
  return corners;
}

/**
 * Builds a die from its faces (corners at unit size), scaled to `size` with
 * its edges rounded by `radius`: each point of a side moves onto the die
 * shrunk by `radius` (`inner` finds the nearest point on it) plus `radius`
 * outwards, so the middle of a side stays put and the edges and corners round off.
 */
function buildShape(faces: Vector3[][], size: number, radius: number, inner: (p: Vector3) => Vector3): DieShape {
  const outward = faces.map(facingOut);
  const sides = outward.map((face) => layoutSide(face, size));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new BufferGeometry();
  outward.forEach((face, side) => {
    const start = positions.length / 3;
    const scaled = face.map((v) => v.clone().multiplyScalar(size));
    for (const { point, uv } of subdivide(scaled, sides[side]!.uvs)) {
      const core = inner(point);
      const out = point.clone().sub(core);
      const normal = out.lengthSq() > 1e-12 ? out.normalize() : sides[side]!.normal.clone();
      const rounded = core.addScaledVector(normal, radius);
      positions.push(rounded.x, rounded.y, rounded.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(...uv);
    }
    geometry.addGroup(start, positions.length / 3 - start, side);
  });
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  return { geometry, sides };
}

/** The nearest point to `p` in the cube |x|, |y|, |z| ≤ half */
const nearestInCube = (half: number) => (p: Vector3) =>
  new Vector3(
    MathUtils.clamp(p.x, -half, half),
    MathUtils.clamp(p.y, -half, half),
    MathUtils.clamp(p.z, -half, half)
  );

/** The nearest point to `p` in the octahedron |x| + |y| + |z| ≤ reach (a projection onto the simplex, by sorting) */
const nearestInOctahedron = (reach: number) => (p: Vector3) => {
  const abs = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)];
  if (abs[0]! + abs[1]! + abs[2]! <= reach) return p.clone();
  const sorted = [...abs].sort((a, b) => b - a);
  let sum = 0;
  let shift = 0;
  sorted.forEach((value, k) => {
    sum += value;
    if (value - (sum - reach) / (k + 1) > 0) shift = (sum - reach) / (k + 1);
  });
  const [x, y, z] = abs.map((value) => Math.max(0, value - shift)) as [number, number, number];
  return new Vector3(Math.sign(p.x) * x, Math.sign(p.y) * y, Math.sign(p.z) * z);
};

/** Half the cube's edge and the octahedron's corner distance, in CSS pixels (the dice scene draws 1 unit as 1 pixel) */
const CUBE_HALF_EDGE = 21;
const OCTAHEDRON_RADIUS = 37;
/** How round the dice's edges are, in CSS pixels */
const CUBE_ROUNDING = 5;
const OCTAHEDRON_ROUNDING = 4;

const shapes = new Map<DieKind, DieShape>();

/** The 3D shape of a die: a cube, or an octahedron for the 8-sided long-range die, with rounded edges. Built once and shared */
export function dieShape(die: DieKind): DieShape {
  let shape = shapes.get(die);
  if (!shape) {
    shape =
      die === "longRange"
        ? buildShape(
            octahedronFaces(),
            OCTAHEDRON_RADIUS,
            OCTAHEDRON_ROUNDING,
            // Its faces are √3·rounding nearer the centre along each axis
            nearestInOctahedron(OCTAHEDRON_RADIUS - Math.sqrt(3) * OCTAHEDRON_ROUNDING)
          )
        : buildShape(cubeFaces(), CUBE_HALF_EDGE, CUBE_ROUNDING, nearestInCube(CUBE_HALF_EDGE - CUBE_ROUNDING));
    shapes.set(die, shape);
  }
  return shape;
}

/** The rotation that shows `side` to the camera (+Z) with its picture upright (+Y) */
export function restingQuaternion(side: DieSideLayout): Quaternion {
  const right = side.up.clone().cross(side.normal);
  const toCamera = new Matrix4().makeBasis(right, side.up, side.normal).transpose();
  return new Quaternion().setFromRotationMatrix(toCamera);
}
