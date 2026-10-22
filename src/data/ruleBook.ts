// data/ruleBook.ts
// The rule book, opened from the menu: a tutorial on playing a game with the
// app, and the house rules that differ from the official Memoir '44 rules
// (Days of Wonder's 2004 rulebook and the base game's cards). The numbers come
// from the data files; when a rule changes, change its text here too.
import { TurnPhase } from "../types/gameManager";
import { CARD_COOLDOWN_TURNS } from "./actionCards";
import { Localized } from "../i18n/lang";
import { ARTILLERY_CREW_FIGURES, FIGURES } from "./figures";
import { UnitType } from "../game-core/unit";
import { VISION, VISION_FROM_HILL } from "../game-core/fogOfWar";
import { TERRAIN } from "./terrain";
import { FORD_FIRE_DICE } from "./fireQuestions";
import { HexType } from "../types/hex";

const infantry = FIGURES[UnitType.INFANTRY];
const armor = FIGURES[UnitType.TANK];
const artillery = FIGURES[UnitType.ARTILLERY];

export type TutorialStepId = "setup" | "turn" | "card" | "orders" | "movement" | "battle" | "final" | "tips";

/** A page of the tutorial */
export interface TutorialStep {
  id: TutorialStepId;
  title: Localized;
  /** The turn phase the page is about, picked out in the row of phases */
  phase?: TurnPhase;
  points: readonly Localized[];
}

export type HouseRuleGroupId = "simultaneous" | "terrain" | "dice" | "commandCards" | "supplies" | "passAndPlay" | "optional";

/** A rule played differently from the official game */
export interface HouseRule {
  title: Localized;
  /** What the official rules say; left out for a rule that is new */
  official?: Localized;
  /** How it's played with the app */
  house: Localized;
}

export interface HouseRuleGroup {
  id: HouseRuleGroupId;
  title: Localized;
  rules: readonly HouseRule[];
}

