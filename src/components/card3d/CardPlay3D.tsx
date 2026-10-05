import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Shape,
  ShapeGeometry,
  Texture,
} from "three";
import { FACE_HEIGHT, FACE_WIDTH, backTexture, faceTexture, shadowTexture } from "./cardTextures";

/** How long a played card flies, in seconds, and how long it rests on the table after */
export const FLIGHT_TIME = 1.25;
const REST_TIME = 0.3;
/** The camera's field of view: narrow, so the card keeps its shape and only leans */
const FOV = 30;
/** How high the card is lifted off the table (toward the player), in CSS pixels */
const LIFT = 170;
/** The combat card takes off a moment after the command card */
const STAGGER = 0.12;

/** A point on the screen, in scene units: 1 per CSS pixel, from the centre of the window, y up */
interface Point {
  x: number;
  y: number;
}

export interface PlayedCard3D {
  /** The card on the page (`.game-card`): where it takes off from, and what its face looks like */
  element: HTMLElement;
}

export interface CardPlay3DProps {
  cards: readonly PlayedCard3D[];
  /** Where the cards land, on the page (the middle of the table) */
  landing: { x: number; y: number };
  /** The command card touches the table */
  onLanded: () => void;
  /** The flight is over (or couldn't start): the turn goes on */
  onDone: () => void;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t ** 3;
/** How far `t` is through [from, to], clamped to 0–1 */
const span = (t: number, from: number, to: number) => MathUtils.clamp((t - from) / (to - from), 0, 1);

function toScene(x: number, y: number): Point {
  return { x: x - window.innerWidth / 2, y: window.innerHeight / 2 - y };
}

/** The card's outline, 1 wide and 1.4 high, centred, with the face's rounded corners */
function cardShape(radius: number): Shape {
  const w = 0.5;
  const h = 0.7;
  const shape = new Shape();
  shape.moveTo(-w + radius, -h);
  shape.lineTo(w - radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h + radius);
  shape.lineTo(w, h - radius);
  shape.quadraticCurveTo(w, h, w - radius, h);
  shape.lineTo(-w + radius, h);
  shape.quadraticCurveTo(-w, h, -w, h - radius);
  shape.lineTo(-w, -h + radius);
  shape.quadraticCurveTo(-w, -h, -w + radius, -h);
  return shape;
}

/** A flat side of the card, its picture stretched over the whole outline */
function sideGeometry(shape: Shape): ShapeGeometry {
  const geometry = new ShapeGeometry(shape, 8);
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[2 * i] = position.getX(i) + 0.5;
    uv[2 * i + 1] = (position.getY(i) + 0.7) / 1.4;
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  return geometry;
}

interface CardGeometry {
  side: ShapeGeometry;
  edge: ExtrudeGeometry;
  /** The card's thickness, in card widths */
  thickness: number;
}

function cardGeometry(): CardGeometry {
  const thickness = 0.012;
  // The face's corner: 1.5 × the look's radius, at 180px wide (about 6px)
  const shape = cardShape(6 / FACE_WIDTH);
  const edge = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 8 });
  edge.translate(0, 0, -thickness / 2);
  return { side: sideGeometry(shape), edge, thickness };
}

/** Keeps 1 scene unit = 1 CSS pixel on the table (z = 0), whatever the window's size */
function FitCamera() {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const height = useThree((state) => state.size.height);
  useEffect(() => {
    camera.position.set(0, 0, height / 2 / Math.tan(MathUtils.degToRad(FOV / 2)));
    camera.far = camera.position.z * 3;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, height]);
  return null;
}

interface FlyingCardProps {
  face: Texture;
  back: Texture;
  shadow: Texture;
  geometry: CardGeometry;
  from: Point;
  to: Point;
  /** The card's width on the page, and on the table when it lands */
  fromWidth: number;
  toWidth: number;
  /** Seconds after the flight starts that this card takes off */
  delay: number;
  /** Turned a little as it lands, as a card tossed down is */
  landingTurn: number;
  startedAt: number;
}

/**
 * One card in flight: it lifts off the table toward the player, turns over
 * once in the light on its way to the middle of the table, and slaps down.
 */
