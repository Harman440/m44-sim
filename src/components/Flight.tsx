import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";

/** A box on the screen, as getBoundingClientRect gives it */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How long a flight takes, without its delay */
export const FLIGHT_MS = 550;

export const boxOf = (element: Element | null | undefined): Box | null => {
  if (!element) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

/** A box of the given size centred on another: where a small thing (a supply crate) starts or ends its flight */
export const centredBox = (box: Box, width: number, height = width): Box => ({
  left: box.left + box.width / 2 - width / 2,
  top: box.top + box.height / 2 - height / 2,
  width,
  height,
});

interface FlightProps {
  /** What flies; a card is drawn at the larger box's width (`--card-width`) */
  children: ReactNode;
  from: Box;
  to: Box;
  /** Waits this long (ms) where it starts: for flights one after the other */
  delay?: number;
  /** Fades out as it lands (a combat card leaving the game) */
  fade?: boolean;
  /** Called once it has landed; the timer is the source of truth, so it also ends with reduced motion */
  onDone: () => void;
}

/**
 * Something moving from one place on the screen to another: a card from the
 * deck into the hand, from the hand to the discard pile, supplies to the
 * counter. It is drawn over everything (a portal), at the larger of the two
 * boxes so a card shrinking into a small pile stays sharp, and scaled to the
 * other. With reduced motion (GameView's MotionConfig) it is simply there.
 */
function Flight({ children, from, to, delay = 0, fade = false, onDone }: FlightProps) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const timer = setTimeout(() => done.current(), delay + FLIGHT_MS);
    return () => clearTimeout(timer);
  }, [delay]);

  const base = from.width >= to.width ? from : to;
  const pose = (box: Box) => ({
    x: box.left + box.width / 2 - (base.left + base.width / 2),
    y: box.top + box.height / 2 - (base.top + base.height / 2),
    scale: box.width / base.width,
  });

  return createPortal(
    <motion.div
      className="flight"
      aria-hidden
      data-testid="flight"
      style={
        {
          position: "fixed",
          left: base.left,
          top: base.top,
          width: base.width,
          zIndex: 1250,
          pointerEvents: "none",
          transformOrigin: "50% 50%",
          "--card-width": `${base.width}px`,
        } as React.CSSProperties
      }
      initial={{ ...pose(from), rotate: -8, opacity: 1 }}
      animate={{ ...pose(to), rotate: 0, opacity: fade ? 0 : 1 }}
      transition={{ duration: FLIGHT_MS / 1000, delay: delay / 1000, ease: [0.3, 0.7, 0.4, 1] }}
    >
      {children}
    </motion.div>,
    document.body
  );
}

export default Flight;
