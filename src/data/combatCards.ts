// data/combatCards.ts
// The house combat cards (docs/house-rules.md, "New combat cards" and "Combat
// cards in the player's set"); costs are the ones marked with a pen. Each side's
// deck is built from the scenario (`combatDeckFor`): 1 copy of each card the side
// gets, the defensive cards for the defender, the offensive ones for the attacker,
// and the rest by its units, its enemy's, the towns on the map, its big guns and
// its air power.
// Tune them here.
//
// Not in the deck yet: the command combat cards that act on the opponent's
// hand or orders (Spies, HQ Distraction, Message Interception, Lost Message),
// which come in Step 33. Sniper is left out: the player doesn't want snipers.
import { CombatCard, CombatEffect, CombatPhase, DeckReason, MarkerRule } from "../game-core/combatCard";

export type { DeckReason };
import { UnitType } from "../game-core/unit";
import { HexType } from "../types/hex";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";
import { hasUnits } from "./commandCards";
import { Localized, same } from "../i18n/lang";

/** Rattenkrieg is only dealt on a map with more town hexes than this */
export const RATTENKRIEG_MIN_TOWNS = 8;

/** Combat cards each side starts the game with */
export const STARTING_COMBAT_CARDS = 2;

/** Most combat cards in a hand; drawing one more means discarding one */
export const MAX_COMBAT_HAND = 3;

interface CombatCardTemplate {
  id: string;
  name: Localized;
  description: Localized;
  cost: number;
  phase: CombatPhase;
  /** Why a side gets it, and how many copies */
  rule: DeckRule;
  marker?: MarkerRule;
  tableReminder?: Localized;
  effect?: CombatEffect;
  needsOrdered?: readonly UnitType[];
}

/** What a side has in the scenario, which decides the cards it gets */
interface SideContext {
  attacker: boolean;
  tanks: boolean;
  artillery: boolean;
  enemyTanks: boolean;
  /** Town hexes on the map */
  towns: number;
  bigGuns: boolean;
  /** Copies of each air card */
  air: number;
}

interface DeckRule {
  reason: DeckReason;
  /** Copies in this side's deck (0: not in it) */
  copies: (side: SideContext) => number;
}

const always: DeckRule = { reason: "shared", copies: () => 1 };
const defensive: DeckRule = { reason: "defender", copies: (side) => (side.attacker ? 0 : 1) };
const offensive: DeckRule = { reason: "attacker", copies: (side) => (side.attacker ? 1 : 0) };
const ifSide = (reason: DeckReason, has: (side: SideContext) => boolean): DeckRule => ({
  reason,
  copies: (side) => (has(side) ? 1 : 0),
});
const airCards: DeckRule = { reason: "air", copies: (side) => side.air };

type Extra = Pick<CombatCardTemplate, "marker" | "tableReminder" | "effect" | "needsOrdered">;

const order = (
  id: string,
  name: Localized,
  cost: number,
  rule: DeckRule,
  description: Localized,
  extra: Extra = {}
): CombatCardTemplate => ({ id, name, description, cost, phase: "order", rule, ...extra });

const battle = (
  id: string,
  name: Localized,
  cost: number,
  rule: DeckRule,
  description: Localized,
  extra: Extra = {}
): CombatCardTemplate => ({ id, name, description, cost, phase: "battle", rule, ...extra });

