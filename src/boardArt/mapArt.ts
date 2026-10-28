// boardArt/mapArt.ts
// The board art of a map with no painted art (one from Mis mapas), for the menu and the game:
// drawn in the browser by drawBoard.ts, which is fetched only when such a map is shown, and kept
// for each terrain, size and picked tiles, so the menu's thumbnail, its preview and the game share one image.
import { PickedTile, Scenario, Tiles } from "../types/scenario";
import { BoardSize, STANDARD_BOARD, boardSizeOf } from "../game-core/boardSize";

/** Longest a game waits for its map to be drawn before it starts without the art */
export const ART_WAIT_MS = 15_000;

const drawn = new Map<string, Promise<string>>();
const ART_RENDER_VERSION = 5; // Invalidate images made before the church left the towns' random tiles.

/** A map's board art as an image URL (a blob: URL kept for as long as the app is open) */
export function boardArtFor(tiles: Tiles, size: BoardSize = STANDARD_BOARD, picked: PickedTile[] = []): Promise<string> {
  const key = JSON.stringify([ART_RENDER_VERSION, tiles, size.cols, size.rows, picked]);
  let art = drawn.get(key);
  if (!art) {
    art = import("./drawBoard").then(({ drawBoardArt }) => drawBoardArt(tiles, size, { picked }));
    // A failed drawing (no canvas) is tried again next time
    art.catch(() => drawn.delete(key));
    drawn.set(key, art);
  }
  return art;
}

/**
 * The scenario with its board art: its own painted art, or drawn. Without art if it can't be
 * drawn, or isn't by ART_WAIT_MS, so a game always starts
 */
export async function withBoardArt(scenario: Scenario): Promise<Scenario> {
  if (scenario.image) return scenario;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = new Promise<undefined>((resolve) => {
    timer = setTimeout(resolve, ART_WAIT_MS);
  });
  const image = await Promise.race([boardArtFor(scenario.tiles, boardSizeOf(scenario), scenario.pickedTiles).catch(() => undefined), giveUp]);
  clearTimeout(timer);
  return { ...scenario, image };
}
