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
import { CombatCard, CombatEffect, CombatPhase, MarkerRule } from "../game-core/combatCard";
import { UnitType } from "../game-core/unit";
import { HexType } from "../types/hex";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";
import { hasUnits } from "./commandCards";

/** Rattenkrieg is only dealt on a map with more town hexes than this */
export const RATTENKRIEG_MIN_TOWNS = 8;

/** Combat cards each side starts the game with */
export const STARTING_COMBAT_CARDS = 2;

/** Most combat cards in a hand; drawing one more means discarding one */
export const MAX_COMBAT_HAND = 3;

interface CombatCardTemplate {
  id: string;
  name: string;
  description: string;
  cost: number;
  phase: CombatPhase;
  /** Copies in this side's deck (0: not in it) */
  copies: Copies;
  marker?: MarkerRule;
  tableReminder?: string;
  effect?: CombatEffect;
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

type Copies = (side: SideContext) => number;

const always: Copies = () => 1;
const defensive: Copies = (side) => (side.attacker ? 0 : 1);
const offensive: Copies = (side) => (side.attacker ? 1 : 0);
const ifSide = (has: (side: SideContext) => boolean): Copies => (side) => (has(side) ? 1 : 0);

type Extra = Pick<CombatCardTemplate, "marker" | "tableReminder" | "effect">;

const order = (
  id: string,
  name: string,
  cost: number,
  copies: Copies,
  description: string,
  extra: Extra = {}
): CombatCardTemplate => ({ id, name, description, cost, phase: "order", copies, ...extra });

const battle = (
  id: string,
  name: string,
  cost: number,
  copies: Copies,
  description: string,
  extra: Extra = {}
): CombatCardTemplate => ({ id, name, description, cost, phase: "battle", copies, ...extra });

const TEMPLATES: CombatCardTemplate[] = [
  // Played with the command card
  order("rattenkrieg", "Rattenkrieg", 2, ifSide((side) => side.towns > RATTENKRIEG_MIN_TOWNS),
    "1 infantería en un edificio o junto a uno se mueve hasta 3 casillas por cualquier terreno y debe terminar en un edificio. Aun así puede combatir.",
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
  order("no-respite", "Sin tregua", 1, (side) => (side.attacker ? 2 : 0),
    "1 unidad entra en un bosque, un pueblo o un seto y aun así puede combatir.",
    { effect: { kind: "move", units: 1, fireInto: [HexType.FOREST, HexType.TOWN, HexType.HEDGEROW] } }),
  order("armor-forward", "Blindados adelante", 2, ifSide((side) => side.tanks),
    "3 unidades de blindados ignoran el terreno al moverse (las restricciones de combate se mantienen).",
    { effect: { kind: "move", units: 3, unitTypes: [UnitType.TANK], ignoreTerrain: true } }),
  order("medic", "Médico", 2, always, "1 infantería debilitada con orden recupera hasta 2 figuras."),
  order("mechanic", "Mecánico", 2, ifSide((side) => side.tanks), "1 unidad de blindados o artillería debilitada con orden recupera 1 figura."),
  order("infiltrators", "Tras las líneas enemigas", 4, always,
    "1 infantería con orden se mueve hasta 3 casillas sin que el terreno la detenga y aun así combate, antes que cualquier otra unidad (las restricciones de combate se mantienen). En la fase final se mueve otras 3 casillas.",
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
      tableReminder: "Tras las líneas enemigas: mueve ahora hasta 3 casillas la infantería y refléjalo en «Actualizar mapa».",
    }),
  order("motorized", "Motorizado", 3, offensive, "3 unidades mueven 1 casilla más.",
    { effect: { kind: "move", units: 3, moveBonus: 1 } }),
  order("air-bombardment", "Bombardeo aéreo", 4, (side) => side.air,
    "Elige 2 casillas que no estén junto a tus unidades: 2 dados de ataque (con una granada en lugar del suministro) en cada una si hay una unidad. Las banderas no se pueden ignorar.",
    { marker: { kind: "target", count: 2, awayFromOwnUnits: true }, effect: { kind: "attack", dicePerHex: 2 } }),
  order("reinforcements", "Refuerzos", 6, always,
    "En la fase final se tira 1 dado y, según el mapa, llega la unidad que salga (bandera: no hay refuerzos).",
    { marker: { kind: "cross", count: 1 }, effect: { kind: "reinforcements" } }),
  order("tactician", "Táctico", 2, always, "Cambia la sección de una carta de sección.",
    { effect: { kind: "changeSection" } }),
  order("barrage", "Cortina de Fuego", 4, ifSide((side) => side.bigGuns),
    "Marca una casilla: si hay una unidad enemiga, tira 4 dados de ataque (con una granada en lugar del suministro) contra ella. Las retiradas no se pueden ignorar.",
    { marker: { kind: "target", count: 1 }, effect: { kind: "attack", dicePerHex: 4 } }),
  order("air-power", "Poder aéreo", 3, (side) => side.air,
    "Marca 4 casillas adyacentes, en cadena: 1 dado de ataque (con una granada en lugar del suministro) contra cada unidad enemiga que haya en ellas. Las retiradas no se pueden ignorar.",
    { marker: { kind: "target", count: 4, chain: true }, effect: { kind: "attack", dicePerHex: 1 } }),

  // Played during the battle, as a reaction
  battle("heat-of-battle", "Fragor del combate", 1, offensive,
    "1 infantería que gana un asalto cercano (retirada o eliminación) puede arrollar como los blindados: toma terreno y vuelve a combatir, aunque la casilla lo impida.",
    { effect: { kind: "takeGround", unitTypes: [UnitType.INFANTRY], units: 1 } }),
  battle("out-of-ammo", "Sin munición", 4, always,
    "1 unidad enemiga no puede combatir y se mueve a una casilla libre de su línea de fondo."),
  battle("street-fight", "Lucha callejera", 1, always, "1 infantería en un edificio o junto a uno tira 1 dado más.",
    { effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], condition: "¿La unidad está en un edificio o junto a uno?" } }),
  battle("ambush", "Emboscada", 3, always,
    "Cuando una unidad enemiga te ataca en asalto cercano, combates tú primero: si se retira o es eliminada, su ataque no se hace.",
    { effect: { kind: "ambush" } }),
  battle("pull-back", "Repliegue", 3, defensive, "Antes de que el enemigo combata, retira tu unidad hasta 2 casillas.",
    { tableReminder: "Repliegue: refleja en «Actualizar mapa» la unidad que se replegó." }),
  battle("out-of-fuel", "Sin combustible", 3, ifSide((side) => side.enemyTanks),
    "1 unidad de blindados enemiga no puede combatir y vuelve a su casilla de salida."),
  battle("not-a-step-back", "Ni un paso atrás", 1, defensive, "1 unidad ignora todas las retiradas."),
  battle("camouflage", "Camuflaje", 2, defensive, "Después de la batalla, pon 1 ficha de camuflaje en una unidad con orden.", {
    tableReminder: "Camuflaje: pon la ficha de camuflaje en la mesa, en una unidad con orden.",
  }),
  battle("reposition", "Reposicionamiento", 2, ifSide((side) => side.artillery), "Después de la batalla, toda la artillería con orden se mueve 2 casillas.",
    { tableReminder: "Reposicionamiento: mueve en la mesa hasta 2 casillas tu artillería con orden y refléjalo en «Actualizar mapa»." }),
  battle("fortify", "Fortificar", 1, defensive, "Después de la batalla, pon sacos terreros en una infantería o artillería.", {
    tableReminder: "Fortificar: pon sacos terreros en la mesa, en una infantería o artillería.",
  }),
  battle("spotter", "Observador", 1, ifSide((side) => side.artillery), "1 artillería tira 1 dado más.",
    { effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.ARTILLERY] } }),
  battle("personal-armor", "Blindaje personal", 1, always, "Después de que el rival tire, ignora 1 resultado de infantería."),
  battle("explosives", "Explosivos", 1, always, "1 infantería tira 1 dado más en asalto cercano.",
    { effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], closeAssault: true } }),
  battle("shells-shortage", "Escasez de proyectiles", 2, ifSide((side) => side.enemyTanks), "1 unidad de artillería o blindados enemiga no puede disparar."),
  battle("rifles-up", "¡Fusiles arriba!", 1, always, "Elige una unidad tuya: dispara antes que nadie.",
    { effect: { kind: "firesFirst" } }),
];

