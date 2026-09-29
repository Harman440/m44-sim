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

/** Terrain that blocks line of sight when it lies between the firing unit and its target (the ends don't count) */
export const SIGHT_BLOCKING_TERRAIN: readonly HexType[] = [HexType.FOREST, HexType.TOWN, HexType.HILL, HexType.HEDGEROW];

/**
 * Units that can take ground after a close assault that eliminates or pushes
 * back the target, and fire once more (house rule: in close assault only).
 * Infantry can too with Fragor del combate.
 */
export const TAKE_GROUND_UNIT_TYPES: readonly UnitType[] = [UnitType.TANK];

/** Where the target can be: the board's terrain types plus a bunker */
export type TargetTerrain = HexType | "bunker";

/** Dice lost when the target is in this terrain, by the firing unit's type; answers are the keys, in this order */
export const TARGET_TERRAIN_MODIFIERS: Record<TargetTerrain, { label: string; dice: Record<UnitType, number> }> = {
  plains: { label: "Campo abierto", dice: { infantry: 0, tank: 0, artillery: 0 } },
  forest: { label: "Bosque", dice: { infantry: -1, tank: -2, artillery: 0 } },
  town: { label: "Pueblo", dice: { infantry: -1, tank: -2, artillery: 0 } },
  hill: { label: "Colina", dice: { infantry: -1, tank: -1, artillery: 0 } },
  hedgerow: { label: "Seto", dice: { infantry: -1, tank: -2, artillery: 0 } },
  bunker: { label: "Búnker", dice: { infantry: -1, tank: -2, artillery: 0 } },
};

const YES_NO = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
];

const distanceQuestion: FireQuestion = {
  id: "distance",
  text: "¿A cuántas casillas está el objetivo?",
  options: ({ unitType, closeAssaultOnly }) =>
    BASE_DICE_BY_DISTANCE[unitType].slice(0, closeAssaultOnly ? 1 : undefined).map((_, i) => ({
      value: String(i + 1),
      label: i === 0 ? "1 (adyacente)" : String(i + 1),
    })),
  effect: ({ unitType }, answer) => {
    const distance = Number(answer);
    const dice = BASE_DICE_BY_DISTANCE[unitType][distance - 1] ?? 0;
    const hexes = distance === 1 ? "casilla" : "casillas";
    return { label: `Base: ${UNIT_LABELS[unitType]} a ${distance} ${hexes}`, dice, kind: "base" };
  },
};

/** Doesn't change the dice: the target's type decides which faces hit (data/hitRules.ts) */
export const targetTypeQuestion: FireQuestion = {
  id: "targetType",
  text: "¿Qué tipo de unidad es el objetivo?",
  options: () => Object.values(UnitType).map((value) => ({ value, label: UNIT_LABELS[value] })),
  effect: () => null,
};

/**
 * The terrain that counts for the shot: official hill rule, a unit on a hill
 * fires at a unit on another hill (the same height) as if it were open ground.
 */
export const effectiveTerrain = ({ fromTerrain }: FireContext, answer: string | undefined): TargetTerrain | undefined =>
  answer === HexType.HILL && fromTerrain === HexType.HILL ? HexType.PLAINS : (answer as TargetTerrain | undefined);

const targetTerrainQuestion: FireQuestion = {
  id: "targetTerrain",
  text: "¿En qué terreno está el objetivo?",
  options: () =>
    Object.entries(TARGET_TERRAIN_MODIFIERS).map(([value, { label }]) => ({ value, label })),
  effect: (context, answer) => {
    const terrain = TARGET_TERRAIN_MODIFIERS[effectiveTerrain(context, answer)!];
    if (!terrain) return null;
    return { label: `Objetivo en ${terrain.label.toLowerCase()}`, dice: terrain.dice[context.unitType], kind: "terrain" };
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

/**
 * Dice lost against a target behind sandbags in the open (house rule), by the
 * firing unit's type. Artillery never loses dice to cover, sandbags included.
 */
export const SANDBAGS_IN_THE_OPEN: Record<UnitType, number> = {
  [UnitType.INFANTRY]: -1,
  [UnitType.TANK]: -1,
  [UnitType.ARTILLERY]: 0,
};

/**
 * Sandbags: the target ignores 1 flag when the hits are resolved (whoever
 * fires) and, in the open (where no terrain protects it), the shot loses a die
 * too, except artillery's.
 */
const sandbagsQuestion: FireQuestion = {
  id: "sandbags",
  text: "¿El objetivo está protegido con sacos terreros?",
  options: () => YES_NO,
  effect: (context, answer, answers) =>
    answer === "yes" &&
    effectiveTerrain(context, answers.targetTerrain) === HexType.PLAINS &&
    SANDBAGS_IN_THE_OPEN[context.unitType] !== 0
      ? { label: "Sacos terreros en campo abierto", dice: SANDBAGS_IN_THE_OPEN[context.unitType], kind: "sandbags" }
      : null,
  note: (_, answer) => (answer === "yes" ? "Sacos terreros: el objetivo ignora 1 bandera." : null),
};

/** A battle combat card that adds dice to one shot (Spotter, Street Fight, Explosives) */
export const combatBonusQuestion: FireQuestion = {
  id: "combatCard",
  text: "",
  textFor: ({ combatBonus }) =>
    combatBonus?.condition
      ? `${combatBonus.name}: ${combatBonus.condition} Si es así, ¿la usas en este disparo?`
      : `${combatBonus?.name}: ¿la usas en este disparo?`,
  options: () => YES_NO,
  appliesTo: ({ combatBonus }, answers) =>
    !!combatBonus &&
    !!answers.distance &&
    (combatBonus.closeAssault === undefined || combatBonus.closeAssault === (answers.distance === "1")),
  effect: ({ combatBonus }, answer) =>
    combatBonus && answer === "yes" ? { label: `Carta ${combatBonus.name}`, dice: combatBonus.dice, kind: "card" } : null,
};

/** Asked in this order; add new situations here */
export const FIRE_QUESTIONS: readonly FireQuestion[] = [
  distanceQuestion,
  lineOfSightQuestion,
  targetTypeQuestion,
  targetTerrainQuestion,
  sandbagsQuestion,
  combatBonusQuestion,
];

/** The command card's dice, when it changes them in this situation */
const cardSteps = ({ unitType, card }: FireContext, closeAssault: boolean): DiceStep[] => {
  const dice = card?.fireBonusFor(unitType, closeAssault) ?? 0;
  return card && dice !== 0 ? [{ label: `Carta ${card.name}`, dice, kind: "card" }] : [];
};

/** Extra dice that don't need a question: the command card's bonuses */
export const fireBonusSteps = (context: FireContext, answers: FireAnswers): DiceStep[] =>
  answers.distance ? cardSteps(context, answers.distance === "1") : [];

/**
 * A collision in the movement phase (two units cross or land on the same hex):
 * close assault dice − 1, plus the card's close-assault bonus. Terrain is ignored.
 */
export const collisionSteps = (context: FireContext): DiceStep[] => [
  {
    label: `Base: ${UNIT_LABELS[context.unitType]} en choque`,
    dice: BASE_DICE_BY_DISTANCE[context.unitType][0] ?? 0,
    kind: "base",
  },
  { label: "Choque", dice: -1, kind: "collision" },
  ...cardSteps(context, true),
];

/** Reminders kept with every collision roll */
export const COLLISION_NOTES: readonly string[] = [
  "Choque: el terreno no cuenta y las retiradas no se pueden ignorar.",
];
