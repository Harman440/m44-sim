// A shot for tests that don't care how the dice were worked out: at a target
// in the open, adjacent for a close assault and 2 hexes away otherwise.
import GameSession from "../game-core/gameSession";
import { ShotTarget } from "../data/hitRules";
import { TARGET_INFANTRY, TARGET_OTHER } from "../data/fireQuestions";

export const shoot = (
  session: GameSession,
  orderIndex: number,
  { infantry, closeAssault }: Pick<ShotTarget, "infantry" | "closeAssault">
): boolean =>
  session.fire(orderIndex, {
    distance: closeAssault ? "1" : "2",
    ...(closeAssault ? {} : { lineOfSight: "yes" }),
    targetType: infantry ? TARGET_INFANTRY : TARGET_OTHER,
    targetTerrain: "plains",
    sandbags: "no",
  });