/** One card per copy; copies get a numbered id so saves can tell them apart */
function buildDeck(templates: CombatCardTemplate[], side: SideContext): CombatCard[] {
  return templates.flatMap(({ copies, ...card }) =>
    Array.from({ length: copies(side) }, (_, i) => ({ ...card, id: `${card.id}-${i + 1}` }))
  );
}

/** One of every combat card, whatever the scenario: the test mode's hand */
export function allCombatCards(): CombatCard[] {
  return TEMPLATES.map(({ copies: _, ...card }) => ({ ...card, id: `${card.id}-1` }));
}

/** The combat deck this side gets in the scenario */
export function combatDeckFor(scenario: Scenario, faction: Faction): CombatCard[] {
  const enemy: Faction = faction === "Axis" ? "Allies" : "Axis";
  return buildDeck(TEMPLATES, {
    attacker: scenario.attacker === faction,
    tanks: hasUnits(scenario, faction, UnitType.TANK),
    artillery: hasUnits(scenario, faction, UnitType.ARTILLERY),
    enemyTanks: hasUnits(scenario, enemy, UnitType.TANK),
    towns: scenario.tiles[HexType.TOWN]?.length ?? 0,
    bigGuns: scenario.bigGuns?.includes(faction) ?? true,
    air: scenario.airPower?.[faction === "Axis" ? "axis" : "allies"] ?? 1,
  });
}