const TEMPLATES: CombatCardTemplate[] = [
  // Played with the command card
  order("rattenkrieg", same("Rattenkrieg"), 2, ifSide("towns", (side) => side.towns > RATTENKRIEG_MIN_TOWNS),
    {
      es: "1 infantería en un edificio o junto a uno se mueve hasta 3 casillas por cualquier terreno y debe terminar en un edificio. Aun así puede combatir.",
      en: "1 infantry unit on or next to a building moves up to 3 hexes through any terrain and must end on a building. It can still battle.",
    },
    {
      effect: {
        kind: "move",
        units: 1,
        unitTypes: [UnitType.INFANTRY],
        maxMove: 3,
        ignoreTerrain: true,
        fireInto: [HexType.TOWN],
        endOn: [HexType.TOWN],
        startNear: [HexType.TOWN],
        notOnTheMove: true,
      },
    }),
  order("no-respite", { es: "Sin tregua", en: "No Respite" }, 1, { reason: "attacker", copies: (side) => (side.attacker ? 2 : 0) },
    {
      es: "1 unidad entra en un bosque, un pueblo o un seto y aun así puede combatir.",
      en: "1 unit moves into a forest, a town or a hedgerow and can still battle.",
    },
    { effect: { kind: "move", units: 1, fireInto: [HexType.FOREST, HexType.TOWN, HexType.HEDGEROW] } }),
  order("armor-forward", { es: "Blindados adelante", en: "Armor Forward" }, 2, ifSide("tanks", (side) => side.tanks),
    {
      es: "3 unidades de blindados ignoran el terreno al moverse (las restricciones de combate se mantienen).",
      en: "3 armor units ignore terrain when moving (battle restrictions still apply).",
    },
    { effect: { kind: "move", units: 3, unitTypes: [UnitType.TANK], ignoreTerrain: true } }),
  order("medic", { es: "Médico", en: "Medic" }, 2, always, {
    es: "1 infantería debilitada con orden recupera hasta 2 figuras.",
    en: "1 weakened ordered infantry unit recovers up to 2 figures.",
  }),
  order("mechanic", { es: "Mecánico", en: "Mechanic" }, 2, ifSide("tanks", (side) => side.tanks), {
    es: "1 unidad de blindados o artillería debilitada con orden recupera 1 figura.",
    en: "1 weakened ordered armor or artillery unit recovers 1 figure.",
  }),
  order("infiltrators", { es: "Tras las líneas enemigas", en: "Behind Enemy Lines" }, 4, always,
    {
      es: "1 infantería con orden se mueve hasta 3 casillas sin que el terreno la detenga y aun así combate, antes que cualquier otra unidad (las restricciones de combate se mantienen). En la fase final se mueve otras 3 casillas.",
      en: "1 ordered infantry unit moves up to 3 hexes without terrain stopping it and still battles, before any other unit (battle restrictions still apply). In the final phase it moves 3 more hexes.",
    },
    {
      effect: {
        kind: "move",
        units: 1,
        unitTypes: [UnitType.INFANTRY],
        maxMove: 3,
        ignoreTerrain: true,
        moveAndFire: true,
        firesFirst: true,
        notOnTheMove: true,
      },
      tableReminder: {
        es: "Tras las líneas enemigas: mueve ahora hasta 3 casillas la infantería y refléjalo en «Actualizar mapa».",
        en: "Behind Enemy Lines: move the infantry up to 3 hexes now and mirror it in “Update map”.",
      },
    }),
  order("motorized", { es: "Motorizado", en: "Motorized" }, 3, offensive,
    { es: "3 unidades mueven 1 casilla más.", en: "3 units move 1 extra hex." },
    { effect: { kind: "move", units: 3, moveBonus: 1 } }),
  order("air-bombardment", { es: "Bombardeo aéreo", en: "Air Bombardment" }, 4, airCards,
    {
      es: "Elige 2 casillas que no estén junto a tus unidades: 2 dados de ataque (con una granada en lugar del suministro) en cada una si hay una unidad. Las banderas no se pueden ignorar.",
      en: "Pick 2 hexes that aren't next to your units: 2 attack dice (with a grenade instead of the supply) on each one with a unit on it. Flags can't be ignored.",
    },
    { marker: { kind: "target", count: 2, awayFromOwnUnits: true }, effect: { kind: "attack", dicePerHex: 2 } }),
  order("reinforcements", { es: "Refuerzos", en: "Reinforcements" }, 6, always,
    {
      es: "En la fase final se tira 1 dado y, según el mapa, llega la unidad que salga (bandera: no hay refuerzos).",
      en: "In the final phase, roll 1 die and, depending on the map, the unit rolled arrives (flag: no reinforcements).",
    },
    { marker: { kind: "cross", count: 1 }, effect: { kind: "reinforcements" } }),
  order("tactician", { es: "Táctico", en: "Tactician" }, 2, always,
    { es: "Cambia la sección de una carta de sección.", en: "Change the section of a section card." },
    { effect: { kind: "changeSection" } }),
  order("barrage", { es: "Cortina de Fuego", en: "Barrage" }, 4, ifSide("bigGuns", (side) => side.bigGuns),
    {
      es: "Marca una casilla: si hay una unidad enemiga, tira 4 dados de ataque (con una granada en lugar del suministro) contra ella. Las retiradas no se pueden ignorar.",
      en: "Mark a hex: if there's an enemy unit on it, roll 4 attack dice (with a grenade instead of the supply) against it. Retreats can't be ignored.",
    },
    { marker: { kind: "target", count: 1 }, effect: { kind: "attack", dicePerHex: 4 } }),
  order("air-power", { es: "Poder aéreo", en: "Air Power" }, 3, airCards,
    {
      es: "Marca 4 casillas adyacentes, en cadena: 1 dado de ataque (con una granada en lugar del suministro) contra cada unidad enemiga que haya en ellas. Las retiradas no se pueden ignorar.",
      en: "Mark 4 adjacent hexes, in a chain: 1 attack die (with a grenade instead of the supply) against each enemy unit on them. Retreats can't be ignored.",
    },
    { marker: { kind: "target", count: 4, chain: true }, effect: { kind: "attack", dicePerHex: 1 } }),

  // Played during the battle, as a reaction
  battle("heat-of-battle", { es: "Fragor del combate", en: "Heat of Battle" }, 1, offensive,
    {
      es: "1 infantería que gana un asalto cercano (retirada o eliminación) puede arrollar como los blindados: toma terreno y vuelve a combatir, aunque la casilla lo impida.",
      en: "1 infantry unit that wins a close assault (retreat or elimination) can overrun like armor: it takes ground and battles again, even if the hex would prevent it.",
    },
    { effect: { kind: "takeGround", unitTypes: [UnitType.INFANTRY], units: 1 } }),
  battle("out-of-ammo", { es: "Sin munición", en: "Out of Ammo" }, 4, always, {
    es: "1 unidad enemiga no puede combatir y se mueve a una casilla libre de su línea de fondo.",
    en: "1 enemy unit can't battle and moves to an empty hex on its baseline.",
  }),
  battle("street-fight", { es: "Lucha callejera", en: "Street Fight" }, 1, always,
    { es: "1 infantería en un edificio o junto a uno tira 1 dado más.", en: "1 infantry unit on or next to a building rolls 1 extra die." },
    {
      effect: {
        kind: "diceBonus",
        dice: 1,
        unitTypes: [UnitType.INFANTRY],
        condition: { es: "¿La unidad está en un edificio o junto a uno?", en: "Is the unit on or next to a building?" },
      },
    }),
  battle("ambush", { es: "Emboscada", en: "Ambush" }, 3, always,
    {
      es: "Cuando una unidad enemiga te ataca en asalto cercano, combates tú primero: si se retira o es eliminada, su ataque no se hace.",
      en: "When an enemy unit attacks you in close assault, you battle first: if it retreats or is eliminated, its attack doesn't happen.",
    },
    { effect: { kind: "ambush" } }),
  battle("pull-back", { es: "Repliegue", en: "Pull Back" }, 3, defensive,
    { es: "Antes de que el enemigo combata, retira tu unidad hasta 2 casillas.", en: "Before the enemy battles, pull your unit back up to 2 hexes." },
    {
      tableReminder: {
        es: "Repliegue: refleja en «Actualizar mapa» la unidad que se replegó.",
        en: "Pull Back: mirror the unit that pulled back in “Update map”.",
      },
    }),
  battle("out-of-fuel", { es: "Sin combustible", en: "Out of Fuel" }, 3, ifSide("enemyTanks", (side) => side.enemyTanks), {
    es: "1 unidad de blindados enemiga no puede combatir y vuelve a su casilla de salida.",
    en: "1 enemy armor unit can't battle and goes back to the hex it started from.",
  }),
  battle("not-a-step-back", { es: "Ni un paso atrás", en: "Not One Step Back" }, 1, defensive,
    { es: "1 unidad ignora todas las retiradas.", en: "1 unit ignores all retreats." }),
  battle("camouflage", { es: "Camuflaje", en: "Camouflage" }, 2, defensive,
    {
      es: "Después de la batalla, pon 1 ficha de camuflaje en una unidad con orden.",
      en: "After the battle, put 1 camouflage token on an ordered unit.",
    },
    {
      tableReminder: {
        es: "Camuflaje: pon la ficha de camuflaje en la mesa, en una unidad con orden.",
        en: "Camouflage: put the camouflage token on an ordered unit on the table.",
      },
    }),
  battle("reposition", { es: "Reposicionamiento", en: "Reposition" }, 2, ifSide("artillery", (side) => side.artillery),
    {
      es: "Después de la batalla, toda la artillería con orden se mueve 2 casillas.",
      en: "After the battle, all ordered artillery moves 2 hexes.",
    },
    {
      tableReminder: {
        es: "Reposicionamiento: mueve en la mesa hasta 2 casillas tu artillería con orden y refléjalo en «Actualizar mapa».",
        en: "Reposition: move your ordered artillery up to 2 hexes on the table and mirror it in “Update map”.",
      },
      needsOrdered: [UnitType.ARTILLERY],
    }),
  battle("fortify", { es: "Fortificar", en: "Fortify" }, 1, defensive,
    {
      es: "Después de la batalla, pon sacos terreros en una infantería o artillería.",
      en: "After the battle, put sandbags on an infantry or artillery unit.",
    },
    {
      tableReminder: {
        es: "Fortificar: pon los sacos terreros en la mesa y, en «Actualizar mapa», en esa infantería o artillería.",
        en: "Fortify: put the sandbags on the table and, in “Update map”, on that infantry or artillery unit.",
      },
      effect: { kind: "fortify", unitTypes: [UnitType.INFANTRY, UnitType.ARTILLERY] },
    }),
  battle("spotter", { es: "Observador", en: "Spotter" }, 1, ifSide("artillery", (side) => side.artillery),
    { es: "1 artillería tira 1 dado más.", en: "1 artillery unit rolls 1 extra die." },
    { effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.ARTILLERY] }, needsOrdered: [UnitType.ARTILLERY] }),
  battle("personal-armor", { es: "Blindaje personal", en: "Personal Armor" }, 1, always, {
    es: "Después de que el rival tire, ignora 1 resultado de infantería.",
    en: "After your opponent rolls, ignore 1 infantry result.",
  }),
  battle("explosives", { es: "Explosivos", en: "Explosives" }, 1, always,
    { es: "1 infantería tira 1 dado más en asalto cercano.", en: "1 infantry unit rolls 1 extra die in close assault." },
    { effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], closeAssault: true } }),
  battle("shells-shortage", { es: "Escasez de proyectiles", en: "Shell Shortage" }, 2, ifSide("enemyTanks", (side) => side.enemyTanks), {
    es: "1 unidad de artillería o blindados enemiga no puede disparar.",
    en: "1 enemy artillery or armor unit can't fire.",
  }),
  battle("rifles-up", { es: "¡Fusiles arriba!", en: "Rifles Up!" }, 1, always,
    { es: "Elige una unidad tuya: dispara antes que nadie.", en: "Pick one of your units: it fires before anyone else." },
    { effect: { kind: "firesFirst" } }),
];

