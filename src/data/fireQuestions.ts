// data/fireQuestions.ts
// The situations asked about when a unit fires, and how each answer changes
// the number of dice. To add a situation, add a question to FIRE_QUESTIONS
// (use `appliesTo` to only ask it in some situations).
//
// The numbers start from the official Memoir '44 values; change them to match
// the house rules.
import { DiceStep, FireAnswers, FireContext, FireQuestion } from "../game-core/fireRules";
import { UnitType, checksLineOfSight } from "../game-core/unit";
import { HexType } from "../types/hex";
import { LABELS } from "../labels";
import { Localized, byLang } from "../i18n/lang";

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

/**
 * Where the target can be: the board's terrain types plus a bunker. No unit can
 * be on water, and a bridge counts as open ground (`effectiveTerrain`).
 */
export type TargetTerrain = Exclude<HexType, HexType.RIVER | HexType.LAKE | HexType.BRIDGE> | "bunker";

/** Dice lost when the target is in this terrain, by the firing unit's type; answers are the keys, in this order */
export const TARGET_TERRAIN_MODIFIERS: Record<TargetTerrain, { label: Localized; dice: Record<UnitType, number> }> = {
  plains: { label: { es: "Campo abierto", en: "Open ground" }, dice: { infantry: 0, tank: 0, artillery: 0 } },
  forest: { label: { es: "Bosque", en: "Forest" }, dice: { infantry: -1, tank: -2, artillery: 0 } },
  town: { label: { es: "Pueblo", en: "Town" }, dice: { infantry: -1, tank: -2, artillery: 0 } },
  hill: { label: { es: "Colina", en: "Hill" }, dice: { infantry: -1, tank: -1, artillery: 0 } },
  hedgerow: { label: { es: "Seto", en: "Hedgerow" }, dice: { infantry: -1, tank: -2, artillery: 0 } },
  bunker: { label: { es: "Búnker", en: "Bunker" }, dice: { infantry: -1, tank: -2, artillery: 0 } },
};

const YES_NO = [
  { value: "yes", label: { es: "Sí", en: "Yes" } },
  { value: "no", label: { es: "No", en: "No" } },
];

const distanceQuestion: FireQuestion = {
  id: "distance",
  text: { es: "¿A cuántas casillas está el objetivo?", en: "How many hexes away is the target?" },
  options: ({ unitType, closeAssaultOnly }) =>
    BASE_DICE_BY_DISTANCE[unitType].slice(0, closeAssaultOnly ? 1 : undefined).map((_, i) => ({
      value: String(i + 1),
      label: i === 0 ? { es: "1 (adyacente)", en: "1 (adjacent)" } : byLang(() => String(i + 1)),
    })),
  effect: ({ unitType }, answer) => {
    const distance = Number(answer);
    const dice = BASE_DICE_BY_DISTANCE[unitType][distance - 1] ?? 0;
    return {
      label: {
        es: `Base: ${LABELS.es.units[unitType]} a ${LABELS.es.hexes(distance)}`,
        en: `Base: ${LABELS.en.units[unitType]} at ${LABELS.en.hexes(distance)}`,
      },
      dice,
      kind: "base",
    };
  },
};

/** The answers to the target question: infantry, or any other unit */
export const TARGET_INFANTRY = "infantry";
export const TARGET_OTHER = "other";

/** The target question's answer: true for infantry, false for any other unit, null when it isn't one of them */
export const targetAnswer = (answer: string | undefined): boolean | null =>
  answer === TARGET_INFANTRY ? true : answer === TARGET_OTHER ? false : null;

/** Doesn't change the dice: whether the target is infantry decides which faces hit (data/hitRules.ts) */
export const targetTypeQuestion: FireQuestion = {
  id: "targetType",
  text: { es: "¿El objetivo es infantería?", en: "Is the target infantry?" },
  options: () => [
    { value: TARGET_INFANTRY, label: byLang((lang) => LABELS[lang].target(true)) },
    { value: TARGET_OTHER, label: byLang((lang) => LABELS[lang].target(false)) },
  ],
  effect: () => null,
};

/**
 * The terrain that counts for the shot: a bridge is open ground (house rule),
 * and, official hill rule, a unit on a hill fires at a unit on another hill
 * (the same height) as if it were open ground.
 */
export const effectiveTerrain = ({ fromTerrain }: FireContext, answer: string | undefined): TargetTerrain | undefined =>
  answer === HexType.BRIDGE || (answer === HexType.HILL && fromTerrain === HexType.HILL)
    ? HexType.PLAINS
    : (answer as TargetTerrain | undefined);

const targetTerrainQuestion: FireQuestion = {
  id: "targetTerrain",
  text: { es: "¿En qué terreno está el objetivo?", en: "What terrain is the target on?" },
  options: () =>
    Object.entries(TARGET_TERRAIN_MODIFIERS).map(([value, { label }]) => ({ value, label })),
  effect: (context, answer) => {
    const terrain = TARGET_TERRAIN_MODIFIERS[effectiveTerrain(context, answer)!];
    if (!terrain) return null;
    return {
      label: { es: `Objetivo en ${terrain.label.es.toLowerCase()}`, en: `Target in ${terrain.label.en.toLowerCase()}` },
      dice: terrain.dice[context.unitType],
      kind: "terrain",
    };
  },
};

/**
 * Adjacent targets are always in sight; further away, blocking terrain or units
 * can hide them. Artillery doesn't need line of sight.
 */