export const TUTORIAL: readonly TutorialStep[] = [
  {
    id: "setup",
    title: { es: "Antes de empezar", en: "Before you start" },
    points: [
      {
        es: "Cada jugador usa su propio dispositivo junto al tablero. La app solo conoce tu bando: no juega por el rival.",
        en: "Each player uses their own device next to the board. The app only knows your side: it doesn't play the opponent.",
      },
      {
        es: "Elegid el mismo escenario y cada uno su bando. Montad el tablero como en el mapa del escenario.",
        en: "Pick the same scenario, and a side each. Set up the board as on the scenario's map.",
      },
      {
        es: "Si usáis una regla opcional de «Ajustes», activadla en los dos dispositivos.",
        en: "If you use an optional rule from \"Settings\", turn it on on both devices.",
      },
      {
        es: "La mesa manda: si el mapa de la app no coincide con el tablero, se corrige el mapa. Las medallas y la victoria se llevan en la mesa.",
        en: "The table rules: if the app's map doesn't match the board, fix the map. Medals and victory are kept on the table.",
      },
    ],
  },
  {
    id: "turn",
    title: { es: "Un turno a la vez", en: "One turn at once" },
    points: [
      {
        es: "Los dos bandos juegan cada turno al mismo tiempo, en cinco fases: Carta, Órdenes, Movimiento, Batalla y Final.",
        en: "Both sides play each turn at the same time, in five phases: Card, Orders, Movement, Battle and Final.",
      },
      {
        es: "El bando atacante del escenario juega el turno 1 él solo, como turno extra. El defensor espera y empieza en el turno 2.",
        en: "The scenario's attacking side plays turn 1 alone, as an extra turn. The defender waits and starts on turn 2.",
      },
      {
        es: "En un escenario con paracaidistas, antes del primer turno tocas en el mapa dónde ha caído cada uno en la mesa.",
        en: "In a scenario with paratroopers, before the first turn you tap on the map where each one landed on the table.",
      },
      {
        es: "La partida se guarda sola: si se recarga la página, sigue donde estaba.",
        en: "The game saves itself: if the page reloads, it carries on where it was.",
      },
    ],
  },
  {
    id: "card",
    title: { es: "1. Carta", en: "1. Card" },
    phase: TurnPhase.PICK_CARDS,
    points: [
      {
        es: `Elige en secreto una carta de mando, o ninguna. Tienes todas desde el principio; cada una cuesta suministros, que se pagan al jugarla, y después espera ${CARD_COOLDOWN_TURNS} turnos para volver a jugarse.`,
        en: `Pick a command card in secret, or none. You hold them all from the start; each costs supplies, paid when you play it, and then waits ${CARD_COOLDOWN_TURNS} turns before it can be played again.`,
      },
      {
        es: "Pulsa «Jugar», o «Sin carta». Mientras no des ninguna orden, «Cambiar carta» te devuelve aquí.",
        en: "Press \"Play\", or \"No card\". Until you give an order, \"Change card\" brings you back here.",
      },
    ],
  },
  {
    id: "orders",
    title: { es: "2. Órdenes", en: "2. Orders" },
    phase: TurnPhase.ORDER_UNITS,
    points: [
      {
        es: "Toca una unidad y después la casilla adonde va, o mantenla en su casilla. Cualquier unidad puede recibir una orden; la que no la recibe descansa. El mapa marca desde dónde podrá disparar.",
        en: "Tap a unit, then the hex it goes to, or hold it where it is. Any unit can be ordered; one that isn't rests. The map shows where it can still fire from.",
      },
      {
        es: "Si la carta marca casillas (Cortina de Fuego, Refuerzos…), márcalas en el mapa.",
        en: "If the card marks hexes (Barrage, Reinforcements…), mark them on the map.",
      },
      {
        es: "«Confirmar órdenes» las fija: ya no se pueden cambiar. Dalas sin mirar la pantalla del rival.",
        en: "\"Confirm orders\" locks them: they can't be changed. Give them without looking at the opponent's screen.",
      },
    ],
  },
  {
    id: "movement",
    title: { es: "3. Movimiento", en: "3. Movement" },
    phase: TurnPhase.MOVEMENT,
    points: [
      {
        es: "Enseñaos las pantallas: cada uno ve el mapa y la carta que juega el otro.",
        en: "Show each other your screens: each of you sees the other's map and the card played.",
      },
      {
        es: "Mueve en la mesa las unidades con flecha y pon un marcador de batalla en las que disparan.",
        en: "Move the units with an arrow on the table, and put a battle marker on the ones that fire.",
      },
      {
        es: "Si dos unidades enemigas pasan por la misma casilla o acaban en ella, chocan: el choque se tira al empezar la batalla.",
        en: "If two enemy units go through the same hex or end on it, they collide: the collision is rolled as the battle starts.",
      },
    ],
  },
  {
    id: "battle",
    title: { es: "4. Batalla", en: "4. Battle" },
    phase: TurnPhase.BATTLE,
    points: [
      {
        es: "Se dispara por pasos: choques, ataques de cartas, unidades sin mover y, al final, las que se movieron. El atacante empieza y luego alternáis, una unidad cada uno.",
        en: "Firing goes in steps: collisions, card attacks, units that didn't move and, last, the ones that moved. The attacker starts, then you take turns, one unit each.",
      },
      {
        es: "Toca la fila de una unidad, toca el objetivo en el mapa y responde lo que pregunte. La app tira los dados y dice los impactos, las retiradas y los suministros.",
        en: "Tap a unit's row, tap the target on the map and answer what it asks. The app rolls the dice and tells you the hits, retreats and supplies.",
      },
      {
        es: "Quita las bajas en la mesa. La primera bandera de una unidad la inmoviliza (márcala); cada bandera más la hace retirarse 1 casilla en el acto.",
        en: "Remove the casualties on the table. A unit's first flag pins it (mark it); each flag after that makes it retreat 1 hex at once.",
      },
      {
        es: "Los dados de más de la carta jugada (La Hora de la Verdad) se suman solos al disparar.",
        en: "The card played adds its extra dice by itself when firing (Their Finest Hour).",
      },
    ],
  },
  {
    id: "final",
    title: { es: "5. Final", en: "5. Final" },
    phase: TurnPhase.END_OF_TURN,
    points: [
      {
        es: "Quita las marcas de inmovilizada y refleja en «Actualizar mapa» las bajas y las retiradas de los dos bandos.",
        en: "Take off the pinned markers, and mirror both sides' casualties and retreats in \"Update map\".",
      },
      {
        es: "No se roba ni se recibe nada: pulsa «Empezar turno».",
        en: "Nothing is drawn or handed out: press \"Start turn\".",
      },
    ],
  },
  {
    id: "tips",
    title: { es: "Consejos", en: "Tips" },
    points: [
      {
        es: "En la partida, «Menú» tiene el historial de turnos, los ajustes y este reglamento.",
        en: "In the game, \"Menu\" has the turn history, the settings and this rule book.",
      },
      {
        es: "Toca cualquier carta para leer su texto entero. Los botones «i» e «Instrucciones» explican cada paso.",
        en: "Tap any card to read its full text. The \"i\" and \"Instructions\" buttons explain each step.",
      },
      {
        es: "Si el mapa no coincide con la mesa, usa «Actualizar mapa» en Órdenes, antes de dar ninguna orden, o en la fase final.",
        en: "If the map doesn't match the table, use \"Update map\" in Orders, before giving any order, or in the final phase.",
      },
      {
        es: "Los mapas del «Editor de mapas» se guardan en «Mis mapas», solo en este dispositivo. «Exportar» guarda uno en un archivo; una vez añadido al catálogo de la app, todos los dispositivos lo tienen al actualizarla.",
        en: "Maps from the \"Map editor\" are kept in \"My maps\", on this device only. \"Export\" saves one as a file; once it's added to the app's catalog, every device has it when the app updates.",
      },
    ],
  },
];

