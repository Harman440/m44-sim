// components/useMapArt.ts
import { useEffect, useState } from "react";
import { Scenario, Tiles } from "../types/scenario";
import { boardArtFor } from "../boardArt/mapArt";
import { boardSizeOf } from "../game-core/boardSize";

/** A scenario's board art: its painted art, or for a map from Mis mapas the art drawn for it (once it's ready) */
export function useMapArt(scenario: Scenario | undefined): string | undefined {
  const [drawn, setDrawn] = useState<{ tiles: Tiles; board: Scenario["board"]; picked: Scenario["pickedTiles"]; url: string }>();
  useEffect(() => {
    if (!scenario || scenario.image) return;
    let current = true;
    const { tiles, board, pickedTiles: picked } = scenario;
    boardArtFor(tiles, boardSizeOf(scenario), picked).then(
      (url) => current && setDrawn({ tiles, board, picked, url }),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [scenario]);
  const same = drawn && drawn.tiles === scenario?.tiles && drawn.board === scenario?.board && drawn.picked === scenario?.pickedTiles;
  return scenario?.image ?? (same ? drawn.url : undefined);
}
