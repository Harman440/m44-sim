import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Euler, MathUtils, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { DieFace, DieKind, SIDES_OF } from "../../game-core/dice";
import { Faction } from "../../types/faction";
import { DIE_STAGGER, ROLL_TIME } from "../diceTiming";
import { dieShape, restingQuaternion } from "./dieGeometry";
import { SideTextures, prepareWood, sideTextures } from "./faceTextures";

// This chunk is fetched ahead of the first roll (see DiceResult): draw the wood while nothing else is going on
prepareWood();

/** How far round the dice the canvas reaches, in CSS pixels, so a thrown die isn't cut off */
const MARGIN = 72;
/**
 * The resting die leans a little so it reads as 3D, with its result facing
 * the player. The octahedron barely leans: tipped, its neighbouring sides
 * take over and it looks as if it lay on an edge.
 */
const LEAN: Record<DieKind, Quaternion> = {
  battle: new Quaternion().setFromEuler(new Euler(-0.2, 0.22, 0)),
  attack: new Quaternion().setFromEuler(new Euler(-0.2, 0.22, 0)),
  longRange: new Quaternion().setFromEuler(new Euler(-0.06, 0.07, 0)),
};

interface Point {
  x: number;
  y: number;
}

export interface Dice3DProps {
  /** The row of dice: the canvas covers it, and each die rests on its `[data-die-slot]` */
  container: HTMLElement;
  faces: readonly DieFace[];
  die: DieKind;
  faction: Faction;
  /** Per die: its result isn't applied, so it's drawn faded */
  dimmed: readonly boolean[];
  /** Throw the dice in; otherwise they are simply there */
  tumble: boolean;
  /**
   * When the dice were thrown (`performance.now()`): they land on the same
   * clock as the rest of the roll (the reading, the glow of a hit), even if
   * the 3D dice are ready a moment later
   */
  thrownAt: number;
}

/** Where each slot's centre is, in scene units (1 per CSS pixel, from the canvas centre, y up). Layout offsets, so a dialog's transform doesn't skew them */
function measureSlots(container: HTMLElement): Point[] {
  const slots = [...container.querySelectorAll<HTMLElement>("[data-die-slot]")];
  return slots.map((slot) => {
    let left = slot.offsetWidth / 2;
    let top = slot.offsetHeight / 2;
    for (let el: HTMLElement | null = slot; el && el !== container; el = el.offsetParent as HTMLElement | null) {
      left += el.offsetLeft;
      top += el.offsetTop;
    }
    return { x: left - container.offsetWidth / 2, y: container.offsetHeight / 2 - top };
  });
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

interface DieProps {
  face: DieFace;
  die: DieKind;
  textures: SideTextures[];
  at: Point;
  index: number;
  dimmed: boolean;
  tumble: boolean;
  thrownAt: number;
}

/** One die: thrown from the side, spinning, until it rests showing `face` */
function Die({ face, die, textures, at, index, dimmed, tumble, thrownAt }: DieProps) {
  const mesh = useRef<Mesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const { geometry, sides } = dieShape(die);

  // Picked once per die: which of the sides showing `face` lands up, and how it spins in
  const [throwPlan] = useState(() => {
    const matching = SIDES_OF[die].flatMap((side, i) => (side === face ? [i] : []));
    const side = matching[Math.floor(Math.random() * matching.length)] ?? 0;
    return {
      rest: LEAN[die].clone().multiply(restingQuaternion(sides[side]!)),
      axis: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spin: (2 + Math.random() * 1.5) * Math.PI * 2,
      from: index % 2 === 0 ? 1 : -1,
    };
  });

  const materials = useMemo(
    () =>
      textures.map(
        ({ map, bump }) =>
          new MeshStandardMaterial({
            map,
            bumpMap: bump,
            bumpScale: 0.6,
            roughness: 0.75,
            color: dimmed ? "#9a9a9a" : "#ffffff",
            transparent: dimmed,
            opacity: dimmed ? 0.35 : 1,
          })
      ),
    [textures, dimmed]
  );
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  const spinning = useMemo(() => new Quaternion(), []);

  useFrame(() => {
    const object = mesh.current;
    if (!object) return;
    const elapsed = tumble ? (performance.now() - thrownAt) / 1000 - index * DIE_STAGGER : Infinity;
    object.visible = elapsed >= 0;
    const t = MathUtils.clamp(elapsed / ROLL_TIME, 0, 1);

    // Spins down onto its result, flies in over the first 60% and bounces once
    const settle = easeOut(Math.min(1, t / 0.85));
    spinning.setFromAxisAngle(throwPlan.axis, -throwPlan.spin * (1 - settle));
    object.quaternion.copy(throwPlan.rest).multiply(spinning);
    const flight = easeOut(Math.min(1, t / 0.6));
    const bounce = t > 0.6 ? Math.sin(((t - 0.6) / 0.4) * Math.PI) * 12 : 0;
    object.position.set(
      at.x - 80 * throwPlan.from * (1 - flight),
      at.y + 70 * (1 - flight) + bounce,
      60 * (1 - flight)
    );
    object.scale.setScalar(0.5 + 0.5 * flight);

    if (t < 1) invalidate();
  });

  return <mesh ref={mesh} geometry={geometry} material={materials} visible={false} />;
}

/**
 * A roll's dice in 3D, on one canvas laid over the row of dice (a WebGL
 * context per die would run out on a tablet). The row keeps the layout, the
 * glow of a hit and the buttons to pick dice; the canvas only draws.
 */
function Dice3D({ container, faces, die, faction, dimmed, tumble, thrownAt }: Dice3DProps) {
  const [slots, setSlots] = useState<Point[]>(() => measureSlots(container));
  const [textures, setTextures] = useState<SideTextures[] | null>(null);

  useLayoutEffect(() => {
    const measure = () => setSlots(measureSlots(container));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container, faces.length]);

  useEffect(() => {
    let current = true;
    sideTextures(die, faction).then(
      (loaded) => current && setTextures(loaded),
      () => {}
    );
    return () => {
      current = false;
    };
  }, [die, faction]);

  return (
    <Canvas
      className="dice-3d"
      aria-hidden
      frameloop="demand"
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      // Orthographic at zoom 1: 1 unit is 1 CSS pixel, and every die is seen the same wherever it is in a wide row
      orthographic
      camera={{ position: [0, 0, 500], near: 1, far: 1000, zoom: 1 }}
      style={{
        position: "absolute",
        left: -MARGIN,
        top: -MARGIN,
        width: `calc(100% + ${2 * MARGIN}px)`,
        height: `calc(100% + ${2 * MARGIN}px)`,
        pointerEvents: "none",
      }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[-1, 2, 3]} intensity={1.8} />
      {textures &&
        faces.map((face, i) =>
          slots[i] ? (
            <Die
              key={i}
              face={face}
              die={die}
              textures={textures}
              at={slots[i]}
              index={i}
              dimmed={dimmed[i] ?? false}
              tumble={tumble}
              thrownAt={thrownAt}
            />
          ) : null
        )}
    </Canvas>
  );
}

export default Dice3D;