function FlyingCard({ face, back, shadow, geometry, from, to, fromWidth, toWidth, delay, landingTurn, startedAt }: FlyingCardProps) {
  const card = useRef<Group>(null);
  const shade = useRef<Mesh>(null);

  const materials = useMemo(() => {
    const paper = { roughness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.35 };
    return {
      face: new MeshPhysicalMaterial({ map: face, ...paper }),
      back: new MeshPhysicalMaterial({ map: back, ...paper }),
      edge: new MeshStandardMaterial({ color: "#efe6d2", roughness: 0.9 }),
      shadow: new MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, side: DoubleSide }),
    };
  }, [face, back, shadow]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  useFrame(() => {
    const group = card.current;
    const under = shade.current;
    if (!group || !under) return;
    const t = MathUtils.clamp(((performance.now() - startedAt) / 1000 - delay) / FLIGHT_TIME, 0, 1);

    const lift = easeOut(span(t, 0, 0.3));
    const travel = easeInOut(span(t, 0.12, 0.82));
    const turn = easeInOut(span(t, 0.22, 0.8));
    const drop = easeIn(span(t, 0.8, 0.92));
    const bounce = Math.sin(span(t, 0.92, 1) * Math.PI);

    const height = LIFT * lift * (1 - drop) + 6 * bounce;
    group.position.set(MathUtils.lerp(from.x, to.x, travel), MathUtils.lerp(from.y, to.y, travel), height);
    // Tips its top toward the player as it lifts, and comes down flat
    group.rotation.set(-0.35 * lift * (1 - drop), turn * Math.PI * 2, landingTurn * travel - 0.1 * Math.sin(turn * Math.PI));
    const width = MathUtils.lerp(fromWidth, toWidth, travel);
    group.scale.set(width, width, width);

    // The shadow stays on the table: wider, fainter and further off the higher the card is
    under.position.set(group.position.x + height * 0.18, group.position.y - height * 0.3, -1);
    under.scale.set(width * (1.15 + height / 300), width * 1.4 * (1.1 + height / 300), 1);
    materials.shadow.opacity = 0.75 - (0.45 * height) / LIFT;
  });

  return (
    <>
      <mesh ref={shade} material={materials.shadow}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={card}>
        <mesh geometry={geometry.side} material={materials.face} position={[0, 0, geometry.thickness / 2 + 0.0005]} />
        <mesh geometry={geometry.side} material={materials.back} position={[0, 0, -geometry.thickness / 2 - 0.0005]} rotation={[0, Math.PI, 0]} />
        <mesh geometry={geometry.edge} material={materials.edge} />
      </group>
    </>
  );
}

interface Takeoff {
  face: Texture;
  from: Point;
  width: number;
}

/**
 * The cards just played, in 3D: on one canvas over the whole window, each
 * card on the page is replaced by a 3D copy of itself (a picture of its face
 * on a thin card) that flies to the middle of the table. The cards on the
 * page are hidden while their copies fly.
 */
function CardPlay3D({ cards, landing, onLanded, onDone }: CardPlay3DProps) {
  const [takeoffs, setTakeoffs] = useState<Takeoff[] | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const callbacks = useRef({ onLanded, onDone });
  callbacks.current = { onLanded, onDone };

  const geometry = useMemo(cardGeometry, []);
  const back = useMemo(backTexture, []);
  const shadow = useMemo(shadowTexture, []);
  useEffect(
    () => () => {
      geometry.side.dispose();
      geometry.edge.dispose();
      back.dispose();
      shadow.dispose();
    },
    [geometry, back, shadow]
  );

  // Picture each card, then swap it for its 3D copy
  useEffect(() => {
    let current = true;
    Promise.all(cards.map(({ element }) => faceTexture(element))).then(
      (faces) => {
        if (!current) return;
        setTakeoffs(
          cards.map(({ element }, i) => {
            const box = element.getBoundingClientRect();
            return { face: faces[i]!, from: toScene(box.left + box.width / 2, box.top + box.height / 2), width: box.width };
          })
        );
        setStartedAt(performance.now());
      },
      () => current && callbacks.current.onDone()
    );
    return () => {
      current = false;
    };
  }, [cards]);
  useEffect(() => () => takeoffs?.forEach(({ face }) => face.dispose()), [takeoffs]);

  // Hide the cards on the page while their copies fly
  useEffect(() => {
    if (!takeoffs) return;
    const hidden = cards.map(({ element }) => element);
    hidden.forEach((element) => (element.style.opacity = "0"));
    return () => hidden.forEach((element) => (element.style.opacity = ""));
  }, [takeoffs, cards]);

  // The landing, then the end
  useEffect(() => {
    if (!takeoffs) return;
    const landed = setTimeout(() => callbacks.current.onLanded(), FLIGHT_TIME * 920);
    const done = setTimeout(() => callbacks.current.onDone(), ((takeoffs.length - 1) * STAGGER + FLIGHT_TIME + REST_TIME) * 1000);
    return () => {
      clearTimeout(landed);
      clearTimeout(done);
    };
  }, [takeoffs]);

  const to = toScene(landing.x, landing.y);
  const toWidth = Math.min(220, window.innerHeight * 0.3);

  return (
    <Canvas
      aria-hidden
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: FOV, near: 1, far: 5000 }}
      style={{ position: "fixed", inset: 0, zIndex: 1400, pointerEvents: "none" }}
    >
      <FitCamera />
      <ambientLight intensity={1.1} />
      <directionalLight position={[-300, 500, 700]} intensity={1.1} />
      <pointLight position={[250, 150, 400]} intensity={0.5} decay={0} />
      {takeoffs?.map(({ face, from, width }, i) => (
        <FlyingCard
          key={i}
          face={face}
          back={back}
          shadow={shadow}
          geometry={geometry}
          from={from}
          to={{ x: to.x + i * toWidth * 0.55, y: to.y - i * 20 }}
          fromWidth={width}
          toWidth={i === 0 ? toWidth : toWidth * 0.8}
          delay={i * STAGGER}
          landingTurn={i === 0 ? -0.05 : 0.12}
          startedAt={startedAt}
        />
      ))}
    </Canvas>
  );
}

export default CardPlay3D;
