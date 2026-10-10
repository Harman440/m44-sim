/** The width a card's face is laid out at, before it is scaled to the card (CommandCard.css) */
const FACE_WIDTH = 180;

/**
 * Every card on the page is watched by one observer, which writes its width
 * over 180px on it as --card-scale, a plain number. The CSS works the number
 * out too (tan(atan2()) in CommandCard.css), but Safari before 18 gets it
 * wrong when --card-width is in vh or cqh, and the face came out tiny in the
 * card's top-left corner. An observed size is the layout's, before any
 * transform (the hand's tilt, a flight, a flip).
 */
let observer: ResizeObserver | null = null;

function cardObserver(): ResizeObserver | null {
  if (typeof ResizeObserver === "undefined") return null;
  observer ??= new ResizeObserver((entries) => {
    for (const { target, contentRect } of entries) {
      // A hidden card (0 wide) keeps its last scale
      if (contentRect.width > 0) (target as HTMLElement).style.setProperty("--card-scale", String(contentRect.width / FACE_WIDTH));
    }
  });
  return observer;
}

/** The ref of a card (`.game-card`), or of a box exactly its size: keeps its --card-scale up to date */
export function cardScaleRef(el: HTMLElement | null): (() => void) | undefined {
  const watcher = el && cardObserver();
  if (!el || !watcher) return undefined;
  watcher.observe(el);
  return () => watcher.unobserve(el);
}
