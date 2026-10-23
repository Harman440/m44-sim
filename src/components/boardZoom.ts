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
  /** 1 fills the box the board is drawn in (the whole board when the box has its shape); below 1, down to the whole board */
  scale: number;
  /** The middle of the part shown, in SVG units */
  cx: number;
  cy: number;
}

/**
 * The part of `full` shown unzoomed in a box of this aspect (width / height): the board cropped to
 * fill the box, top and bottom or the sides cut off. The whole board without an aspect
 */
export function baseSize(full: ViewRect, aspect: number | null): { width: number; height: number } {
  if (!aspect) return { width: full.width, height: full.height };
  return aspect > full.width / full.height
    ? { width: full.width, height: full.width / aspect }
    : { width: full.height * aspect, height: full.height };
}

/** The smallest zoom: the whole board in sight (the box shows space beside it) */
export const minScale = (full: ViewRect, aspect: number | null): number => {
  const base = baseSize(full, aspect);
  return Math.min(base.width / full.width, base.height / full.height);
};

/** The part of `full` shown at this zoom, kept inside the board; never more than the board */
export function zoomedView(full: ViewRect, zoom: Zoom, aspect: number | null = null): ViewRect {
  const base = baseSize(full, aspect);
  const width = Math.min(base.width / zoom.scale, full.width);
  const height = Math.min(base.height / zoom.scale, full.height);
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  return {
    x: clamp(zoom.cx - width / 2, full.x, full.x + full.width - width),
    y: clamp(zoom.cy - height / 2, full.y, full.y + full.height - height),
    width,
    height,
  };
}

/** Zooms by `factor` keeping the SVG point (px, py) where it is on the screen */
export function zoomAround(full: ViewRect, zoom: Zoom, factor: number, px: number, py: number, aspect: number | null = null): Zoom {
  const scale = Math.min(Math.max(zoom.scale * factor, minScale(full, aspect)), MAX_ZOOM);
  const view = zoomedView(full, zoom, aspect);
  const after = zoomedView(full, { ...zoom, scale }, aspect);
  const rx = after.width / view.width;
  const ry = after.height / view.height;
  const x = px - (px - view.x) * rx;
  const y = py - (py - view.y) * ry;
  const next = { scale, cx: x + after.width / 2, cy: y + after.height / 2 };
  // Store the clamped middle, so a pan right after starts from what is shown
  const shown = zoomedView(full, next, aspect);
  return { scale, cx: shown.x + shown.width / 2, cy: shown.y + shown.height / 2 };
}

/** The SVG's box, width / height, while `on`: null until it's laid out */
function useBoxAspect(svgRef: React.RefObject<SVGSVGElement | null>, on: boolean): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!on || !svg || typeof ResizeObserver === "undefined") {
      setAspect(null);
      return;
    }
    // Inside the border, which the viewBox doesn't cover
    const measure = () => setAspect(svg.clientWidth > 0 && svg.clientHeight > 0 ? svg.clientWidth / svg.clientHeight : null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [svgRef, on]);
  return aspect;
}

/** Landscape, where the game screens give the board a box of its own to fill */
function useLandscape(): boolean {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(orientation: landscape)") : null;
  const [landscape, setLandscape] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const update = () => setLandscape(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [query?.media]); // eslint-disable-line react-hooks/exhaustive-deps
  return landscape;
}

/**
 * Zoom and pan for a board SVG: pinch or the mouse wheel zooms, a drag pans
 * the part not in sight, and `zoomIn`/`zoomOut`/`reset` are for the buttons (touch
 * first: every zoom also works with single taps). A drag doesn't count as a
 * tap on a hex. Spread `handlers` on the element around the SVG.
 *
 * Two fingers pan as they pinch. Without `dragPans`, one finger never pans (the map editor's
 * finger paints): only two fingers do, or one once `dragPans` is turned on. With `startsWhole`,
 * it starts with the whole board in sight, not cropped to the box, until the player zooms or pans.
 *
 * In landscape the game screens give the SVG a box of its own (CSS): unzoomed, the board fills
 * it, cropped to its shape, and zooming out shows the whole board. Elsewhere the SVG takes the
 * board's shape and unzoomed is the whole board.
 */
