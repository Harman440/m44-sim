import { useLayoutEffect, useRef, useState } from "react";

/**
 * For text in a fixed-size card: true when it doesn't fit, so the card can
 * fade it out at the edge instead of cutting a line in half. Rechecked when
 * the box is resized (a card shown larger) or `content` changes.
 */
export function useFadeWhenClipped<T extends HTMLElement>(content?: unknown) {
  const ref = useRef<T>(null);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => setClipped(element.scrollHeight > element.clientHeight + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content]);

  return [ref, clipped] as const;
}
