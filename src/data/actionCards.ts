// data/actionCards.ts
// The actions mode's command cards (house rules): their cost in supplies and the cooldown after
// playing one. A scenario can make a card cheaper for a side (`Scenario.cardCosts`); the air
// cards and Barrage go only to a side with air sorties or big guns. game-core/actionCard.ts
// has the rules.
import { UnitType } from "../game-core/unit";
import type { ActionCard } from "../game-core/actionCard";

/** Turns a card waits after it's played: one played on turn 2 can be played again on turn 5 */
export const CARD_COOLDOWN_TURNS = 4;

export const ACTION_CARDS: readonly ActionCard[] = [
  {
    id: "finest-hour",
    name: { es: "La Hora de la Verdad", en: "Their Finest Hour" },
    description: {
      es: "Este turno, todas tus unidades tiran 1 dado más en cada disparo.",
      en: "This turn, all your units roll 1 extra die on every shot.",
    },
    painting: "finest-hour",
    cost: 15,
    effect: { kind: "extraDice", dice: 1 },
  },
  {
    id: "resupply",
    name: { es: "Reabastecimiento", en: "Resupply" },
    description: {
      es: "Toda tu infantería recupera su equipo, su moral y su munición.",
      en: "All your infantry gets its equipment, morale and ammo back.",
    },
    painting: "preparations",
    cost: 9,
    effect: { kind: "resupply" },
  },
  {
    id: "refuel",
    name: { es: "Repostaje", en: "Refuel" },
    description: {
      es: "Tus blindados y tu artillería llenan el depósito de combustible.",
      en: "Your armour and artillery fill up their fuel.",
    },
    painting: "armor-assault",
    cost: 10,
    effect: { kind: "refuel" },
  },
  {
    id: "air-bombardment",
    name: { es: "Bombardeo aéreo", en: "Air Bombardment" },
    description: {
      es: "Elige 2 casillas que no estén junto a tus unidades: 2 dados de ataque (con una granada en lugar del suministro) en cada una si hay una unidad. Las banderas no se pueden ignorar.",
      en: "Pick 2 hexes that aren't next to your units: 2 attack dice (with a grenade instead of the supply) on each one with a unit on it. Flags can't be ignored.",
    },
    painting: "air-bombardment",
    cost: 8,
    needs: "air",
    marker: { kind: "target", count: 2, awayFromOwnUnits: true },
    effect: { kind: "attack", dicePerHex: 2 },
  },
  {
    id: "reinforcements",
    name: { es: "Refuerzos", en: "Reinforcements" },
    description: {
      es: "Marca una casilla libre con una cruz: al empezar la fase final llega allí una unidad de infantería, sin energía.",
      en: "Mark an empty hex with a cross: as the final phase starts an infantry unit arrives there, with no energy.",
    },
    painting: "reinforcements",
    cost: 10,
    marker: { kind: "cross", count: 1 },
    effect: { kind: "reinforcements", unitType: UnitType.INFANTRY },
  },
  {
    id: "barrage",
    name: { es: "Cortina de Fuego", en: "Barrage" },
    description: {
      es: "Marca una casilla: si hay una unidad enemiga, tira 4 dados de ataque (con una granada en lugar del suministro) contra ella. Las retiradas no se pueden ignorar.",
      en: "Mark a hex: if there's an enemy unit on it, roll 4 attack dice (with a grenade instead of the supply) against it. Retreats can't be ignored.",
    },
    painting: "barrage",
    cost: 8,
    needs: "bigGuns",
    marker: { kind: "target", count: 1 },
    effect: { kind: "attack", dicePerHex: 4 },
  },
  {
    id: "air-power",
    name: { es: "Poder aéreo", en: "Air Power" },
    description: {
      es: "Marca 4 casillas adyacentes, en cadena, que no estén junto a tus unidades: 1 dado de ataque (con una granada en lugar del suministro) contra cada unidad enemiga que haya en ellas. Las retiradas no se pueden ignorar.",
      en: "Mark 4 adjacent hexes, in a chain, that aren't next to your units: 1 attack die (with a grenade instead of the supply) against each enemy unit on them. Retreats can't be ignored.",
    },
    painting: "air-power",
    cost: 7,
    needs: "air",
    marker: { kind: "target", count: 4, chain: true, awayFromOwnUnits: true },
    effect: { kind: "attack", dicePerHex: 1 },
  },
];

const BY_ID = new Map(ACTION_CARDS.map((card) => [card.id, card]));

export const actionCardById = (id: string): ActionCard | undefined => BY_ID.get(id);