export function useBoardZoom(full: ViewRect, enabled: boolean, dragPans = true, startsWhole = false) {
  const middle = { scale: 1, cx: full.x + full.width / 2, cy: full.y + full.height / 2 };
  const [zoom, setZoom] = useState<Zoom>(middle);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<number | null>(null);
  const dragged = useRef(false);
  /** The player hasn't zoomed or panned this board yet */
  const untouched = useRef(true);
  const fullRef = useRef(full);
  fullRef.current = full;
  const landscape = useLandscape();
  const aspect = useBoxAspect(svgRef, enabled && landscape);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  // A different board (another map, a crop) starts unzoomed
  const fullKey = `${full.x} ${full.y} ${full.width} ${full.height}`;
  useEffect(() => {
    const f = fullRef.current;
    untouched.current = true;
    setZoom({ scale: 1, cx: f.x + f.width / 2, cy: f.y + f.height / 2 });
  }, [fullKey]);
  // …or, with `startsWhole`, zoomed out to the whole board once the box is measured
  useEffect(() => {
    if (startsWhole && untouched.current) setZoom((current) => ({ ...current, scale: minScale(fullRef.current, aspect) }));
  }, [startsWhole, aspect, fullKey]);

  const view = enabled ? zoomedView(full, zoom, aspect) : full;
  // Some of the board is out of sight: a drag pans to it
  const pannable = enabled && (view.width < full.width - 0.5 || view.height < full.height - 0.5);

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
    (factor: number, clientX?: number, clientY?: number) => {
      untouched.current = false;
      setZoom((current) => {
        const f = fullRef.current;
        const a = aspectRef.current;
        const shown = zoomedView(f, current, a);
        const point =
          clientX === undefined || clientY === undefined
            ? { x: shown.x + shown.width / 2, y: shown.y + shown.height / 2 }
            : toSvg(clientX, clientY, shown);
        return zoomAround(f, current, factor, point.x, point.y, a);
      });
    },
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

  /** Moves what's shown by a drag of (dx, dy) screen pixels, kept inside the board */
  const panBy = (dx: number, dy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    untouched.current = false;
    setZoom((current) => {
      const a = aspectRef.current;
      const shown = zoomedView(fullRef.current, current, a);
      const moved = { ...current, cx: shown.x + shown.width / 2 - (dx / rect.width) * shown.width, cy: shown.y + shown.height / 2 - (dy / rect.height) * shown.height };
      const kept = zoomedView(fullRef.current, moved, a);
      return { ...moved, cx: kept.x + kept.width / 2, cy: kept.y + kept.height / 2 };
    });
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
      // The fingers' middle moved half as far as this one
      panBy((event.clientX - last.x) / 2, (event.clientY - last.y) / 2);
      return;
    }
    if (pointers.current.size !== 1 || !pannable || !dragPans || !start.current) return;
    if (!dragged.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) < DRAG_THRESHOLD) return;
    // Only a real drag captures the pointer: a tap's click must still reach its hex
    if (!dragged.current) (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    dragged.current = true;
    panBy(event.clientX - last.x, event.clientY - last.y);
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
    /** Not as it starts: the buttons can zoom out or put it back */
    zoomed: enabled && zoom.scale !== 1,
    pannable,
    canZoomIn: zoom.scale < MAX_ZOOM,
    canZoomOut: zoom.scale > minScale(full, aspect) + 1e-6,
    zoomIn: () => zoomAt(ZOOM_STEP),
    zoomOut: () => zoomAt(1 / ZOOM_STEP),
    /** Center the view on an SVG point, zoomed in at least `FOCUS_ZOOM` (never out) */
    focusOn: (x: number, y: number) => {
      untouched.current = false;
      setZoom((current) => {
        const f = fullRef.current;
        const shown = zoomedView(f, { scale: Math.max(current.scale, FOCUS_ZOOM), cx: x, cy: y }, aspectRef.current);
        return { scale: Math.max(current.scale, FOCUS_ZOOM), cx: shown.x + shown.width / 2, cy: shown.y + shown.height / 2 };
      });
    },
    /** The whole board in sight */
    reset: () => setZoom({ ...middle, scale: minScale(full, aspect) }),
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture }
      : {},
  };
}