/** One card per copy; copies get a numbered id so saves can tell them apart */
function buildDeck(templates: CombatCardTemplate[], side: SideContext): CombatCard[] {
  return templates.flatMap(({ rule, ...card }) =>
    Array.from({ length: rule.copies(side) }, (_, i) => ({ ...card, id: `${card.id}-${i + 1}`, templateId: card.id, reason: rule.reason }))
  );
}

/** One of every combat card, whatever the scenario: the test mode's hand */
export function allCombatCards(): CombatCard[] {
  return TEMPLATES.map(({ rule, ...card }) => ({ ...card, id: `${card.id}-1`, templateId: card.id, reason: rule.reason }));
}

function sideContext(scenario: Scenario, faction: Faction): SideContext {
  const enemy: Faction = faction === "Axis" ? "Allies" : "Axis";
  return {
    attacker: scenario.attacker === faction,
    tanks: hasUnits(scenario, faction, UnitType.TANK),
    artillery: hasUnits(scenario, faction, UnitType.ARTILLERY),
    enemyTanks: hasUnits(scenario, enemy, UnitType.TANK),
    towns: scenario.tiles[HexType.TOWN]?.length ?? 0,
    bigGuns: scenario.bigGuns?.includes(faction) ?? true,
    air: scenario.airPower?.[faction === "Axis" ? "axis" : "allies"] ?? 1,
  };
}

/** The combat deck this side gets in the scenario */
export function combatDeckFor(scenario: Scenario, faction: Faction): CombatCard[] {
  return buildDeck(TEMPLATES, sideContext(scenario, faction));
}

/** A card in a side's combat deck, with its copies and why the side gets it */
export interface CombatDeckEntry {
  card: CombatCard;
  copies: number;
  reason: DeckReason;
}

/** The side's combat deck one entry per card, to show what it holds and why */
export function combatDeckEntries(scenario: Scenario, faction: Faction): CombatDeckEntry[] {
  const side = sideContext(scenario, faction);
  return TEMPLATES.flatMap(({ rule, ...card }) => {
    const copies = rule.copies(side);
    return copies > 0 ? [{ card: { ...card, id: `${card.id}-1`, templateId: card.id, reason: rule.reason }, copies, reason: rule.reason }] : [];
  });
}