export const HOUSE_RULES: readonly HouseRuleGroup[] = [
  {
    id: "simultaneous",
    title: { es: "Turnos simultáneos", en: "Simultaneous turns" },
    rules: [
      {
        title: { es: "El turno", en: "The turn" },
        official: {
          es: "Los jugadores se alternan: cada uno juega su carta, ordena, mueve y combate en su turno.",
          en: "Players take turns: each one plays a card, orders, moves and battles on their own turn.",
        },
        house: {
          es: "Los dos bandos juegan el mismo turno a la vez: eligen carta en secreto, dan las órdenes en la app sin ver las del rival, se enseñan las pantallas y después mueven y combaten juntos.",
          en: "Both sides play the same turn at once: they pick a card in secret, give their orders in the app without seeing the opponent's, show each other their screens, then move and battle together.",
        },
      },
      {
        title: { es: "El primer turno", en: "The first turn" },
        official: {
          es: "Empieza el bando que dice el escenario, y después se alterna.",
          en: "The side the scenario names goes first, then the players alternate.",
        },
        house: {
          es: "El bando atacante (el que empezaría) juega un turno extra él solo, sin que el defensor responda. Los suministros que saca cuentan, pero no los puede gastar hasta el turno 2: no juega carta.",
          en: "The attacking side (the one that would go first) plays an extra turn alone, and the defender can't respond. The supplies it rolls count, but it can't spend them until turn 2: it plays no card.",
        },
      },
      {
        title: { es: "Órdenes secretas y fijas", en: "Secret, fixed orders" },
        official: {
          es: "Anuncias qué unidades tienen orden y las mueves una a una, viendo cómo va el turno.",
          en: "You announce which units are ordered and move them one at a time, seeing how the turn goes.",
        },
        house: {
          es: "Las órdenes se dan en el mapa de la app antes de ver las del rival: adónde va cada unidad y si dispara. Una vez confirmadas no se cambian.",
          en: "Orders are given on the app's map before seeing the opponent's: where each unit goes and whether it fires. Once confirmed, they can't change.",
        },
      },
      {
        title: { es: "Choques", en: "Collisions" },
        house: {
          es: "Si dos unidades enemigas pasan por la misma casilla o acaban en ella, combaten antes que nadie: cada una tira sus dados de asalto cercano menos 1, sin contar el terreno, y las banderas no se pueden ignorar (inmovilizan y hacen retirarse como en la batalla). Si nadie saca bandera, las dos vuelven 1 casilla por donde vinieron. El choque cuenta como el disparo de la unidad.",
          en: "If two enemy units go through the same hex or end on it, they battle before anyone else: each rolls its close assault dice minus 1, terrain doesn't count, and flags can't be ignored (they pin and push back as in the battle). If neither rolls a flag, both go back 1 hex the way they came. The collision counts as the unit's shot.",
        },
      },
      {
        title: { es: "Orden de fuego", en: "Firing order" },
        official: {
          es: "El jugador del turno combate con sus unidades en el orden que quiera.",
          en: "The player whose turn it is battles with their units in any order.",
        },
        house: {
          es: "Los dos bandos se alternan, una unidad cada uno, empezando por el atacante: primero los choques, después los ataques de cartas, luego las unidades que no se movieron y, por último, las que se movieron.",
          en: "The two sides take turns, one unit each, the attacker first: collisions, then card attacks, then units that didn't move and, last, units that moved.",
        },
      },
      {
        title: { es: "Retiradas: inmovilizada", en: "Retreats: pinned" },
        official: {
          es: "La unidad se retira una casilla por bandera en cuanto se resuelven los impactos.",
          en: "The unit retreats one hex per flag as soon as the hits are resolved.",
        },
        house: {
          es: "La primera bandera que recibe una unidad en el turno no la hace retirarse: queda inmovilizada hasta el final del turno. La infantería inmovilizada dispara con 1 dado menos; los blindados y la artillería no pierden dados. Cada bandera más (también en el mismo disparo, y también en asalto cercano) la hace retirarse 1 casilla en el acto, y ya no combate más este turno. Así, para echar a una unidad hacen falta dos banderas.",
          en: "A unit's first flag in a turn doesn't make it retreat: it's pinned until the turn ends. Pinned infantry fires with 1 die less; armor and artillery lose no dice. Each flag after that (in the same shot too, and in close assault too) makes it retreat 1 hex at once, and it doesn't battle again this turn. So it takes two flags to push a unit back.",
        },
      },
      {
        title: { es: "Enemigo al lado", en: "Enemy next to it" },
        house: {
          es: "Una unidad que tiene una unidad enemiga en una casilla adyacente solo puede disparar en asalto cercano, a una unidad adyacente: no puede disparar a distancia.",
          en: "A unit with an enemy unit in an adjacent hex can only fire in close assault, at an adjacent unit: it can't fire at range.",
        },
      },
      {
        title: { es: "Tomar terreno", en: "Taking ground" },
        official: {
          es: "La infantería que gana un asalto cercano puede avanzar a la casilla que deja el enemigo. Un blindado puede avanzar y combatir otra vez (arrollamiento), también a distancia.",
          en: "Infantry that wins a close assault may advance into the hex the enemy leaves. Armor may advance and battle again (overrun), at range too.",
        },
        house: {
          es: "Solo los blindados toman terreno; la infantería nunca arrolla. Si el objetivo se retira o es eliminado (una sola bandera solo lo inmoviliza), el blindado ocupa su casilla y combate otra vez, solo en asalto cercano. Una vez por unidad y turno.",
          en: "Only armor takes ground; infantry never overruns. If the target retreats or is eliminated (a single flag only pins it), the armor moves into its hex and battles again, in close assault only. Once per unit per turn.",
        },
      },
    ],
  },
  {
    id: "terrain",
    title: { es: "Terreno", en: "Terrain" },
    rules: [
      {
        title: { es: "Playa", en: "Beach" },
        house: {
          es: `Una unidad que empieza su movimiento en la playa, o entra en ella, mueve ${TERRAIN[HexType.BEACH].moveThrough} casillas como mucho, aunque una carta le deje mover más. Se dispara a ella como en campo abierto.`,
          en: `A unit whose move starts on a beach, or enters one, moves ${TERRAIN[HexType.BEACH].moveThrough} hexes at most, even when a card lets it move further. It's fired at as on open ground.`,
        },
      },
      {
        title: { es: "Pantano", en: "Swamp" },
        house: {
          es: "Una unidad que entra en un pantano se para ahí, y puede disparar. Una que empieza su movimiento en un pantano mueve 1 casilla. Se dispara a ella como en campo abierto.",
          en: "A unit that enters a swamp stops there, and may still fire. One whose move starts in a swamp moves 1 hex. It's fired at as on open ground.",
        },
      },
      {
        title: { es: "Océano", en: "Ocean" },
        house: {
          es: `Una unidad que empieza su movimiento en el océano, o entra en él, mueve ${TERRAIN[HexType.OCEAN].moveThrough} casilla. Una unidad en el océano no puede disparar, ni retroceder: cada casilla que tendría que retroceder es un impacto. Se dispara a ella como en campo abierto.`,
          en: `A unit whose move starts in the ocean, or enters it, moves ${TERRAIN[HexType.OCEAN].moveThrough} hex. A unit in the ocean can't fire, nor retreat: each hex it should retreat is a hit instead. It's fired at as on open ground.`,
        },
      },
      {
        title: { es: "Río vadeable", en: "Fordable river" },
        house: {
          es: `En los mapas que lo dicen, los ríos se pueden vadear. Cualquier unidad puede entrar en el río y se para ahí; puede disparar, con ${-FORD_FIRE_DICE} dado menos, y también puede retirarse a él. Se dispara a ella como en campo abierto.`,
          en: `On the maps that say so, rivers can be forded. Any unit may enter the river and stops there; it may still fire, with ${-FORD_FIRE_DICE} die fewer, and may retreat into it too. It's fired at as on open ground.`,
        },
      },
    ],
  },
  {
    id: "dice",
    title: { es: "Dados", en: "Dice" },
    rules: [
      {
        title: { es: "El tanque impacta a la artillería", en: "The tank symbol hits artillery" },
        official: {
          es: "El tanque solo impacta a blindados; a la artillería solo la impactan las granadas.",
          en: "The tank symbol only hits armor; artillery is only hit by grenades.",
        },
        house: {
          es: "El tanque impacta a blindados y a artillería, así que al disparar solo importa si el objetivo es infantería o no. La granada impacta a todo.",
          en: "The tank symbol hits armor and artillery alike, so a shot only asks whether the target is infantry. A grenade hits anything.",
        },
      },
      {
        title: { es: "La estrella es un suministro", en: "The star is a supply" },
        official: {
          es: "La estrella es un fallo, salvo con algunas cartas.",
          en: "The star is a miss, except with a few cards.",
        },
        house: {
          es: "Cada estrella que sacan tus unidades al disparar te da 1 suministro, salvo si una regla la cuenta como impacto.",
          en: "Each star your units roll when firing earns you 1 supply, unless a rule counts it as a hit.",
        },
      },
      {
        title: { es: "Daño limitado", en: "Limited damage" },
        official: {
          es: "Se aplican todos los resultados de la tirada.",
          en: "Every result of the roll applies.",
        },
        house: {
          es: "Se tiran todos los dados, pero la unidad que dispara no aplica más impactos que figuras le quedan (uno más con una carta que da dados extra). Solo se descartan impactos: las banderas y los suministros cuentan siempre. La app los descarta sola, guardando antes las granadas: en Pasar y jugar sabe las figuras; en tablets propias se le dicen con «Aplicar menos impactos».",
          en: "All the dice are rolled, but the firing unit applies no more hits than it has figures left (one more with a card that gives extra dice). Only hits are discarded: flags and supplies always count. The app discards them itself, keeping grenades first: in pass and play it knows the figures; on own tablets you tell it with \"Apply fewer hits\".",
        },
      },
      {
        title: { es: "El dado de las cartas de ataque", en: "The attack cards' die" },
        official: {
          es: "Cortina de Fuego tira los dados normales; Poder aéreo cuenta las estrellas como impacto.",
          en: "Barrage rolls the normal dice; Air Power counts stars as hits.",
        },
        house: {
          es: "Cortina de Fuego, Poder aéreo y Bombardeo aéreo tiran un dado con una segunda granada en lugar de la estrella, y las retiradas no se pueden ignorar.",
          en: "Barrage, Air Power and Air Bombardment roll a die with a second grenade in place of the star, and retreats can't be ignored.",
        },
      },
    ],
  },
  {
    id: "commandCards",
    title: { es: "Cartas de mando y órdenes", en: "Command cards and orders" },
    rules: [
      {
        title: { es: "Todas las cartas en la mano", en: "Every card in your hand" },
        official: {
          es: "Un mazo de 60 cartas compartido: cada jugador tiene unas pocas en la mano y roba una al final de su turno.",
          en: "One 60-card deck, shared: each player holds a few and draws one at the end of their turn.",
        },
        house: {
          es: `Cada bando tiene todas sus cartas desde el principio y no roba nunca: La Hora de la Verdad, Reabastecimiento, Repostaje, Refuerzos y, según el escenario, Bombardeo aéreo, Poder aéreo (con salidas aéreas) y Cortina de Fuego (con artillería pesada). Cada una cuesta suministros, que se pagan al jugarla; el escenario puede abaratar alguna.`,
          en: `Each side holds all its cards from the start and never draws: Their Finest Hour, Resupply, Refuel, Reinforcements and, by scenario, Air Bombardment, Air Power (with air sorties) and Barrage (with heavy guns). Each costs supplies, paid when you play it; the scenario may make some cheaper.`,
        },
      },
      {
        title: { es: "Una carta por turno, o ninguna", en: "One card a turn, or none" },
        house: {
          es: `Juegas una carta como mucho, y no hace falta jugar ninguna. Una carta jugada espera ${CARD_COOLDOWN_TURNS} turnos para volver a jugarse: la del turno 2 vuelve en el turno ${2 + CARD_COOLDOWN_TURNS}.`,
          en: `You play one card at most, and you don't have to play any. A card played waits ${CARD_COOLDOWN_TURNS} turns before it can be played again: one played on turn 2 is back on turn ${2 + CARD_COOLDOWN_TURNS}.`,
        },
      },
      {
        title: { es: "Órdenes", en: "Orders" },
        official: {
          es: "La carta dice cuántas unidades se ordenan y en qué sección.",
          en: "The card says how many units are ordered, and in which section.",
        },
        house: {
          es: "No hay secciones: cualquier unidad puede recibir una orden, y la que no la recibe descansa. Cada unidad mueve y dispara como de costumbre.",
          en: "There are no sections: any unit can be ordered, and one that isn't rests. Each unit moves and fires as usual.",
        },
      },
    ],
  },
  {
    id: "supplies",
    title: { es: "Suministros", en: "Supplies" },
    rules: [
      {
        title: { es: "Suministros", en: "Supplies" },
        house: {
          es: "Empiezas sin suministros. Ganas 1 por cada estrella que sacan tus unidades al disparar, y los gastas en cartas de mando. Al final del turno no se recibe nada.",
          en: "You start with no supplies. You earn 1 for each star your units roll when firing, and spend them on command cards. Nothing is handed out at the end of the turn.",
        },
      },
      {
        title: { es: "Refuerzos", en: "Reinforcements" },
        house: {
          es: "La carta marca una cruz en el mapa. Al empezar la fase final llega a esa casilla una unidad de infantería, sin tirar dado; si la casilla está ocupada, eliges otra libre.",
          en: "The card marks a cross on the map. As the final phase starts, an infantry unit arrives on that hex, with no die roll; if the hex is taken, you pick another empty one.",
        },
      },
    ],
  },
  {
    id: "passAndPlay",
    title: { es: "Pasar y jugar (los dos bandos en un dispositivo)", en: "Pass and play (both sides on one device)" },
    rules: [
      {
        title: { es: "Todo en la app", en: "Everything in the app" },
        house: {
          es: "Sin tablero: la app conoce los dos ejércitos, mueve las unidades, tira los dados y aplica los impactos y las retiradas. Cada jugador elige carta y da órdenes en secreto; una pantalla tapa el juego cada vez que el dispositivo cambia de manos. El mapa se ve siempre desde el lado del bando elegido en el menú, sin girar al pasar el dispositivo. Un mapa más grande que el estándar, hecho en el editor de mapas, se juega así o contra el ordenador.",
          en: "No board: the app knows both armies, moves the units, rolls the dice and deals the hits and retreats. Each player picks a card and gives orders in secret; a screen covers the game every time the device changes hands. The map is always seen from the side picked in the menu, without turning round as the device is passed. A map bigger than the standard one, made in the map editor, is played this way or against the computer.",
        },
      },
      {
        title: { es: "Figuras", en: "Figures" },
        official: {
          es: "Infantería 4 figuras, blindados 3, artillería 2; cada impacto quita una.",
          en: "Infantry 4 figures, armor 3, artillery 2; each hit takes one.",
        },
        house: {
          es: `Infantería ${infantry.figures} figuras; blindados ${armor.figures}, de ${armor.hitsPerFigure} impactos cada una (una figura tocada se marca en rojo y cae al siguiente impacto); los impactos de cada unidad en el turno se ven en el mapa hasta que acaba; artillería ${artillery.figures}, y al caer deja a sus artilleros: ${ARTILLERY_CREW_FIGURES} figura de infantería. Una unidad no aplica más impactos que figuras le quedan.`,
          en: `Infantry ${infantry.figures} figures; armor ${armor.figures}, ${armor.hitsPerFigure} hits each (a figure hit once is marked red and falls to the next hit); each unit's hits this turn show on the map until the turn ends; artillery ${artillery.figures}, and when it falls its crew stays: ${ARTILLERY_CREW_FIGURES} infantry figure. A unit applies no more hits than the figures it has left.`,
        },
      },
      {
        title: { es: "Movimiento a la vez", en: "Moving at once" },
        house: {
          es: "Tras mostrar las órdenes, todas las unidades avanzan casilla a casilla a la vez. Dos enemigas que entran en la misma casilla, se cruzan o una entra en la de otra se paran antes y chocan: tiran las dos sus dados de asalto cercano menos 1, sin terreno. Una unidad cuya orden no le deja disparar no tira. Si ninguna saca bandera, ninguna se gana la casilla: la que se movió vuelve una casilla atrás por donde vino; la que no se movió se queda. Una unidad que ha combatido en un choque ya no dispara en la batalla. Las unidades de un mismo bando no se estorban al moverse: solo cuenta la casilla en la que acaba cada una.",
          en: "After the orders are shown, every unit moves one hex at a time, all together. Two enemies entering the same hex, crossing, or one entering the other's hex stop short and collide: both roll their close assault dice minus 1, no terrain. A unit whose order doesn't let it fire doesn't roll. If neither rolls a flag, neither earns the hex: the one that moved goes one hex back the way it came; one that didn't move stays. A unit that fought in a collision doesn't fire in the battle. Units of the same side don't get in each other's way as they move: only the hex each one ends on counts.",
        },
      },
      {
        title: { es: "La batalla", en: "The battle" },
        house: {
          es: "Una pantalla para los dos: disparan primero las unidades que no se movieron y luego las que se movieron, alternando los bandos y empezando el atacante. Se toca en el mapa la unidad que dispara y luego su objetivo, que muestra los dados que tira; los dados caen sobre el mapa y lo que hacen sale al lado. Solo se dispara a unidades enemigas, que tapan la vista. Los sacos terreros ignoran una bandera.",
          en: "One screen for both: the units that didn't move fire first, then the ones that moved, the sides alternating and the attacker first. Tap the unit that fires on the map, then its target, which shows the dice it rolls; the dice land on the map and what they do shows beside it. Only enemy units can be fired at, and they block the view. Sandbags ignore one flag.",
        },
      },
      {
        title: { es: "Inmovilizada y retiradas", en: "Pinned and retreats" },
        house: {
          es: "La primera bandera inmoviliza la unidad (una bandera en su ficha) hasta el final del turno. Cada bandera más la hace retirarse en el acto una casilla hacia su borde, eligiendo su jugador; cada casilla que no puede retirarse (no hay ninguna libre detrás) cuenta como un impacto, y ya no combate más este turno. Una retirada por un choque se hace al empezar la batalla. Si tras un asalto cercano el objetivo se retiró o fue eliminado, los blindados pueden entrar en su casilla y disparar otra vez; la infantería puede entrar, sin volver a disparar.",
          en: "The first flag pins the unit (a flag on its token) until the turn ends. Each flag after that makes it retreat at once one hex toward its edge, its player choosing; each hex it can't retreat (no free hex behind it) counts as a hit, and it doesn't battle again this turn. A retreat from a collision is made as the battle starts. If after a close assault the target retreated or was eliminated, armor may move into its hex and fire again; infantry may move in, without firing again.",
        },
      },
      {
        title: { es: "Cartas de ataque en el mapa", en: "Attack cards on the map" },
        house: {
          es: "Las cartas de ataque se tiran antes de que nadie dispare.",
          en: "Attack cards are rolled before anyone fires.",
        },
      },
      {
        title: { es: "Contra el ordenador", en: "Against the computer" },
        house: {
          es: "Con «Contra el ordenador» juegas un bando y el ordenador el otro, en tu dispositivo y sin pantalla que tape el juego. Solo ve lo que vería un jugador: tus órdenes no, hasta que se muestran. Elige su carta y da sus órdenes a la vez que tú; en la batalla dispara tras una pausa, y sus dados quedan sobre el mapa hasta que tocas «Seguir». Busca casillas desde las que disparar con buena cobertura y dispara donde más daño hace (rematando unidades tocadas). Por ahora no juega cartas de mando.",
          en: "With \"Against the computer\" you play one side and the computer the other, on your device and with no screen covering the game. It sees only what a player would: not your orders, until they're shown. It picks its card and gives its orders as you give yours; in the battle it fires after a pause, and its dice stay on the map until you tap \"Continue\". It looks for hexes to fire from with good cover and fires where it does most damage (finishing off weakened units). For now it plays no command cards.",
        },
      },
      {
        title: { es: "Niebla de guerra", en: "Fog of war" },
        house: {
          es: `En pasar y jugar y contra el ordenador, con «Niebla de guerra» en Ajustes (encendida si no la apagas). Contra el ordenador: al principio de la partida se ven los dos ejércitos. Cuando las unidades han movido y empieza la batalla, solo ves las unidades enemigas a ${VISION} casillas o menos de una de las tuyas y en su línea de visión (los bosques, pueblos, colinas y otras unidades la tapan); una unidad tuya en una colina ve a ${VISION_FROM_HILL}. Lo que ves cambia durante la batalla, al retirarse o caer unidades, y lo que veías al terminarla es lo que sabes al dar las órdenes del turno siguiente: las unidades que salen de la vista desaparecen del mapa. Las casillas que no ves quedan a oscuras. Solo puedes disparar a lo que ves; una artillería con orden de disparar se ve desde que empieza la batalla, y una unidad oculta que dispara se ve el resto del turno. Las demás unidades que pueden dispararte siempre están a la vista: su alcance es menor que la vista. Un bombardeo o un ataque aéreo alcanza lo que haya en sus casillas, se vea o no. El ordenador juega con la misma niebla. Entre dos jugadores la niebla solo cuenta en la batalla, en la pantalla que compartís: una casilla queda a oscuras salvo que la vean los dos bandos, y cada unidad se ve solo si su enemigo la ve.`,
          en: `In pass and play and against the computer, with "Fog of war" in Settings (on unless you switch it off). Against the computer: at the start of the game both armies are known. Once the units have moved and the battle starts, you only see the enemy units ${VISION} hexes or less from one of yours and in its line of sight (forests, towns, hills and other units block it); a unit of yours on a hill sees ${VISION_FROM_HILL}. What you see changes during the battle as units retreat or fall, and what you saw when it ended is what you know while giving the next turn's orders: units that go out of sight disappear from the map. The hexes you don't see are darkened. You can only fire at what you see; artillery ordered to fire is seen from the start of the battle, and a hidden unit that fires is seen for the rest of the turn. The other units that can fire at you are always in sight: their range is shorter than the sight. A barrage or an air attack hits whatever is on its hexes, seen or not. The computer plays under the same fog. Between two players the fog only counts in the battle, on the screen you share: a hex is darkened unless both sides see it, and each unit is seen only when its enemy sees it.`,
        },
      },
      {
        title: { es: "Medallas y victoria", en: "Medals and victory" },
        official: {
          es: "Gana el primero en conseguir las medallas del escenario (normalmente de 4 a 6): una por cada unidad enemiga eliminada y, en algunos escenarios, por tomar y mantener ciertas casillas.",
          en: "The first side to win the scenario's medals (usually 4 to 6) wins: one for each enemy unit eliminated and, in some scenarios, for taking and holding certain hexes.",
        },
        house: {
          es: "Cada unidad enemiga destruida es una medalla (una artillería cuyos artilleros quedan también cuenta). Cada casilla objetivo de un bando (un puente, un pueblo) es una medalla para él mientras una de sus unidades esté en ella al final del turno; si la deja o la pierde, deja de contar. Al final de cada turno, tras la batalla, gana el bando que haya llegado a las medallas del escenario; si llegan los dos, el que tenga más, y con las mismas se sigue jugando. Un bando sin unidades pierde. Los objetivos se ven en el mapa como una medalla del color de su bando, llena mientras la ocupa; las medallas de cada bando, en la cabecera.",
          en: "Each enemy unit destroyed is a medal (an artillery unit whose crew stays counts too). Each of a side's objective hexes (a bridge, a town) is a medal for it while one of its units stands there at the end of the turn; once it leaves or loses it, it stops counting. At the end of each turn, after the battle, the side that has reached the scenario's medals wins; if both have, the one with more, and with as many each the game goes on. A side with no units left loses. The objectives show on the map as a medal in their side's colour, solid while it holds them; each side's medals are in the header.",
        },
      },
    ],
  },
  {
    id: "optional",
    title: { es: "Reglas opcionales («Ajustes» del menú)", en: "Optional rules (the menu's \"Settings\")" },
    rules: [
      {
        title: { es: "Dado de 8 caras a distancia", en: "8-sided die at range" },
        official: {
          es: "Siempre se tiran los dados de 6 caras.",
          en: "The 6-sided dice are always rolled.",
        },
        house: {
          es: "A una unidad no adyacente se tira un dado de 8 caras: 3 infantería, 2 tanques, 1 bandera y 2 suministros, sin granada.",
          en: "At a unit that isn't adjacent, an 8-sided die is rolled: 3 infantry, 2 tanks, 1 flag and 2 supplies, no grenade.",
        },
      },
      {
        title: { es: "La artillería destruida queda como infantería", en: "Destroyed artillery stays as infantry" },
        official: {
          es: "Una unidad eliminada sale del tablero.",
          en: "An eliminated unit leaves the board.",
        },
        house: {
          es: "Cuando eliminan una de tus artillerías, sus artilleros siguen luchando: en su casilla queda una unidad de infantería.",
          en: "When one of your artillery units is eliminated, its crew fights on: an infantry unit stays on its hex.",
        },
      },
    ],
  },
];
