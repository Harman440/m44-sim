// data/combatCards.ts
// The house combat cards (docs/house-rules.md, "New combat cards" and "Combat
// cards in the player's set"); costs are the ones marked with a pen. Each side's
// deck is built from the scenario (`combatDeckFor`): 1 copy of each card the side
// gets, the defensive cards for the defender, the offensive ones for the attacker,
// and the rest by its units, the towns on the map, its big guns and its air
// power.
// Tune them here.
//
// Not in the deck yet: the command combat cards that act on the opponent's
// hand or orders (Spies, HQ Distraction, Message Interception, Lost Message),
// which come in Step 33. Sniper is left out: the player doesn't want snipers.
// Out of Ammo, Ambush, Pull Back, Out of Fuel and Shell Shortage were taken out
// with the reaction cards (Step 61).
import { AssignRule, CombatCard, CombatEffect, DeckReason, MarkerRule } from "../game-core/combatCard";

export type { DeckReason };
import { UnitType } from "../game-core/unit";
import { DieFace } from "../game-core/dice";
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

/** Most combat cards played in a turn, all with the command card (two different cards) */
export const MAX_COMBAT_CARDS_PER_TURN = 2;

interface CombatCardTemplate {
  id: string;
  name: Localized;
  description: Localized;
  cost: number;
  /** Why a side gets it, and how many copies */
  rule: DeckRule;
  marker?: MarkerRule;
  tableReminder?: Localized;
  battleReminder?: Localized;
  effect?: CombatEffect;
  assign?: AssignRule;
  needsOrdered?: readonly UnitType[];
}

