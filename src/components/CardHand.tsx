import { ReactNode, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import "./CardHand.css";

export interface HandCard {
  key: string;
  node: ReactNode;
  /** Raised out of the fan: picked, or being looked at */
  lifted?: boolean;
}

interface CardHandProps {
  cards: readonly HandCard[];
  /** Names the row for screen readers, e.g. "Cartas de mando" */
  label: string;
  /** How much of the card before it each card covers, as a fraction of a card width */
  overlap?: number;
  className?: string;
}

/** Mouse drags shorter than this are still taps */
const DRAG_THRESHOLD = 6;

/**
 * Cards held in the hand: a slight fan, each overlapping the one before it.
 * When they don't fit, the row scrolls sideways: swipe on a tablet, drag or
 * use the wheel with a mouse. A pressed or lifted card rises out of the fan.
 */
function CardHand({ cards, label, overlap = 0.12, className }: CardHandProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const count = cards.length;
  // Fewer cards fan out more; a big hand stays almost flat
  const angle = Math.min(2.5, 10 / Math.max(count, 1));
  const arc = Math.min(3, 10 / Math.max(count, 1));

  // Touch scrolls natively; a mouse drags the row like a hand of cards
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !rowRef.current) return;
    drag.current = { x: e.clientX, scrollLeft: rowRef.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const row = rowRef.current;
    if (!start || !row) return;
    const dx = e.clientX - start.x;
    if (!start.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!start.moved) {
      start.moved = true;
      setDragging(true);
      row.setPointerCapture(e.pointerId);
    }
    row.scrollLeft = start.scrollLeft - dx;
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  // A drag isn't a tap on the card under the pointer
  const onClickCapture = (e: React.MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
  };
  // A mouse wheel scrolls the row sideways
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    row.scrollLeft += e.deltaY;
  };

  return (
    <div
      ref={rowRef}
      role="list"
      aria-label={label}
      className={`card-hand${dragging ? " card-hand--dragging" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--overlap": overlap } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      onWheel={onWheel}
    >
      {cards.map(({ key, node, lifted }, i) => {
        const offset = i - (count - 1) / 2;
        return (
          <div
            key={key}
            role="listitem"
            className={`card-hand__slot${lifted ? " card-hand__slot--lifted" : ""}`}
            style={
              {
                "--tilt": `${offset * angle}deg`,
                "--drop": `${offset * offset * arc}px`,
                zIndex: i + 1,
              } as React.CSSProperties
            }
          >
            {node}
          </div>
        );
      })}
    </div>
  );
}

export default CardHand;
