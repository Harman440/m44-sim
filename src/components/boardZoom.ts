import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

/** A part of the board in SVG units: what the viewBox shows */
export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAX_ZOOM = 4;
/** One tap on + or −, one wheel notch */
export const ZOOM_STEP = 1.5;
/** How far in a zoom onto one hex goes, at least (a unit picked from a list) */
export const FOCUS_ZOOM = 1.6;
const WHEEL_STEP = 1.15;
/** A finger has to move this far (px) before a touch is a drag and not a tap */
const DRAG_THRESHOLD = 8;

interface Zoom {
  /** 1 shows the whole board */
  scale: number;
  /** The middle of the part shown, in SVG units */
  cx: number;
  cy: number;
}

/** The part of `full` shown at this zoom, kept inside the board */
export function zoomedView(full: ViewRect, zoom: Zoom): ViewRect {
  const width = full.width / zoom.scale;
  const height = full.height / zoom.scale;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  return {
    x: clamp(zoom.cx - width / 2, full.x, full.x + full.width - width),
    y: clamp(zoom.cy - height / 2, full.y, full.y + full.height - height),
    width,
    height,
  };
}

/** Zooms by `factor` keeping the SVG point (px, py) where it is on the screen */
export function zoomAround(full: ViewRect, zoom: Zoom, factor: number, px: number, py: number): Zoom {
  const scale = Math.min(Math.max(zoom.scale * factor, 1), MAX_ZOOM);
  const view = zoomedView(full, zoom);
  const ratio = zoom.scale / scale;
  const x = px - (px - view.x) * ratio;
  const y = py - (py - view.y) * ratio;
  const next = { scale, cx: x + (view.width * ratio) / 2, cy: y + (view.height * ratio) / 2 };
  // Store the clamped middle, so a pan right after starts from what is shown
  const shown = zoomedView(full, next);
  return { scale, cx: shown.x + shown.width / 2, cy: shown.y + shown.height / 2 };
}

/**
 * Zoom and pan for a board SVG: pinch or the mouse wheel zooms, a drag pans
 * once zoomed in, and `zoomIn`/`zoomOut`/`reset` are for the buttons (touch
 * first: every zoom also works with single taps). A drag doesn't count as a
 * tap on a hex. Spread `handlers` on the element around the SVG.
 */
export function useBoardZoom(full: ViewRect, enabled: boolean) {
  const middle = { scale: 1, cx: full.x + full.width / 2, cy: full.y + full.height / 2 };
  const [zoom, setZoom] = useState<Zoom>(middle);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<number | null>(null);
  const dragged = useRef(false);
  const fullRef = useRef(full);
  fullRef.current = full;

  // A different board (another map, a crop) starts unzoomed
  const fullKey = `${full.x} ${full.y} ${full.width} ${full.height}`;
  useEffect(() => {
    const f = fullRef.current;
    setZoom({ scale: 1, cx: f.x + f.width / 2, cy: f.y + f.height / 2 });
  }, [fullKey]);

  const view = enabled ? zoomedView(full, zoom) : full;

  /** A screen point in SVG units */
  const toSvg = useCallback((clientX: number, clientY: number, shown: ViewRect) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: shown.x + shown.width / 2, y: shown.y + shown.height / 2 };
    return {
      x: shown.x + ((clientX - rect.left) / rect.width) * shown.width,
      y: shown.y + ((clientY - rect.top) / rect.height) * shown.height,
    };
  }, []);

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) =>
      setZoom((current) => {
        const f = fullRef.current;
        const shown = zoomedView(f, current);
        const point =
          clientX === undefined || clientY === undefined
            ? { x: shown.x + shown.width / 2, y: shown.y + shown.height / 2 }
            : toSvg(clientX, clientY, shown);
        return zoomAround(f, current, factor, point.x, point.y);
      }),
    [toSvg]
  );

  // The wheel listener can't be passive: it stops the page from scrolling
  useEffect(() => {
    const svg = svgRef.current;
    if (!enabled || !svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, event.clientX, event.clientY);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [enabled, zoomAt]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (pointers.current.size === 0) dragged.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    start.current = { x: event.clientX, y: event.clientY };
    pinch.current = pointers.current.size === 2 ? distance() : null;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const now = distance();
      const [a, b] = [...pointers.current.values()];
      dragged.current = true;
      if (now > 0) zoomAt(now / pinch.current, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      pinch.current = now;
      return;
    }
    if (pointers.current.size !== 1 || zoom.scale <= 1 || !start.current) return;
    if (!dragged.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) < DRAG_THRESHOLD) return;
    // Only a real drag captures the pointer: a tap's click must still reach its hex
    if (!dragged.current) (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    dragged.current = true;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    setZoom((current) => {
      const shown = zoomedView(fullRef.current, current);
      const moved = { ...current, cx: shown.x + shown.width / 2 - (dx / rect.width) * shown.width, cy: shown.y + shown.height / 2 - (dy / rect.height) * shown.height };
      const kept = zoomedView(fullRef.current, moved);
      return { ...moved, cx: kept.x + kept.width / 2, cy: kept.y + kept.height / 2 };
    });
  };

  const onPointerEnd = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    const rest = [...pointers.current.values()][0];
    start.current = rest ?? null;
  };

  /** A drag or a pinch ends with a click: it isn't a tap on a hex */
  const onClickCapture = (event: React.MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  return {
    svgRef,
    view,
    zoomed: enabled && zoom.scale > 1,
    canZoomIn: zoom.scale < MAX_ZOOM,
    zoomIn: () => zoomAt(ZOOM_STEP),
    zoomOut: () => zoomAt(1 / ZOOM_STEP),
    /** Center the view on an SVG point, zoomed in at least `FOCUS_ZOOM` (never out) */
    focusOn: (x: number, y: number) =>
      setZoom((current) => {
        const f = fullRef.current;
        const shown = zoomedView(f, { scale: Math.max(current.scale, FOCUS_ZOOM), cx: x, cy: y });
        return { scale: Math.max(current.scale, FOCUS_ZOOM), cx: shown.x + shown.width / 2, cy: shown.y + shown.height / 2 };
      }),
    reset: () => setZoom(middle),
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture }
      : {},
  };
}
