import { CSSProperties, useEffect, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { motion, useReducedMotion } from "motion/react";
import { DIE_SIDES, DieFace, LONG_RANGE_DIE_SIDES } from "../game-core/dice";
import { ShotTarget, faceEarnsCoin, faceHits, faceRetreats } from "../data/hitRules";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { unitSprite } from "./UnitComponent";
import { DIE_FACE_LABELS } from "../labels";
import "./DiceResult.css";

/** The outline of an 8-sided die, drawn as an octagon so it can't be mistaken for the normal die */
const OCTAGON = "16,2 32,2 46,16 46,32 32,46 16,46 2,32 2,16";

/** One die showing `face`; infantry and tank faces reuse the player's unit art */
export function DieFaceIcon({ face, faction, eightSided = false }: { face: DieFace; faction: Faction; eightSided?: boolean }) {
  const symbol = (() => {
    switch (face) {
      case DieFace.INFANTRY:
        return <image href={unitSprite(faction, UnitType.INFANTRY)} x="8" y="6" width="32" height="36" />;
      case DieFace.TANK:
        return <image href={unitSprite(faction, UnitType.TANK)} x="6" y="6" width="36" height="36" />;
      case DieFace.GRENADE:
        return (
          <g>
            <ellipse cx="24" cy="29" rx="10" ry="12" fill="#4b5320" />
            <rect x="20" y="12" width="8" height="6" rx="1" fill="#333" />
            <path d="M28 14 q9 -3 6 9" stroke="#333" strokeWidth="3" fill="none" />
          </g>
        );
      case DieFace.STAR:
        return (
          <polygon
            points="24,7 28.9,18.6 41.5,19.5 31.9,27.7 34.9,40 24,33.3 13.1,40 16.1,27.7 6.5,19.5 19.1,18.6"
            fill="#d4a017"
          />
        );
      case DieFace.FLAG:
        return (
          <g>
            <rect x="14" y="8" width="3" height="32" fill="#333" />
            <path d="M17 9 L38 15 L17 22 Z" fill="#c62828" />
          </g>
        );
      case DieFace.MISS:
        // A blank side: only a faint dash
        return <rect x="16" y="22.5" width="16" height="3" rx="1.5" fill="#333" opacity="0.35" />;
    }
  })();

  return (
    <svg viewBox="0 0 48 48" className={eightSided ? "die die--d8" : "die"} role="img" aria-label={DIE_FACE_LABELS[face]}>
      {eightSided ? (
        <>
          <polygon className="die__face" points={OCTAGON} strokeLinejoin="round" />
          {/* "8" in the corner, so the long-range die reads as its own die */}
          <text x="40" y="44" className="die__d8-mark" textAnchor="middle">
            8
          </text>
        </>
      ) : (
        <rect className="die__face" x="2" y="2" width="44" height="44" rx="9" />
      )}
      {symbol}
    </svg>
  );
}

export interface DiceRoll {
  faces: DieFace[];
  /** Changes on every roll so the dice animate again */
  id: number;
}

/** What a die does to the target once it lands: marked on the die */
type DieEffect = "hit" | "retreat" | "coin" | null;

const dieEffect = (face: DieFace, target: ShotTarget | undefined, withCoins: boolean): DieEffect => {
  if (!target) return null;
  if (faceHits(face, target)) return "hit";
  if (faceRetreats(face)) return "retreat";
  if (withCoins && faceEarnsCoin(face, target)) return "coin";
  return null;
};

/** How long the dice take to land, in seconds, so what they mean can show after */
export const rollDuration = (dice: number): number => ROLL_TIME + Math.max(0, dice - 1) * DIE_STAGGER;
const ROLL_TIME = 0.75;
const DIE_STAGGER = 0.12;

interface RollingDieProps {
  face: DieFace;
  index: number;
  faction: Faction;
  eightSided: boolean;
  /** Tumble in; otherwise the die is simply there */
  rolling: boolean;
}

/**
 * One die. When rolled it's thrown in, spinning, showing random faces until
 * it lands on its result. With reduced motion it just appears.
 */
function RollingDie({ face, index, faction, eightSided, rolling }: RollingDieProps) {
  const reduceMotion = useReducedMotion();
  const tumble = rolling && !reduceMotion;
  const [shown, setShown] = useState<DieFace | null>(tumble ? null : face);

  useEffect(() => {
    if (!tumble) return;
    const sides = eightSided ? LONG_RANGE_DIE_SIDES : DIE_SIDES;
    const spin = setInterval(() => setShown(sides[Math.floor(Math.random() * sides.length)]!), 70);
    const land = setTimeout(() => {
      clearInterval(spin);
      setShown(face);
    }, (ROLL_TIME * 0.8 + index * DIE_STAGGER) * 1000);
    return () => {
      clearInterval(spin);
      clearTimeout(land);
    };
  }, [tumble, face, index, eightSided]);

  const direction = index % 2 === 0 ? 1 : -1;
  return (
    <motion.div
      className="dice-result__throw"
      initial={tumble ? { x: -80 * direction, y: -70, rotate: -400 * direction, scale: 0.5, opacity: 0 } : false}
      animate={{ x: 0, y: [null, 0, -12, 0], rotate: 0, scale: [null, 1.08, 0.97, 1], opacity: 1 }}
      transition={{ duration: ROLL_TIME, delay: index * DIE_STAGGER, times: [0, 0.6, 0.8, 1], ease: "easeOut" }}
    >
      <DieFaceIcon face={shown ?? face} faction={faction} eightSided={eightSided} />
    </motion.div>
  );
}

const EFFECT_LABELS: Record<Exclude<DieEffect, null>, string> = {
  hit: "impacto",
  retreat: "retirada",
  coin: "suministro",
};

interface DiceResultProps {
  roll: DiceRoll;
  faction: Faction;
  /** The dice whose results are applied (indexes into the faces); the rest show as discarded. Null: all */
  kept?: readonly number[] | null;
  /** Rolled on the 8-sided long-range die */
  eightSided?: boolean;
  /** Picking the dice to apply: every die is a toggle button */
  picking?: { selected: readonly number[]; onToggle: (index: number) => void };
  /** What the dice were rolled at: each die is marked with what it does (hit, retreat, coin) */
  target?: ShotTarget;
  withCoins?: boolean;
  /** The dice were just rolled: throw them in */
  rolling?: boolean;
}

/** The faces of a roll, each marked with what it does to the target */
function DiceResult({
  roll,
  faction,
  kept = null,
  eightSided = false,
  picking,
  target,
  withCoins = false,
  rolling = false,
}: DiceResultProps) {
  const applied = (i: number) => (picking ? picking.selected.includes(i) : kept === null || kept.includes(i));
  const reduceMotion = useReducedMotion();
  const { palette } = useTheme();
  const effectColors = {
    hit: palette.error,
    retreat: palette.primary,
    coin: palette.warning,
  } as const;
  const landed = (i: number) => (rolling && !reduceMotion ? ROLL_TIME + i * DIE_STAGGER : 0);

  return (
    <Box sx={{ mt: 1.5 }}>
      {/* Keyed by roll so every roll replays the animation */}
      <div key={roll.id} className="dice-result" data-testid="dice-result">
        {roll.faces.map((face, i) => {
          const effect = applied(i) ? dieEffect(face, target, withCoins) : null;
          const die = <RollingDie face={face} index={i} faction={faction} eightSided={eightSided} rolling={rolling} />;
          return (
            <div
              key={i}
              className={`dice-result__die${applied(i) ? "" : " dice-result__die--discarded"}${
                effect ? ` dice-result__die--${effect}` : ""
              }`}
              style={
                effect
                  ? ({
                      "--die-effect-color": effectColors[effect].main,
                      "--die-effect-on": effectColors[effect].contrastText,
                    } as CSSProperties)
                  : undefined
              }
            >
              {/* The die stays mounted whether or not the dice are being picked, so it doesn't roll again */}
              <div className="dice-result__slot">
                {die}
                {picking && (
                  <button
                    type="button"
                    className="dice-result__pick"
                    aria-pressed={applied(i)}
                    aria-label={`Dado ${i + 1}: ${DIE_FACE_LABELS[face]}`}
                    onClick={() => picking.onToggle(i)}
                  />
                )}
              </div>
              {effect && (
                <motion.span
                  className="dice-result__effect"
                  initial={landed(i) ? { scale: 0, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 16, delay: landed(i) }}
                >
                  {EFFECT_LABELS[effect]}
                </motion.span>
              )}
              {!applied(i) && <span className="dice-result__discarded">(descartado)</span>}
            </div>
          );
        })}
      </div>
    </Box>
  );
}

export default DiceResult;
