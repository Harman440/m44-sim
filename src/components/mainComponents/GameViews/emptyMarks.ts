import type { GameSnapshot } from "../../../game-core/gameSession";
import { emptySupplies } from "../../../game-core/unitSupplies";

/**
 * The red marks over this side's units on the map: what each one has run out of (`emptySupplies`).
 * Only this side's, as the snapshot only carries its own units' supplies
 */
export const emptyMarks = (game: GameSnapshot) =>
  game.supplies.flatMap(({ position, supplies }) => {
    const empty = emptySupplies(supplies);
    return empty.length > 0 ? [{ position, supplies: empty }] : [];
  });
