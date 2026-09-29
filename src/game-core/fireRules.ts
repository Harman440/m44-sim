// game-core/fireRules.ts
// Engine for the "how many dice?" questionnaire shown when a unit fires.
// The questions themselves (and their dice effects) live in data/fireQuestions.ts.
import CommandCard from "./commandCard";
import type { DiceBonusEffect } from "./combatCard";
import { UnitType } from "./unit";
import { HexType } from "../types/hex";

/** What we know about the shot before asking anything */
export interface FireContext {
  unitType: UnitType;
  /** The command card played this turn (may add dice) */
  card: CommandCard | null;
  /** The unit may only fire at an adjacent enemy (Close Assault card) */
  closeAssaultOnly?: boolean;
  /** A battle combat card played this turn that this unit could use on this shot (Spotter…) */
  combatBonus?: DiceBonusEffect & { name: string };
  /** The terrain the unit fires from (a unit on a hill fires at another hill as if it were open ground) */
  fromTerrain?: HexType;
  /** The unit fires from a hex with barbed wire (infantry loses a die) */
  fromWire?: boolean;
}

/** Answers so far, by question id -> option value */
export type FireAnswers = Readonly<Record<string, string>>;

export interface FireOption {
  value: string;
  label: string;
}

/** What a line of the dice calculation is about, to draw it as an icon */
export type DiceStepKind = "base" | "terrain" | "sandbags" | "card" | "collision" | "wire";

/** One labelled line of the dice calculation, e.g. "Objetivo en bosque: -1" */
export interface DiceStep {
  label: string;
  dice: number;
  /** Left out in shots saved before the steps had kinds; those show their label */
  kind?: DiceStepKind;
}

export interface FireQuestion {
  id: string;
  /** Shown to the player */
  text: string;
  /** The text when it depends on the situation (e.g. the combat card's name); overrides `text` */
  textFor?: (context: FireContext) => string;
  options: (context: FireContext) => FireOption[];
  /** Skip the question when it doesn't apply; defaults to always asking */
  appliesTo?: (context: FireContext, answers: FireAnswers) => boolean;
  /** How the chosen answer changes the dice (null for no change) */
  effect: (context: FireContext, answer: string, answers: FireAnswers) => DiceStep | null;
  /** Why this answer means the unit can't fire at this target (e.g. no line of sight), or null */
  blocks?: (context: FireContext, answer: string) => string | null;
  /** A reminder shown with the result that doesn't change the dice (e.g. "ignores 1 flag"), or null */
  note?: (context: FireContext, answer: string) => string | null;
}

export interface FireDiceResult {
  dice: number;
  steps: DiceStep[];
  /** Reminders for resolving the hits on the table */
  notes: string[];
  /** The unit can't fire at this target, and why; the shot shouldn't be taken */
  blocked: string | null;
}

const applies = (question: FireQuestion, context: FireContext, answers: FireAnswers) =>
  question.appliesTo?.(context, answers) ?? true;

const answered = (questions: readonly FireQuestion[], context: FireContext, answers: FireAnswers) =>
  questions.filter((q) => q.id in answers && applies(q, context, answers));

/** Why the answers so far rule the shot out, or null */
function blockedBy(questions: readonly FireQuestion[], context: FireContext, answers: FireAnswers): string | null {
  for (const q of answered(questions, context, answers)) {
    const reason = q.blocks?.(context, answers[q.id]!);
    if (reason) return reason;
  }
  return null;
}

/** The next question still to answer, or null when the questionnaire is complete (or the shot is blocked) */
export function nextFireQuestion(
  questions: readonly FireQuestion[],
  context: FireContext,
  answers: FireAnswers
): FireQuestion | null {
  if (blockedBy(questions, context, answers)) return null;
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
  const blocked = blockedBy(questions, context, answers);
  if (blocked) return { dice: 0, steps: [], notes: [], blocked };

  const relevant = answered(questions, context, answers);
  const steps = relevant
    .map((q) => q.effect(context, answers[q.id]!, answers))
    .filter((step): step is DiceStep => step !== null && step.dice !== 0)
    .concat(extraSteps(context, answers).filter((step) => step.dice !== 0));
  const notes = relevant
    .map((q) => q.note?.(context, answers[q.id]!) ?? null)
    .filter((note): note is string => note !== null);

  const total = steps.reduce((sum, step) => sum + step.dice, 0);
  return { dice: Math.max(0, total), steps, notes, blocked: null };
}
