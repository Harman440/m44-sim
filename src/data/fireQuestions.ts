// data/fireQuestions.ts
// The situations asked about when a unit fires, and how each answer changes
// the number of dice. To add a situation, add a question to FIRE_QUESTIONS
// (use `appliesTo` to only ask it in some situations).
//
// The numbers start from the official Memoir '44 values; change them to match
// the house rules.
import { DiceStep, FireAnswers, FireContext, FireQuestion } from "../game-core/fireRules";
import { UnitType } from "../game-core/unit";
import { HexType } from "../types/hex";
import { UNIT_LABELS } from "../labels";

/** Base dice by distance to the target (index 0 = adjacent); its length is the unit's range */
export const BASE_DICE_BY_DISTANCE: Record<UnitType, number[]> = {
  [UnitType.INFANTRY]: [3, 2, 1],
  [UnitType.TANK]: [3, 3, 3],
  [UnitType.ARTILLERY]: [3, 3, 2, 2, 1, 1],
};

/** Where the target can be: the board's terrain types plus a bunker */
export type TargetTerrain = HexType | "bunker";

/** Dice lost when the target is in this terrain, by the firing unit's type; answers are the keys, in this order */
export const TARGET_TERRAIN_MODIFIERS: Record<TargetTerrain, { label: string; dice: Record<UnitType, number> }> = {
  plains: { label: "Campo abierto", dice: { infantry: 0, tank: 0, artillery: 0 } },
  forest: { label: "Bosque", dice: { infantry: -1, tank: -2, artillery: 0 } },
  town: { label: "Pueblo", dice: { infantry: -1, tank: -2, artillery: 0 } },
  hill: { label: "Colina", dice: { infantry: -1, tank: -1, artillery: 0 } },
  bunker: { label: "Búnker", dice: { infantry: -1, tank: -2, artillery: 0 } },
};

const YES_NO = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
];

const distanceQuestion: FireQuestion = {
  id: "distance",
  text: "¿A cuántas casillas está el objetivo?",
  options: ({ unitType }) =>
    BASE_DICE_BY_DISTANCE[unitType].map((_, i) => ({
      value: String(i + 1),
      label: i === 0 ? "1 (adyacente)" : String(i + 1),
    })),
  effect: ({ unitType }, answer) => {
    const distance = Number(answer);
    const dice = BASE_DICE_BY_DISTANCE[unitType][distance - 1] ?? 0;
    const hexes = distance === 1 ? "casilla" : "casillas";
    return { label: `Base: ${UNIT_LABELS[unitType]} a ${distance} ${hexes}`, dice };
  },
};

const targetTerrainQuestion: FireQuestion = {
  id: "targetTerrain",
  text: "¿En qué terreno está el objetivo?",
  options: () =>
    Object.entries(TARGET_TERRAIN_MODIFIERS).map(([value, { label }]) => ({ value, label })),
  effect: ({ unitType }, answer) => {
    const terrain = TARGET_TERRAIN_MODIFIERS[answer as TargetTerrain];
    if (!terrain) return null;
    return { label: `Objetivo en ${terrain.label.toLowerCase()}`, dice: terrain.dice[unitType] };
  },
};

/** Adjacent targets are always in sight; further away, blocking terrain or units can hide them */
const lineOfSightQuestion: FireQuestion = {
  id: "lineOfSight",
  text: "¿Tiene línea de visión al objetivo?",
  options: () => YES_NO,
  appliesTo: (_, answers) => Number(answers.distance) > 1,
  effect: () => null,
  blocks: (_, answer) =>
    answer === "no" ? "Sin línea de visión no puede disparar a este objetivo. Elige otro objetivo." : null,
};

/** Sandbags don't change the dice: the target ignores 1 flag when the hits are resolved */
const sandbagsQuestion: FireQuestion = {
  id: "sandbags",
  text: "¿El objetivo está protegido con sacos terreros?",
  options: () => YES_NO,
  effect: () => null,
  note: (_, answer) => (answer === "yes" ? "Sacos terreros: el objetivo ignora 1 bandera." : null),
};

/** Asked in this order; add new situations here */
export const FIRE_QUESTIONS: readonly FireQuestion[] = [
  distanceQuestion,
  lineOfSightQuestion,
  targetTerrainQuestion,
  sandbagsQuestion,
];

/** Extra dice that don't need a question: the command card's bonuses */
export const fireBonusSteps = ({ card }: FireContext, answers: FireAnswers): DiceStep[] => {
  if (!card || !answers.distance) return [];
  const closeAssault = answers.distance === "1";
  const bonus = closeAssault ? card.closeAssaultAdditionalDice : card.rangeAdditionalDice;
  return [{ label: `Carta ${card.name}`, dice: bonus }];
};
