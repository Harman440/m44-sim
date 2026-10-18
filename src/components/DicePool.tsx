import { ReactNode, Suspense, lazy, useState } from "react";
import { Box, Stack } from "@mui/material";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Faction } from "../types/faction";
import { BlankDie, Dice3DBoundary, supports3D } from "./DiceResult";
import { defineMessages, useMessages } from "../i18n/useI18n";
import "./DicePool.css";

/** "3 dados", "2 dados de 8 caras": also used by the fire dialogs */
export const DICE_TEXT = defineMessages({
  es: {
    dice: (dice: number, eightSided = false) => `${dice} ${dice === 1 ? "dado" : "dados"}${eightSided ? " de 8 caras" : ""}`,
    and: "y",
  },
  en: {
    dice: (dice: number, eightSided = false) => `${dice} ${eightSided ? "8-sided " : ""}${dice === 1 ? "die" : "dice"}`,
    and: "and",
  },
});

/** The 3D dice, in their own chunk like the rolled ones */
const DicePool3D = lazy(() => import("./dice3d/DicePool3D"));

/** Dice thrown on one kind of die */
export interface DiceOfKind {
  dice: number;
  /** The 8-sided long-range die rather than the battle die */
  eightSided: boolean;
}

/** One entry per die, in the order they're thrown: whether it's the 8-sided die */
const diceKinds = (groups: readonly DiceOfKind[]): boolean[] =>
  groups.flatMap(({ dice, eightSided }) => Array.from({ length: Math.max(0, dice) }, () => eightSided));

/** "3 dados", or "2 dados y 3 dados de 8 caras" for a mixed roll (Concentrated Fire) */
export function useDiceText() {
  const t = useMessages(DICE_TEXT);
  return (groups: readonly DiceOfKind[]): string => {
    const kinds = diceKinds(groups);
    const eight = kinds.filter(Boolean).length;
    const six = kinds.length - eight;
    if (eight === 0 || six === 0) return t.dice(kinds.length, eight > 0);
    return `${t.dice(six)} ${t.and} ${t.dice(eight, true)}`;
  };
}

interface DicePoolProps {
  dice: number;
  /** The 8-sided long-range die rather than the battle die */
  eightSided: boolean;
  /** Concentrated Fire: the dice of the units rolling with it, each group on its own die */
  joined?: readonly DiceOfKind[];
  faction: Faction;
  /** Beside the dice (e.g. an "i" with how the dice add up) */
  children?: ReactNode;
}

/**
 * The 2D dice, without WebGL: a die pops in or out, and the row flips over when the die changes
 * (a mixed roll, Concentrated Fire's, keeps the row and swaps the dice that changed)
 */
function FlatPool({ kinds }: { kinds: readonly boolean[] }) {
  const mixed = kinds.some(Boolean) && !kinds.every(Boolean);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mixed ? "mixed" : kinds[0] ? "d8" : "d6"}
        className="dice-pool__row"
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ rotateY: -90, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeInOut" }}
      >
        <AnimatePresence initial={false}>
          {kinds.map((eightSided, i) => (
            <motion.span
              key={`${i}-${eightSided ? 8 : 6}`}
              className="dice-pool__die"
              initial={{ scale: 0, rotate: -120, y: -18, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 90, y: 18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <BlankDie eightSided={eightSided} />
            </motion.span>
          ))}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * The dice a shot will roll, before it's rolled: blank dice of the kind
 * thrown, in 3D like the roll. A die pops in or drops out as an answer adds
 * or takes one, and the dice are swapped when the die changes.
 */
function DicePool({ dice, eightSided, joined = [], faction, children }: DicePoolProps) {
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const diceText = useDiceText();
  const groups = [{ dice, eightSided }, ...joined];
  const kinds = diceKinds(groups);
  const flat = <FlatPool kinds={kinds} />;

  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      <Box className="dice-pool__row-wrap" data-testid="fire-total" role="img" aria-label={diceText(groups)}>
        {supports3D ? (
          <Dice3DBoundary fallback={flat}>
            {/* Empty slots for the layout; the canvas draws a die on each */}
            <div ref={setRow} className="dice-pool__row dice-pool__row--3d">
              {kinds.map((_, i) => (
                <div key={i} className="die die-3d" data-die-slot />
              ))}
              {row && (
                <Suspense fallback={null}>
                  <DicePool3D
                    container={row}
                    dies={kinds.map((eight) => (eight ? "longRange" : "battle"))}
                    faction={faction}
                    animate={!reduceMotion}
                  />
                </Suspense>
              )}
            </div>
          </Dice3DBoundary>
        ) : (
          flat
        )}
      </Box>
      {children}
    </Stack>
  );
}

export default DicePool;
