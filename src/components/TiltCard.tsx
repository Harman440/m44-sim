import { ReactNode, useRef, type PointerEvent } from "react";
import "./TiltCard.css";

/** How far the card leans toward the pointer, in degrees */
const MAX_TILT = 12;

/**
 * A card that leans toward the finger or the mouse, as if pressed, with a
 * gloss following it. Only a look: the card under it still gets every tap.
 * Set straight on the element (no React state), so it follows every move.
 */
function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const follow = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    el.style.setProperty("--tilt-x", `${(0.5 - y) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--tilt-y", `${(x - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--gloss-x", `${x * 100}%`);
    el.style.setProperty("--gloss-y", `${y * 100}%`);
    el.classList.add("tilt-card--active");
  };

  const release = () => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--tilt-x");
    el.style.removeProperty("--tilt-y");
    el.classList.remove("tilt-card--active");
  };

  return (
    <div
      ref={ref}
      className="tilt-card"
      onPointerDown={follow}
      onPointerMove={follow}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      {children}
    </div>
  );
}

export default TiltCard;
