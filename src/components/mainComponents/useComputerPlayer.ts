import { useEffect } from "react";
import PassAndPlayMatch from "../../game-core/passAndPlay";
import { aiStep } from "../../game-core/ai/aiStep";
import { standardBrain } from "../../game-core/ai/standardBrain";

/** More steps than any phase needs: a computer that keeps acting is stopped rather than hanging the page */
const MAX_STEPS = 500;

/** The computer's next action in the match, if it has one now */
export const computerStep = (match: PassAndPlayMatch): boolean =>
  match.computer !== null && aiStep(match, match.computer, standardBrain);

/**
 * Plays the computer's side outside the battle (its paradrop, cards, orders and final phase), at
 * once: the person sees none of it. The shared battle drives it itself, one shot at a time
 */
export function useComputerPlayer(match: PassAndPlayMatch, snapshot: unknown, inBattle: boolean) {
  useEffect(() => {
    if (match.computer === null || inBattle) return;
    for (let steps = 0; steps < MAX_STEPS && computerStep(match); steps++);
  }, [match, snapshot, inBattle]);
}
