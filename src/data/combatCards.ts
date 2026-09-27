// data/combatCards.ts
// The house combat cards (docs/house-rules.md, "New combat cards" and "Combat
// cards in the player's set"). Counts are the player's set with the extras in
// brackets, plus 1 of each new card; costs are the ones marked with a pen.
// Tune them here.
//
// Not in the deck yet: the command combat cards that act on the opponent's
// hand or orders (Spies, HQ Distraction, Message Interception, Lost Message),
// which come in Step 33.
import { CombatCard, CombatPhase, MarkerRule } from "../game-core/combatCard";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";

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
  count: number;
  marker?: MarkerRule;
  tableReminder?: string;
}

type Extra = Pick<CombatCardTemplate, "marker" | "tableReminder">;

const order = (
  id: string,
  name: string,
  cost: number,
  count: number,
  description: string,
  extra: Extra = {}
): CombatCardTemplate => ({ id, name, description, cost, phase: "order", count, ...extra });

const battle = (
  id: string,
  name: string,
  cost: number,
  count: number,
  description: string,
  extra: Extra = {}
): CombatCardTemplate => ({ id, name, description, cost, phase: "battle", count, ...extra });

const STANDARD: CombatCardTemplate[] = [
  // Played with the command card
  order("rattenkrieg", "Rattenkrieg", 2, 2,
    "1 infantería en un edificio o junto a uno se mueve hasta 3 casillas por cualquier terreno y debe terminar en un edificio. Aun así puede combatir."),
  order("forest", "Lucha en el bosque", 1, 2, "1 unidad entra en un bosque y aun así puede combatir."),
  order("armor-forward", "Blindados adelante", 2, 1,
    "3 unidades de blindados ignoran el terreno al moverse (las restricciones de combate se mantienen)."),
  order("return-to-duty", "Vuelta al servicio", 4, 1,
    "Tira 2 dados por cada infantería debilitada con orden: cada símbolo de infantería o estrella recupera 1 figura."),
  order("medic", "Médico", 2, 1, "1 infantería debilitada con orden recupera hasta 2 figuras."),
  order("mechanic", "Mecánico", 2, 1, "1 unidad de blindados o artillería debilitada con orden recupera 1 figura."),
  order("infiltrators", "Tras las líneas enemigas", 4, 3,
    "1 unidad dispara y se mueve antes que cualquier otro ataque. El movimiento tras el ataque se hace al final, con las retiradas."),
  order("sniper", "Francotirador", 6, 1,
    "Coloca un francotirador junto a una infantería tuya (marca una cruz en el mapa). No puede combatir este turno.",
    { marker: { kind: "cross", count: 1, nextTo: UnitType.INFANTRY } }),
  order("frozen-ground", "Terreno helado", 3, 2, "3 unidades mueven 1 casilla más."),
  order("air-bombardment", "Bombardeo aéreo", 4, 1,
    "Elige 2 casillas que no estén junto a tus unidades: 2 dados en cada una si hay una unidad. Las estrellas cuentan y las banderas no se pueden ignorar.",
    { marker: { kind: "target", count: 2, awayFromOwnUnits: true } }),
  order("house-to-house", "Casa por casa", 1, 2, "1 infantería puede entrar en un edificio y aun así combatir."),
  order("reinforcements", "Refuerzos", 6, 3,
    "Tira 1 dado y, según el mapa, añade la unidad que salga (bandera: no hay refuerzos). Marca con una cruz dónde aparece.",
    { marker: { kind: "cross", count: 1 } }),
  order("tactician", "Táctico", 2, 1, "Cambia la sección de una carta de sección."),
  order("barrage", "Barrera", 4, 1,
    "Marca una casilla: si hay una unidad enemiga, tira 4 dados contra ella. Las estrellas cuentan y las retiradas no se pueden ignorar.",
    { marker: { kind: "target", count: 1 } }),
  order("air-power", "Poder aéreo", 3, 1,
    "Marca 4 casillas adyacentes, en cadena: 1 dado contra cada unidad enemiga que haya en ellas. Las estrellas cuentan y las retiradas no se pueden ignorar.",
    { marker: { kind: "target", count: 4, chain: true } }),

  // Played during the battle, as a reaction
  battle("heat-of-battle", "Fragor del combate", 1, 3,
    "1 infantería que gana un asalto cercano (retirada o eliminación) puede arrollar como los blindados: toma terreno y vuelve a combatir, aunque la casilla lo impida."),
  battle("out-of-ammo", "Sin munición", 4, 3,
    "1 unidad enemiga no puede combatir y se mueve a una casilla libre de su línea de fondo."),
  battle("street-fight", "Lucha callejera", 1, 1, "1 infantería en un edificio o junto a uno tira 1 dado más."),
  battle("ambush", "Emboscada", 3, 4,
    "Cuando una unidad enemiga te ataca en asalto cercano, combates tú primero: si se retira o es eliminada, su ataque no se hace."),
  battle("pull-back", "Repliegue", 3, 2, "Antes de que el enemigo combata, retira tu unidad hasta 2 casillas."),
  battle("out-of-fuel", "Sin combustible", 3, 2,
    "1 unidad de blindados enemiga no puede combatir y vuelve a su casilla de salida."),
  battle("not-a-step-back", "Ni un paso atrás", 1, 1, "1 unidad ignora todas las retiradas."),
  battle("camouflage", "Camuflaje", 2, 1, "Después de la batalla, pon 1 ficha de camuflaje en una unidad con orden.", {
    tableReminder: "Camuflaje: pon la ficha de camuflaje en la mesa, en una unidad con orden.",
  }),
  battle("reposition", "Reposicionamiento", 2, 2, "Después de la batalla, toda la artillería con orden se mueve 2 casillas."),
  battle("fortify", "Fortificar", 1, 5, "Después de la batalla, pon sacos terreros en una infantería o artillería.", {
    tableReminder: "Fortificar: pon sacos terreros en la mesa, en una infantería o artillería.",
  }),
  battle("spotter", "Observador", 1, 2, "1 artillería tira 1 dado más."),
  battle("personal-armor", "Blindaje personal", 1, 1, "Después de que el rival tire, ignora 1 resultado de infantería."),
  battle("explosives", "Explosivos", 1, 1, "1 infantería tira 1 dado más en asalto cercano."),
  battle("shells-shortage", "Escasez de proyectiles", 2, 1, "1 unidad de artillería o blindados enemiga no puede disparar."),
  battle("rifles-up", "¡Fusiles arriba!", 1, 1, "Elige una unidad tuya: dispara antes que nadie."),
];

/**
 * The combat decks a scenario can give each side. Only one for now; more
 * (offensive, defensive, air superiority…) once the app is finished.
 */
export const COMBAT_DECKS = { standard: STANDARD } satisfies Record<string, CombatCardTemplate[]>;

export type CombatDeckId = keyof typeof COMBAT_DECKS;

/** One card per copy; copies get a numbered id so saves can tell them apart */
function buildDeck(templates: CombatCardTemplate[]): CombatCard[] {
  return templates.flatMap(({ count, ...card }) =>
    Array.from({ length: count }, (_, i) => ({ ...card, id: `${card.id}-${i + 1}` }))
  );
}

const decks = Object.fromEntries(
  Object.entries(COMBAT_DECKS).map(([id, templates]) => [id, buildDeck(templates)])
) as Record<CombatDeckId, CombatCard[]>;

/** The combat deck this side uses in the scenario (the standard one unless the scenario says otherwise) */
export function combatDeckFor(scenario: Scenario, faction: Faction): CombatCard[] {
  const id = scenario.combatDecks?.[faction === "Axis" ? "axis" : "allies"] ?? "standard";
  return decks[id];
}
