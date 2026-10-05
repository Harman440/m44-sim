import { Suspense, lazy, useEffect } from "react";
import { Dice3DBoundary, supports3D } from "./DiceResult";
import type { CardPlay3DProps } from "./card3d/CardPlay3D";

/** The 3D cards (three.js) load in their own chunk, fetched with the game screen so the first card played already flies */
const CardPlay3D = lazy(() => import("./card3d/CardPlay3D"));
if (supports3D) void import("./card3d/CardPlay3D").catch(() => {});

/** Cards can be played in 3D here: WebGL, and the player doesn't ask for less motion */
export function canPlayIn3D(): boolean {
  return supports3D && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Without the 3D cards (no WebGL context, a lost chunk), the turn simply goes on */
function Skip({ onDone }: { onDone: () => void }) {
  useEffect(onDone, [onDone]);
  return null;
}

/**
 * The cards just played fly to the middle of the table in 3D (CardPlay3D),
 * then the turn goes on. Nothing on the page can be tapped meanwhile.
 */
function CardPlay(props: CardPlay3DProps) {
  // Picturing the cards can stall (a font that won't load): the turn goes on anyway
  const { onDone } = props;
  useEffect(() => {
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 1399 }} data-testid="card-play" />
      <Dice3DBoundary fallback={<Skip onDone={props.onDone} />}>
        <Suspense fallback={null}>
          <CardPlay3D {...props} />
        </Suspense>
      </Dice3DBoundary>
    </>
  );
}

export default CardPlay;
