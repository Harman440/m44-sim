import { Component, CSSProperties, ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { motion, useReducedMotion } from "motion/react";
import { DieFace, DieKind, SIDES_OF } from "../game-core/dice";
import { ShotTarget, faceHits } from "../data/hitRules";
import { Faction } from "../types/faction";
import { defineMessages, useLabels, useMessages } from "../i18n/useI18n";
import { DIE_STAGGER, ROLL_TIME } from "./diceTiming";
import DieFaceIcon, { OCTAGON } from "./DieFaceIcon";
import "./DiceResult.css";

export { rollDuration } from "./diceTiming";

const TEXT = defineMessages({
  es: {
    pickDie: (n: number, face: string) => `Dado ${n}: ${face}`,
    discarded: "(descartado)",
  },
  en: {
    pickDie: (n: number, face: string) => `Die ${n}: ${face}`,
    discarded: "(discarded)",
  },
});

/** The 3D dice (three.js) load in their own chunk, fetched early so the first roll is already 3D */
const Dice3D = lazy(() => import("./dice3d/Dice3D"));
export const supports3D = typeof window !== "undefined" && typeof window.WebGL2RenderingContext !== "undefined";
if (supports3D) void import("./dice3d/Dice3D").catch(() => {});

/** Falls back to the 2D dice if the 3D ones fail (no WebGL context, a lost chunk) */
export class Dice3DBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A die before it's rolled: its shape (the battle die or the 8-sided one) with no face showing */
export function BlankDie({ eightSided = false }: { eightSided?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={eightSided ? "die die--d8" : "die"} aria-hidden="true">
      {eightSided ? (
        <>
          <polygon className="die__face" points={OCTAGON} strokeLinejoin="round" />
          <text x="24" y="30" className="die__d8-mark die__d8-mark--blank" textAnchor="middle">
            8
          </text>
        </>
      ) : (
        <rect className="die__face" x="2" y="2" width="44" height="44" rx="9" />
      )}
    </svg>
  );
}

export interface DiceRoll {
  faces: DieFace[];
  /** Changes on every roll so the dice animate again */
  id: number;
}

interface RollingDieProps {
  face: DieFace;
  index: number;
  faction: Faction;
  die: DieKind;
  /** Tumble in; otherwise the die is simply there */
  rolling: boolean;
}

/**
 * One die. When rolled it's thrown in, spinning, showing random faces until
 * it lands on its result. With reduced motion it just appears.
 */
function RollingDie({ face, index, faction, die, rolling }: RollingDieProps) {
  const reduceMotion = useReducedMotion();
  const tumble = rolling && !reduceMotion;
  const [shown, setShown] = useState<DieFace | null>(tumble ? null : face);

  useEffect(() => {
    if (!tumble) return;
    const sides = SIDES_OF[die];
    const spin = setInterval(() => setShown(sides[Math.floor(Math.random() * sides.length)]!), 70);
    const land = setTimeout(() => {
      clearInterval(spin);
      setShown(face);
    }, (ROLL_TIME * 0.8 + index * DIE_STAGGER) * 1000);
    return () => {
      clearInterval(spin);
      clearTimeout(land);
    };
  }, [tumble, face, index, die]);

  const direction = index % 2 === 0 ? 1 : -1;
  return (
    <motion.div
      className="dice-result__throw"
      initial={tumble ? { x: -80 * direction, y: -70, rotate: -400 * direction, scale: 0.5, opacity: 0 } : false}
      animate={{ x: 0, y: [null, 0, -12, 0], rotate: 0, scale: [null, 1.08, 0.97, 1], opacity: 1 }}
      transition={{ duration: ROLL_TIME, delay: index * DIE_STAGGER, times: [0, 0.6, 0.8, 1], ease: "easeOut" }}
    >
      <DieFaceIcon face={shown ?? face} faction={faction} eightSided={die === "longRange"} />
    </motion.div>
  );
}

/** One roll's row of 3D dice: holds the row from its ref and when the roll was shown, and forgets both on a new roll (remounted) */
function ThrownRow({
  children,
}: {
  children: (row: HTMLDivElement | null, setRow: (row: HTMLDivElement | null) => void, shownAt: number) => ReactNode;
}) {
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const [shownAt] = useState(() => performance.now());
  return children(row, setRow, shownAt);
}

interface DiceResultProps {
  roll: DiceRoll;
  faction: Faction;
  /** The dice whose results are applied (indexes into the faces); the rest show as discarded. Null: all */
  kept?: readonly number[] | null;
  /** The die rolled (the battle die by default) */
  die?: DieKind;
  /** Picking the dice to apply: every die is a toggle button */
  picking?: { selected: readonly number[]; onToggle: (index: number) => void };
  /** What the dice were rolled at: a die that hits it glows */
  target?: ShotTarget;
  /** The dice were just rolled: throw them in */
  rolling?: boolean;
  /** How many of the last dice were added already showing their face (Heat of Battle's flag): never thrown */
  placed?: number;
}

/** The faces of a roll; a die that hits glows */
function DiceResult({
  roll,
  faction,
  kept = null,
  die = "battle",
  picking,
  target,
  rolling = false,
  placed = 0,
}: DiceResultProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const applied = (i: number) => (picking ? picking.selected.includes(i) : kept === null || kept.includes(i));
  const hitColor = useTheme().palette.error.main;
  const reduceMotion = useReducedMotion();
  const thrown = roll.faces.length - placed;
  /** This die is thrown in now (not one added already showing its face) */
  const throws = (i: number) => rolling && i < thrown;

  /** The row of dice; each die is drawn by `drawDie`, and `over` is laid over the row */
  const dice = (
    drawDie: (face: DieFace, i: number) => ReactNode,
    rowRef?: (row: HTMLDivElement | null) => void,
    over?: ReactNode
  ) => (
    // Keyed by roll so every roll replays the animation
    <div key={roll.id} ref={rowRef} className="dice-result" data-testid="dice-result">
      {roll.faces.map((face, i) => {
        const hit = applied(i) && !!target && faceHits(face, target);
        return (
          <div
            key={i}
            className={`dice-result__die${applied(i) ? "" : " dice-result__die--discarded"}${hit ? " dice-result__die--hit" : ""}`}
            style={hit ? ({ "--die-effect-color": hitColor } as CSSProperties) : undefined}
          >
            {/* The die stays mounted whether or not the dice are being picked, so it doesn't roll again */}
            <div className="dice-result__slot">
              {drawDie(face, i)}
              {picking && (
                <button
                  type="button"
                  className="dice-result__pick"
                  aria-pressed={applied(i)}
                  aria-label={t.pickDie(i + 1, labels.dieFaces[face])}
                  onClick={() => picking.onToggle(i)}
                />
              )}
            </div>
            {!applied(i) && <span className="dice-result__discarded">{t.discarded}</span>}
          </div>
        );
      })}
      {over}
    </div>
  );

  const flat = dice((face, i) => <RollingDie face={face} index={i} faction={faction} die={die} rolling={throws(i)} />);
  if (!supports3D) return <Box sx={{ mt: 1.5 }}>{flat}</Box>;

  // In 3D each slot is an empty spot of the die's size, for the layout and the glow of a hit
  return (
    <Box sx={{ mt: 1.5 }}>
      <Dice3DBoundary fallback={flat}>
        <ThrownRow key={roll.id}>
          {(row, setRow, shownAt) =>
            dice(
              (face, i) => (
                <div
                  className="die die-3d"
                  data-die-slot
                  role="img"
                  aria-label={labels.dieFaces[face]}
                  // A hit glows once its die has landed
                  style={{ animationDelay: throws(i) && !reduceMotion ? `${ROLL_TIME + i * DIE_STAGGER}s` : "0s" }}
                />
              ),
              setRow,
              row && (
                // Only the canvas waits for its chunk (fetched early, above): suspending the row would drop its ref
                <Suspense fallback={null}>
                  <Dice3D
                    container={row}
                    faces={roll.faces}
                    die={die}
                    faction={faction}
                    dimmed={roll.faces.map((_, i) => !applied(i))}
                    tumble={rolling && !reduceMotion}
                    placed={roll.faces.map((_, i) => i >= thrown)}
                    thrownAt={shownAt}
                  />
                </Suspense>
              )
            )
          }
        </ThrownRow>
      </Dice3DBoundary>
    </Box>
  );
}

export default DiceResult;