const lineOfSightQuestion: FireQuestion = {
  id: "lineOfSight",
  text: { es: "¿Tiene línea de visión al objetivo?", en: "Does it have line of sight to the target?" },
  options: () => YES_NO,
  appliesTo: ({ unitType }, answers) => checksLineOfSight(unitType) && Number(answers.distance) > 1,
  effect: () => null,
  blocks: (_, answer) =>
    answer === "no"
      ? {
          es: "Sin línea de visión no puede disparar a este objetivo. Elige otro objetivo.",
          en: "Without line of sight it can't fire at this target. Pick another target.",
        }
      : null,
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

/** The reminder kept with a shot at a target behind sandbags */
export const SANDBAGS_NOTE: Localized = {
  es: "Sacos terreros: el objetivo ignora 1 bandera.",
  en: "Sandbags: the target ignores 1 flag.",
};

/** "Carta Observador": a dice step from a card */
const cardLabel = (name: Localized): Localized => ({ es: `Carta ${name.es}`, en: `${name.en} card` });

/**
 * Sandbags: the target ignores 1 flag when the hits are resolved (whoever
 * fires) and, in the open (where no terrain protects it), the shot loses a die
 * too, except artillery's.
 */
const sandbagsQuestion: FireQuestion = {
  id: "sandbags",
  text: { es: "¿El objetivo está protegido con sacos terreros?", en: "Is the target protected by sandbags?" },
  options: () => YES_NO,
  effect: (context, answer, answers) =>
    answer === "yes" &&
    effectiveTerrain(context, answers.targetTerrain) === HexType.PLAINS &&
    SANDBAGS_IN_THE_OPEN[context.unitType] !== 0
      ? {
          label: { es: "Sacos terreros en campo abierto", en: "Sandbags in the open" },
          dice: SANDBAGS_IN_THE_OPEN[context.unitType],
          kind: "sandbags",
        }
      : null,
  note: (_, answer) => (answer === "yes" ? SANDBAGS_NOTE : null),
};

/** A battle combat card that adds dice to one shot (Spotter, Street Fight, Explosives) */
export const combatBonusQuestion: FireQuestion = {
  id: "combatCard",
  text: { es: "", en: "" },
  textFor: ({ combatBonus }) => ({
    es: combatBonus?.condition
      ? `${combatBonus.name.es}: ${combatBonus.condition.es} Si es así, ¿la usas en este disparo?`
      : `${combatBonus?.name.es}: ¿la usas en este disparo?`,
    en: combatBonus?.condition
      ? `${combatBonus.name.en}: ${combatBonus.condition.en} If so, do you use it on this shot?`
      : `${combatBonus?.name.en}: do you use it on this shot?`,
  }),
  options: () => YES_NO,
  appliesTo: ({ combatBonus }, answers) =>
    !!combatBonus &&
    !!answers.distance &&
    (combatBonus.closeAssault === undefined || combatBonus.closeAssault === (answers.distance === "1")),
  effect: ({ combatBonus }, answer) =>
    combatBonus && answer === "yes" ? { label: cardLabel(combatBonus.name), dice: combatBonus.dice, kind: "card" } : null,
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
  return card && dice !== 0 ? [{ label: cardLabel(card.name), dice, kind: "card" }] : [];
};

/**
 * Dice lost by a unit firing from a hex with barbed wire, by its type. Infantry
 * can remove the wire instead of firing (GameSession.removeWire); armour and
 * artillery fire as usual.
 */
export const WIRE_FIRE_DICE: Record<UnitType, number> = {
  [UnitType.INFANTRY]: -1,
  [UnitType.TANK]: 0,
  [UnitType.ARTILLERY]: 0,
};

/** The unit types asked whether to remove the wire they stand on or fire with fewer dice */
export const wireChoiceFor = (unitType: UnitType) => WIRE_FIRE_DICE[unitType] !== 0;

const wireSteps = ({ unitType, fromWire }: FireContext): DiceStep[] =>
  fromWire && WIRE_FIRE_DICE[unitType] !== 0
    ? [{ label: { es: "Desde una alambrada", en: "From barbed wire" }, dice: WIRE_FIRE_DICE[unitType], kind: "wire" }]
    : [];

/** Extra dice that don't need a question: the command card's bonuses, and barbed wire under the firing unit */
export const fireBonusSteps = (context: FireContext, answers: FireAnswers): DiceStep[] =>
  answers.distance ? [...cardSteps(context, answers.distance === "1"), ...wireSteps(context)] : [];

/**
 * A collision in the movement phase (two units cross or land on the same hex):
 * close assault dice − 1, plus the card's close-assault bonus. Terrain is ignored.
 */
export const collisionSteps = (context: FireContext): DiceStep[] => [
  {
    label: byLang((lang) => `Base: ${LABELS[lang].units[context.unitType]} ${lang === "es" ? "en choque" : "in a collision"}`),
    dice: BASE_DICE_BY_DISTANCE[context.unitType][0] ?? 0,
    kind: "base",
  },
  { label: { es: "Choque", en: "Collision" }, dice: -1, kind: "collision" },
  ...cardSteps(context, true),
];

/** Reminders kept with every collision roll */
export const COLLISION_NOTES: readonly Localized[] = [
  {
    es: "Choque: el terreno no cuenta y las retiradas no se pueden ignorar.",
    en: "Collision: terrain doesn't count and retreats can't be ignored.",
  },
];
