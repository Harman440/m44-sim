// components/useHexFlash.ts
import { useEffect, useRef, useState } from "react";
import { Position } from "../types/scenario";
import { HexFlash } from "./Board";

// Must be at least the hexagon-flash-invalid animation in Hexagon.css
export const INVALID_FLASH_MS = 450;

/** Flashes when hexes are pointed out (`flashHexes`), so the player's eye finds them */
const POINT_OUT_FLASHES = 3;

/**
 * Red flash on the board: pass `flash` to Board, call `flashInvalid(position)` for a tap
 * that can't be done, or `flashHexes(positions)` to point some hexes out
 */
export function useHexFlash() {
  const [flash, setFlash] = useState<HexFlash | null>(null);
  const counter = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), INVALID_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const flashAt = (positions: readonly Position[]) => {
    counter.current += 1;
    setFlash({ positions, id: counter.current });
  };

  const flashInvalid = (position: Position) => flashAt([position]);

  /** Flash some hexes a few times, starting after `delay` ms (e.g. once a dialog over the board has gone) */
  const flashHexes = (positions: readonly Position[], delay = 0) => {
    timers.current.forEach(clearTimeout);
    timers.current = Array.from({ length: POINT_OUT_FLASHES }, (_, i) =>
      setTimeout(() => flashAt(positions), delay + i * (INVALID_FLASH_MS + 150)),
    );
  };

  return { flash, flashInvalid, flashHexes };
}
