// components/useHexFlash.ts
import { useEffect, useRef, useState } from "react";
import { Position } from "../types/scenario";
import { HexFlash } from "./Board";

// Must be at least the hexagon-flash-invalid animation in Hexagon.css
export const INVALID_FLASH_MS = 450;

/** Red flash for an invalid tap: pass `flash` to Board, call `flashInvalid(position)` */
export function useHexFlash() {
  const [flash, setFlash] = useState<HexFlash | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), INVALID_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const flashInvalid = (position: Position) => {
    counter.current += 1;
    setFlash({ position, id: counter.current });
  };

  return { flash, flashInvalid };
}