/** What a side has in the scenario, which decides the cards it gets */
interface SideContext {
  attacker: boolean;
  tanks: boolean;
  artillery: boolean;
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

type Extra = Pick<CombatCardTemplate, "marker" | "tableReminder" | "battleReminder" | "effect" | "assign" | "needsOrdered">;

/** Every combat card is played with the command card */
const card = (
  id: string,
  name: Localized,
  cost: number,
  rule: DeckRule,
  description: Localized,
  extra: Extra = {}
): CombatCardTemplate => ({ id, name, description, cost, rule, ...extra });

const TEMPLATES: CombatCardTemplate[] = [
  // Cards for the orders: moves, marked hexes, the deck
  card("rattenkrieg", same("Rattenkrieg"), 2, ifSide("towns", (side) => side.towns > RATTENKRIEG_MIN_TOWNS),
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
  card("no-respite", { es: "Sin tregua", en: "No Respite" }, 1, { reason: "attacker", copies: (side) => (side.attacker ? 2 : 0) },
    {
      es: "1 unidad entra en un bosque, un pueblo o un seto y aun así puede combatir.",
      en: "1 unit moves into a forest, a town or a hedgerow and can still battle.",
    },
    { effect: { kind: "move", units: 1, fireInto: [HexType.FOREST, HexType.TOWN, HexType.HEDGEROW] } }),
  card("armor-forward", { es: "Blindados adelante", en: "Armor Forward" }, 2, ifSide("tanks", (side) => side.tanks),
    {
      es: "3 unidades de blindados ignoran el terreno al moverse (las restricciones de combate se mantienen).",
      en: "3 armor units ignore terrain when moving (battle restrictions still apply).",
    },
    { effect: { kind: "move", units: 3, unitTypes: [UnitType.TANK], ignoreTerrain: true } }),
  card("medic", { es: "Médico", en: "Medic" }, 2, always, {
    es: "1 infantería debilitada con orden recupera hasta 2 figuras.",
    en: "1 weakened ordered infantry unit recovers up to 2 figures.",
  }),
  card("mechanic", { es: "Mecánico", en: "Mechanic" }, 2, ifSide("tanks", (side) => side.tanks), {
    es: "1 unidad de blindados o artillería debilitada con orden recupera 1 figura.",
    en: "1 weakened ordered armor or artillery unit recovers 1 figure.",
  }),
  card("infiltrators", { es: "Tras las líneas enemigas", en: "Behind Enemy Lines" }, 4, always,
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
  card("motorized", { es: "Motorizado", en: "Motorized" }, 2, offensive,
    { es: "3 unidades de infantería mueven 1 casilla más.", en: "3 infantry units move 1 extra hex." },
    { effect: { kind: "move", units: 3, unitTypes: [UnitType.INFANTRY], moveBonus: 1 } }),
  card("air-bombardment", { es: "Bombardeo aéreo", en: "Air Bombardment" }, 4, airCards,
    {
      es: "Elige 2 casillas que no estén junto a tus unidades: 2 dados de ataque (con una granada en lugar del suministro) en cada una si hay una unidad. Las banderas no se pueden ignorar.",
      en: "Pick 2 hexes that aren't next to your units: 2 attack dice (with a grenade instead of the supply) on each one with a unit on it. Flags can't be ignored.",
    },
    { marker: { kind: "target", count: 2, awayFromOwnUnits: true }, effect: { kind: "attack", dicePerHex: 2 } }),
  card("reinforcements", { es: "Refuerzos", en: "Reinforcements" }, 6, always,
    {
      es: "Marca una casilla libre con una cruz: en la fase final llega allí una unidad de infantería.",
      en: "Mark an empty hex with a cross: in the final phase an infantry unit arrives there.",
    },
    { marker: { kind: "cross", count: 1 }, effect: { kind: "reinforcements", unitType: UnitType.INFANTRY } }),
  card("tactician", { es: "Táctico", en: "Tactician" }, 2, always,
    { es: "Cambia la sección de una carta de sección.", en: "Change the section of a section card." },
    { effect: { kind: "changeSection" } }),
  card("barrage", { es: "Cortina de Fuego", en: "Barrage" }, 4, ifSide("bigGuns", (side) => side.bigGuns),
    {
      es: "Marca una casilla: si hay una unidad enemiga, tira 4 dados de ataque (con una granada en lugar del suministro) contra ella. Las retiradas no se pueden ignorar.",
      en: "Mark a hex: if there's an enemy unit on it, roll 4 attack dice (with a grenade instead of the supply) against it. Retreats can't be ignored.",
    },
    { marker: { kind: "target", count: 1 }, effect: { kind: "attack", dicePerHex: 4 } }),
  card("air-power", { es: "Poder aéreo", en: "Air Power" }, 3, airCards,
    {
      es: "Marca 4 casillas adyacentes, en cadena: 1 dado de ataque (con una granada en lugar del suministro) contra cada unidad enemiga que haya en ellas. Las retiradas no se pueden ignorar.",
      en: "Mark 4 adjacent hexes, in a chain: 1 attack die (with a grenade instead of the supply) against each enemy unit on them. Retreats can't be ignored.",
    },
    { marker: { kind: "target", count: 4, chain: true }, effect: { kind: "attack", dicePerHex: 1 } }),

  // Cards for the battle, given to a unit or for all of a kind (they used to be played in the battle)
  card("heat-of-battle", { es: "Fragor del combate", en: "Heat of Battle" }, 1, offensive,
    {
      es: "Este turno, cada asalto cercano de tu infantería lleva 1 dado más, que siempre es una bandera (también en un choque).",
      en: "This turn, each close assault by your infantry gets 1 extra die, which is always a flag (in a collision too).",
    },
    { effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], closeAssault: true, face: DieFace.FLAG } }),
  card("street-equipment", { es: "Equipo urbano", en: "Street Equipment" }, 1, always,
    {
      es: "Dásela a 1 infantería con orden: este turno tira 1 dado más cuando dispara desde un edificio o junto a uno.",
      en: "Give it to 1 ordered infantry unit: this turn it rolls 1 extra die when it fires from or next to a building.",
    },
    {
      assign: { unitTypes: [UnitType.INFANTRY], ordered: true },
      effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], near: [HexType.TOWN] },
    }),
  card("not-a-step-back", { es: "Ni un paso atrás", en: "Not One Step Back" }, 2, defensive,
    {
      es: "Este turno, toda tu infantería ignora todas las banderas (disparos, cartas de ataque y choques).",
      en: "This turn, all your infantry ignores every flag (shots, attack cards and collisions).",
    },
    {
      effect: { kind: "ignoreFlags", unitTypes: [UnitType.INFANTRY] },
      battleReminder: {
        es: "Ni un paso atrás: este turno tu infantería no se retira; ignora todas las banderas que saque el rival.",
        en: "Not One Step Back: this turn your infantry doesn't retreat; it ignores every flag the opponent rolls.",
      },
      tableReminder: {
        es: "Ni un paso atrás: tu infantería no se retira por las banderas de este turno.",
        en: "Not One Step Back: your infantry doesn't retreat for this turn's flags.",
      },
    }),
  card("camouflage", { es: "Camuflaje", en: "Camouflage" }, 2, defensive,
    {
      es: "Dásela a 1 infantería con orden: tras la batalla recibe la ficha de camuflaje. Solo se le puede disparar en asalto cercano, y la pierde cuando se mueve o combate.",
      en: "Give it to 1 ordered infantry unit: after the battle it gets the camouflage token. It can only be fired at in close assault, and loses it when it moves or battles.",
    },
    {
      assign: { unitTypes: [UnitType.INFANTRY], ordered: true },
      effect: { kind: "camouflage" },
      tableReminder: {
        es: "Camuflaje: pon la ficha de camuflaje en la mesa, en tu infantería con la carta.",
        en: "Camouflage: put the camouflage token on the table, on your infantry with the card.",
      },
    }),
  card("reposition", { es: "Reposicionamiento", en: "Reposition" }, 2, ifSide("artillery", (side) => side.artillery),
    {
      es: "Dásela a 1 artillería con orden: después de la batalla se mueve hasta 2 casillas.",
      en: "Give it to 1 ordered artillery unit: after the battle it moves up to 2 hexes.",
    },
    {
      assign: { unitTypes: [UnitType.ARTILLERY], ordered: true },
      effect: { kind: "reposition", hexes: 2 },
      tableReminder: {
        es: "Reposicionamiento: mueve en la mesa hasta 2 casillas tu artillería con la carta y refléjalo en «Actualizar mapa».",
        en: "Reposition: move your artillery with the card up to 2 hexes on the table and mirror it in “Update map”.",
      },
    }),
  card("fortify", { es: "Fortificar", en: "Fortify" }, 1, defensive,
    {
      es: "En la batalla, cada infantería tuya con orden que aún pueda disparar puede fortificarse en su lugar: pone sacos terreros en su casilla, que cuentan desde ya.",
      en: "In the battle, each of your ordered infantry units that could still fire may fortify instead: it puts sandbags on its hex, which count from then on.",
    },
    { effect: { kind: "fortify", unitTypes: [UnitType.INFANTRY] } }),
  card("spotter", { es: "Observador", en: "Spotter" }, 1, ifSide("artillery", (side) => side.artillery),
    {
      es: "Este turno, toda tu artillería con orden tira 1 dado más en cada disparo.",
      en: "This turn, all your ordered artillery rolls 1 extra die on every shot.",
    },
    { effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.ARTILLERY] }, needsOrdered: [UnitType.ARTILLERY] }),
  card("personal-armor", { es: "Blindaje personal", en: "Personal Armor" }, 1, always,
    {
      es: "Dásela a 1 infantería, con orden o sin ella: este turno ignora los 2 primeros impactos de símbolo de infantería. Las granadas sí la impactan.",
      en: "Give it to 1 infantry unit, ordered or not: this turn it ignores the first 2 infantry-symbol hits. Grenades still hit it.",
    },
    {
      assign: { unitTypes: [UnitType.INFANTRY], ordered: false },
      effect: { kind: "ignoreHits", face: DieFace.INFANTRY, hits: 2 },
      battleReminder: {
        es: "Blindaje personal: tu infantería con la carta ignora los 2 primeros impactos de símbolo de infantería del rival este turno; las granadas sí cuentan.",
        en: "Personal Armor: your infantry with the card ignores the opponent's first 2 infantry-symbol hits this turn; grenades still count.",
      },
    }),
  card("explosives", { es: "Explosivos", en: "Explosives" }, 1, always,
    {
      es: "Dásela a 1 infantería con orden: este turno tira 1 dado más en asalto cercano.",
      en: "Give it to 1 ordered infantry unit: this turn it rolls 1 extra die in close assault.",
    },
    {
      assign: { unitTypes: [UnitType.INFANTRY], ordered: true },
      effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], closeAssault: true },
    }),
  card("rifles-up", { es: "¡Fusiles arriba!", en: "Rifles Up!" }, 2, always,
    {
      es: "Este turno, tu infantería que se ha movido dispara junto con las unidades que no se movieron.",
      en: "This turn, your infantry that moved fires with the units that didn't move.",
    },
    { effect: { kind: "firesWithUnmoved", unitTypes: [UnitType.INFANTRY] } }),
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

/** Whether a side gets Cortina de Fuego: both do unless the scenario lists the sides that have big guns */
export const hasBigGuns = (scenario: Scenario, faction: Faction): boolean => scenario.bigGuns?.includes(faction) ?? true;

/** Air sorties a side has in the scenario, the copies of each air card it gets: 1 when the scenario doesn't say */
export const airSortiesOf = (scenario: Scenario, faction: Faction): number =>
  scenario.airPower?.[faction === "Axis" ? "axis" : "allies"] ?? 1;

function sideContext(scenario: Scenario, faction: Faction): SideContext {
  return {
    attacker: scenario.attacker === faction,
    tanks: hasUnits(scenario, faction, UnitType.TANK),
    artillery: hasUnits(scenario, faction, UnitType.ARTILLERY),
    towns: scenario.tiles[HexType.TOWN]?.length ?? 0,
    bigGuns: hasBigGuns(scenario, faction),
    air: airSortiesOf(scenario, faction),
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
