import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Euler, MathUtils, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { DieKind } from "../../game-core/dice";
import { Faction } from "../../types/faction";
import { MARGIN, Point, measureSlots } from "./Dice3D";
import { dieShape, restingQuaternion } from "./dieGeometry";
import { SideTextures, sideTextures } from "./faceTextures";

/** Seconds a die takes to pop in, and to drop out */
const ENTER_TIME = 0.45;
const EXIT_TIME = 0.25;
/** Seconds between one die and the next popping in */
const STAGGER = 0.06;

/** Tipped well over, so a blank die reads as a solid block of wood and not as a face */
const POSE: Record<DieKind, Quaternion> = {
  battle: new Quaternion().setFromEuler(new Euler(-0.5, 0.62, 0.08)),
  attack: new Quaternion().setFromEuler(new Euler(-0.5, 0.62, 0.08)),
  longRange: new Quaternion().setFromEuler(new Euler(-0.32, 0.4, 0)),
};

/** One die of the pool, from when it pops in until it has dropped out */
interface PoolDie {
  id: number;
  die: DieKind;
  /** Its slot in the row */
  index: number;
  /** `performance.now()` when it pops in (later than now when it waits for the old dice to go) */
  bornAt: number;
  /** When it started dropping out; null while it's in the pool */
  leftAt: number | null;
  /** Where it was when it left (its slot is gone by then) */
  at: Point | null;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Overshoots a little before settling: the die lands with a bounce */
const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

interface DieProps {
  pool: PoolDie;
  textures: SideTextures[];
  at: Point;
}

/** A blank die: spins down into its slot, and spins out and drops when it goes */
function Die({ pool, textures, at }: DieProps) {
  const mesh = useRef<Mesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const { geometry, sides } = dieShape(pool.die);

  const [plan] = useState(() => ({
    rest: POSE[pool.die].clone().multiply(restingQuaternion(sides[0]!)),
    axis: new Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize(),
  }));
  const materials = useMemo(
    () => textures.map(({ map, bump }) => new MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.75 })),
    [textures]
  );
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  const spin = useMemo(() => new Quaternion(), []);

  useFrame(() => {
    const object = mesh.current;
    if (!object) return;
    const now = performance.now();
    const born = (now - pool.bornAt) / 1000;
    object.visible = born >= 0;
    const enter = MathUtils.clamp(born / ENTER_TIME, 0, 1);
    const leave = pool.leftAt === null ? 0 : MathUtils.clamp((now - pool.leftAt) / 1000 / EXIT_TIME, 0, 1);

    spin.setFromAxisAngle(plan.axis, -Math.PI * 1.5 * (1 - easeOut(enter)) + Math.PI * leave);
    object.quaternion.copy(spin).multiply(plan.rest);
    object.position.set(at.x, at.y + 28 * (1 - easeOut(enter)) - 24 * leave * leave, 0);
    object.scale.setScalar(Math.max(0.001, easeOutBack(enter) * (1 - leave * leave)));

    if (enter < 1 || (pool.leftAt !== null && leave < 1)) invalidate();
  });

  return <mesh ref={mesh} geometry={geometry} material={materials} visible={false} />;
}

export interface DicePool3DProps {
  /** The row of dice: the canvas covers it, and each die sits on its `[data-die-slot]` */
  container: HTMLElement;
  dice: number;
  die: DieKind;
  faction: Faction;
  /** Pop the dice in and out; otherwise (reduced motion) they simply appear and go */
  animate: boolean;
}

/**
 * The dice a shot will roll, in 3D and blank (nothing rolled yet), on one
 * canvas over the row. A die added pops in, a die taken away drops out, and
 * when the die changes the old dice go and the new ones come in.
 */
function DicePool3D({ container, dice, die, faction, animate }: DicePool3DProps) {
  const [slots, setSlots] = useState<Point[]>(() => measureSlots(container));
  const [pool, setPool] = useState<PoolDie[]>([]);
  // The latest pool and slots, read when the dice change (kept in refs so the change is worked out once)
  const poolRef = useRef<PoolDie[]>([]);
  const slotsRef = useRef<Point[]>(slots);
  const nextId = useRef(0);
  const [textures, setTextures] = useState<Partial<Record<DieKind, SideTextures[]>>>({});

  useLayoutEffect(() => {
    const now = performance.now();
    const live = poolRef.current.filter((d) => d.leftAt === null);
    const leave = (d: PoolDie): PoolDie => ({ ...d, leftAt: now, at: slotsRef.current[d.index] ?? d.at });
    const switching = live.some((d) => d.die !== die);
    const kept = switching ? [] : live.filter((d) => d.index < dice);
    const gone = switching ? live : live.filter((d) => d.index >= dice);
    // New dice wait for the old ones to go when the die changes
    const start = !animate ? -Infinity : now + (switching ? EXIT_TIME * 1000 : 0);
    const added: PoolDie[] = [];
    for (let i = kept.length; i < dice; i++) {
      added.push({ id: nextId.current++, die, index: i, bornAt: start + (i - kept.length) * STAGGER * 1000, leftAt: null, at: null });
    }
    const leaving = animate ? [...poolRef.current.filter((d) => d.leftAt !== null), ...gone.map(leave)] : [];
    const next = [...leaving, ...kept, ...added];
    poolRef.current = next;
    setPool(next);

    const measured = measureSlots(container);
    slotsRef.current = measured;
    setSlots(measured);
  }, [container, dice, die, animate]);

  // Forget the dice that have dropped out
  useEffect(() => {
    if (!pool.some((d) => d.leftAt !== null)) return;
    const timer = setTimeout(() => {
      const now = performance.now();
      const next = poolRef.current.filter((d) => d.leftAt === null || now - d.leftAt < EXIT_TIME * 1000);
      poolRef.current = next;
      setPool(next);
    }, EXIT_TIME * 1000 + 50);
    return () => clearTimeout(timer);
  }, [pool]);

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const measured = measureSlots(container);
      slotsRef.current = measured;
      setSlots(measured);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  // Both dice's blank wood, so switching between them doesn't wait
  useEffect(() => {
    let current = true;
    for (const kind of ["battle", "longRange"] as const) {
      sideTextures(kind, faction, true).then(
        (loaded) => current && setTextures((prev) => ({ ...prev, [kind]: loaded })),
        () => {}
      );
    }
    return () => {
      current = false;
    };
  }, [faction]);

  return (
    <Canvas
      className="dice-3d"
      aria-hidden
      frameloop="demand"
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
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
      {pool.map((d) => {
        const at = d.at ?? slots[d.index];
        const kindTextures = textures[d.die];
        return at && kindTextures ? <Die key={d.id} pool={d} textures={kindTextures} at={at} /> : null;
      })}
    </Canvas>
  );
}

export default DicePool3D;
