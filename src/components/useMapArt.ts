// components/useMapArt.ts
import { useEffect, useState } from "react";
import { Scenario, Tiles } from "../types/scenario";
import { boardArtFor } from "../boardArt/mapArt";

/** A scenario's board art: its painted art, or for a map from Mis mapas the art drawn for it (once it's ready) */
export function useMapArt(scenario: Scenario | undefined): string | undefined {
  const [drawn, setDrawn] = useState<{ tiles: Tiles; url: string }>();
  useEffect(() => {
    if (!scenario || scenario.image) return;
    let current = true;
    const { tiles } = scenario;
    boardArtFor(tiles).then(
      (url) => current && setDrawn({ tiles, url }),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [scenario]);
  return scenario?.image ?? (drawn && drawn.tiles === scenario?.tiles ? drawn.url : undefined);
}
