// game-core/fireRules.ts
// Engine for the "how many dice?" questionnaire shown when a unit fires.
// The questions themselves (and their dice effects) live in data/fireQuestions.ts.
import CommandCard from "./commandCard";
import { UnitType } from "./unit";

/** What we know about the shot before asking anything */
export interface FireContext {
  unitType: UnitType;
  /** The command card played this turn (may add dice) */
  card: CommandCard | null;
}

/** Answers so far, by question id -> option value */
export type FireAnswers = Readonly<Record<string, string>>;

export interface FireOption {
  value: string;
  label: string;
}

/** One labelled line of the dice calculation, e.g. "Objetivo en bosque: -1" */
export interface DiceStep {
  label: string;
  dice: number;
}

export interface FireQuestion {
  id: string;
  /** Shown to the player */
  text: string;
  options: (context: FireContext) => FireOption[];
  /** Skip the question when it doesn't apply; defaults to always asking */
  appliesTo?: (context: FireContext, answers: FireAnswers) => boolean;
  /** How the chosen answer changes the dice (null for no change) */
  effect: (context: FireContext, answer: string, answers: FireAnswers) => DiceStep | null;
}

export interface FireDiceResult {
  dice: number;
  steps: DiceStep[];
}

const applies = (question: FireQuestion, context: FireContext, answers: FireAnswers) =>
  question.appliesTo?.(context, answers) ?? true;

/** The next question still to answer, or null when the questionnaire is complete */
export function nextFireQuestion(
  questions: readonly FireQuestion[],
  context: FireContext,
  answers: FireAnswers
): FireQuestion | null {
  return (
    questions.find((q) => !(q.id in answers) && applies(q, context, answers)) ?? null
  );
}

/**
 * Add up the dice from every answered question that applies, plus any extra
 * dice from `extraSteps` (e.g. command card bonuses). Never below 0.
 */
export function calculateFireDice(
  questions: readonly FireQuestion[],
  context: FireContext,
  answers: FireAnswers,
  extraSteps: (context: FireContext, answers: FireAnswers) => DiceStep[] = () => []
): FireDiceResult {
  const steps = questions
    .filter((q) => q.id in answers && applies(q, context, answers))
    .map((q) => q.effect(context, answers[q.id]!, answers))
    .filter((step): step is DiceStep => step !== null && step.dice !== 0)
    .concat(extraSteps(context, answers).filter((step) => step.dice !== 0));

  const total = steps.reduce((sum, step) => sum + step.dice, 0);
  return { dice: Math.max(0, total), steps };
}
