// data/ruleBook.ts
// The rule book, opened from the menu: a tutorial on playing a game with the
// app, and the house rules that differ from the official Memoir '44 rules
// (Days of Wonder's 2004 rulebook and the base game's cards). The numbers come
// from the data files; when a rule changes, change its text here too.
import { TurnPhase } from "../types/gameManager";
import { END_OF_TURN_COINS, EXTRA_ORDER_COST } from "./coinRules";
import { MAX_COMBAT_CARDS_PER_TURN, MAX_COMBAT_HAND, STARTING_COMBAT_CARDS } from "./combatCards";
import { Localized } from "../i18n/lang";
import { ARTILLERY_CREW_FIGURES, FIGURES } from "./figures";
import { UnitType } from "../game-core/unit";

const infantry = FIGURES[UnitType.INFANTRY];
const armor = FIGURES[UnitType.TANK];
const artillery = FIGURES[UnitType.ARTILLERY];
const EXTRA_INFANTRY = EXTRA_ORDER_COST[UnitType.INFANTRY];
// The texts give tanks and artillery one cost (ruleBook.test.ts checks they're the same)
const EXTRA_ARMOUR = EXTRA_ORDER_COST[UnitType.TANK];

export type TutorialStepId = "setup" | "turn" | "card" | "orders" | "movement" | "battle" | "final" | "tips";

/** A page of the tutorial */
export interface TutorialStep {
  id: TutorialStepId;
  title: Localized;
  /** The turn phase the page is about, picked out in the row of phases */
  phase?: TurnPhase;
  points: readonly Localized[];
}

export type HouseRuleGroupId = "simultaneous" | "dice" | "commandCards" | "supplies" | "passAndPlay" | "optional";

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
        es: "Elige en secreto una carta de mando: al tocarla pasa a «Tu jugada», donde puedes tocarla para leerla o quitarla.",
        en: "Pick a command card in secret: tapping it moves it to \"Your play\", where you can tap it to read it or remove it.",
      },
      {
        es: `Si quieres, añade hasta ${MAX_COMBAT_CARDS_PER_TURN} cartas de combate distintas. Cuestan suministros, que se pagan al jugarlas.`,
        en: `If you like, add up to ${MAX_COMBAT_CARDS_PER_TURN} different combat cards. They cost supplies, paid when you play them.`,
      },
      {
        es: "Pulsa «Jugar». Mientras no des ninguna orden, «Cambiar carta» te devuelve aquí.",
        en: "Press \"Play\". Until you give an order, \"Change card\" brings you back here.",
      },
    ],
  },
  {
    id: "orders",
    title: { es: "2. Órdenes", en: "2. Orders" },
    phase: TurnPhase.ORDER_UNITS,
    points: [
      {
        es: "Toca una unidad resaltada y después la casilla adonde va, o mantenla en su casilla. El mapa marca desde dónde podrá disparar.",
        en: "Tap a highlighted unit, then the hex it goes to, or hold it where it is. The map shows where it can still fire from.",
      },
      {
        es: `Una orden extra cuesta ${EXTRA_INFANTRY} suministros por una infantería y ${EXTRA_ARMOUR} por un tanque o una artillería: cualquier unidad, sin las ventajas de la carta.`,
        en: `An extra order costs ${EXTRA_INFANTRY} supplies for infantry and ${EXTRA_ARMOUR} for a tank or artillery: any unit, without the card's benefits.`,
      },
      {
        es: "Si una carta de combate marca casillas (Cortina de Fuego, Refuerzos…), márcalas en el mapa; si se da a una unidad (Explosivos…), tócala en el mapa.",
        en: "If a combat card marks hexes (Barrage, Reinforcements…), mark them on the map; if it's given to a unit (Explosives…), tap the unit on the map.",
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
        es: "Enseñaos las pantallas: cada uno ve el mapa y las cartas que juega el otro.",
        en: "Show each other your screens: each of you sees the other's map and the cards played.",
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
        es: "Las cartas de combate se jugaron con las órdenes: sus dados se suman solos al disparar.",
        en: "The combat cards were played with the orders: their dice are added by themselves when firing.",
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
        es: "Robas una carta de mando. Puedes descartarla una vez y robar otra, pero te quedas la segunda.",
        en: "You draw a command card. You may discard it once and draw another, but you keep the second.",
      },
      {
        es: `Elige ${END_OF_TURN_COINS} suministros o una carta de combate y pulsa «Empezar turno».`,
        en: `Pick ${END_OF_TURN_COINS} supplies or a combat card, and press "Start turn".`,
      },
    ],
  },
  {
    id: "tips",
    title: { es: "Consejos", en: "Tips" },
    points: [
      {
        es: "En la partida, «Menú» tiene tu mazo, el historial de turnos, los ajustes y este reglamento.",
        en: "In the game, \"Menu\" has your deck, the turn history, the settings and this rule book.",
      },
      {
        es: "Toca cualquier carta para leer su texto entero. Los botones «i» e «Instrucciones» explican cada paso.",
        en: "Tap any card to read its full text. The \"i\" and \"Instructions\" buttons explain each step.",
      },
      {
        es: "Si el mapa no coincide con la mesa, usa «Actualizar mapa» en Órdenes, antes de dar ninguna orden, o en la fase final.",
        en: "If the map doesn't match the table, use \"Update map\" in Orders, before giving any order, or in the final phase.",
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
          es: "El bando atacante (el que empezaría) juega un turno extra él solo, sin que el defensor responda. Los suministros que saca cuentan, pero no los puede gastar hasta el turno 2 (ni órdenes extra ni cartas de combate), y no hay recompensa final.",
          en: "The attacking side (the one that would go first) plays an extra turn alone, and the defender can't respond. The supplies it rolls count, but it can't spend them until turn 2 (no extra orders or combat cards), and there's no final reward.",
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
          es: "Los dos bandos se alternan, una unidad cada uno, empezando por el atacante: primero los choques, después los ataques de cartas de combate, luego las unidades que no se movieron y, por último, las que se movieron. Con ¡Fusiles arriba!, la infantería que se movió dispara junto a las que no se movieron.",
          en: "The two sides take turns, one unit each, the attacker first: collisions, then combat card attacks, then units that didn't move and, last, units that moved. With Rifles Up!, infantry that moved fires with the units that didn't move.",
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
    title: { es: "Cartas de mando", en: "Command cards" },
    rules: [
      {
        title: { es: "Un mazo por bando", en: "A deck per side" },
        official: {
          es: "Un mazo de 60 cartas compartido por los dos jugadores.",
          en: "One 60-card deck shared by both players.",
        },
        house: {
          es: "Cada bando tiene su mazo de 24 cartas: 19 comunes y 5 según sus unidades. No hay Reconocimiento ni Contraataque. Cortina de Fuego, Poder aéreo y Tras las líneas enemigas pasan a ser cartas de combate; Médicos y Mecánicos se divide en Médico y Mecánico, y Atrincherarse pasa a ser Fortificar.",
          en: "Each side has its own 24-card deck: 19 shared cards and 5 by its units. There's no Recon or Counter-Attack. Barrage, Air Power and Behind Enemy Lines become combat cards; Medics & Mechanics splits into Medic and Mechanic, and Dig-In becomes Fortify.",
        },
      },
      {
        title: { es: "Robar carta", en: "Drawing a card" },
        official: {
          es: "Al final del turno robas 1 carta.",
          en: "At the end of your turn you draw 1 card.",
        },
        house: {
          es: "Robas 1 carta y puedes descartarla una vez para robar otra, que te quedas.",
          en: "You draw 1 card, and may discard it once to draw another, which you keep.",
        },
      },
      {
        title: { es: "Batida", en: "Probe" },
        official: { es: "Órdenes a 2 unidades de la sección.", en: "Order 2 units in the section." },
        house: {
          es: "Órdenes a 2 unidades de la sección y, además, 1 unidad en cualquier lugar se mueve sin disparar. Solo 1 por sección en el mazo.",
          en: "Order 2 units in the section, and 1 more unit anywhere may move but not fire. Only 1 per section in the deck.",
        },
      },
      {
        title: { es: "Asalto cercano", en: "Close Assault" },
        official: {
          es: "Ordena a todas las unidades adyacentes a un enemigo, que no mueven y combaten con 1 dado más.",
          en: "Order all units adjacent to an enemy; they don't move and battle with 1 extra die.",
        },
        house: {
          es: "No se dan órdenes: en la batalla, cuando ya se ha movido todo, marcas cada unidad tuya adyacente a un enemigo y dispara en asalto cercano con 1 dado más.",
          en: "No orders are given: in the battle, once everything has moved, you mark each of your units adjacent to an enemy, and it fires in close assault with 1 extra die.",
        },
      },
      {
        title: { es: "Escaramuza", en: "Firefight" },
        official: {
          es: "4 unidades que no estén adyacentes a un enemigo disparan sin mover, con 1 dado más.",
          en: "4 units not adjacent to an enemy fire without moving, with 1 extra die.",
        },
        house: {
          es: "4 unidades disparan sin mover: 1 dado más a distancia y 1 menos en asalto cercano.",
          en: "4 units fire without moving: 1 extra die at range and 1 fewer in close assault.",
        },
      },
      {
        title: { es: "La Hora de la Verdad", en: "Their Finest Hour" },
        official: {
          es: "Tiras 1 dado por carta en tu mano: cada símbolo ordena una unidad de ese tipo y cada estrella una cualquiera, con 1 dado más. Después se baraja el mazo.",
          en: "Roll 1 die per card in your hand: each symbol orders a unit of that type and each star any unit, with 1 extra die. Then the deck is reshuffled.",
        },
        house: {
          es: "Hasta 4 órdenes pagadas con suministros: 1 por infantería y 2 por tanque o artillería. Disparan con 1 dado más.",
          en: "Up to 4 orders paid with supplies: 1 for infantry and 2 for a tank or artillery. They fire with 1 extra die.",
        },
      },
      {
        title: { es: "Preparativos", en: "Preparations" },
        house: {
          es: "Una carta táctica nueva: orden a 1 unidad. En la fase final recibes 3 suministros y una carta de combate, en lugar de elegir, y robas 2 cartas de mando y te quedas 1.",
          en: "A new tactic card: order 1 unit. In the final phase you get 3 supplies and a combat card, instead of choosing, and you draw 2 command cards and keep 1.",
        },
      },
      {
        title: { es: "Repostaje y Asalto de Blindados", en: "Refuel and Armor Assault" },
        official: {
          es: "Asalto de Blindados está en el mazo como cualquier carta.",
          en: "Armor Assault is in the deck like any other card.",
        },
        house: {
          es: "Asalto de Blindados no está en el mazo: solo llega con Repostaje, una carta táctica nueva para los bandos con blindados. Repostaje da una orden a 1 unidad; en la fase final recibes 3 suministros y una carta de combate y, en lugar de robar, Asalto de Blindados (Directo del Cuartel General si ya no te quedan blindados). Al jugarla, Asalto de Blindados vuelve fuera del mazo.",
          en: "Armor Assault isn't in the deck: only Refuel gives it, a new tactic card for sides with armor. Refuel orders 1 unit; in the final phase you get 3 supplies and a combat card and, instead of drawing, Armor Assault (Direct from HQ if you have no armor left). Once played, Armor Assault goes back out of the deck.",
        },
      },
    ],
  },
  {
    id: "supplies",
    title: { es: "Suministros y cartas de combate", en: "Supplies and combat cards" },
    rules: [
      {
        title: { es: "Suministros", en: "Supplies" },
        house: {
          es: `Empiezas sin suministros. Ganas 1 por cada estrella que sacan tus unidades al disparar y, en la fase final, eliges ${END_OF_TURN_COINS} suministros o una carta de combate.`,
          en: `You start with no supplies. You earn 1 for each star your units roll when firing and, in the final phase, you pick ${END_OF_TURN_COINS} supplies or a combat card.`,
        },
      },
      {
        title: { es: "Órdenes extra", en: "Extra orders" },
        house: {
          es: `Por ${EXTRA_INFANTRY} suministros (infantería) o ${EXTRA_ARMOUR} (tanque o artillería) das una orden a cualquier unidad, en cualquier sección, sin las ventajas de la carta de mando. Tantas como puedas pagar.`,
          en: `For ${EXTRA_INFANTRY} supplies (infantry) or ${EXTRA_ARMOUR} (tank or artillery) you order any unit, in any section, without the command card's benefits. As many as you can pay for.`,
        },
      },
      {
        title: { es: "Cartas de combate", en: "Combat cards" },
        house: {
          es: `Un mazo aparte que depende del escenario y del bando (míralo en el menú, en la tabla del escenario). Empiezas con ${STARTING_COMBAT_CARDS} y tienes ${MAX_COMBAT_HAND} como máximo. Cada una cuesta suministros, que se pagan al jugarla.`,
          en: `A separate deck that depends on the scenario and the side (see it in the menu, in the scenario's table). You start with ${STARTING_COMBAT_CARDS} and hold ${MAX_COMBAT_HAND} at most. Each one costs supplies, paid when you play it.`,
        },
      },
      {
        title: { es: "Cuándo se juegan", en: "When they're played" },
        house: {
          es: `Todas con la carta de mando, hasta ${MAX_COMBAT_CARDS_PER_TURN} por turno y nunca dos copias de la misma. Ninguna se juega en la batalla como reacción. Las que se dan a una unidad (Equipo urbano, Explosivos…) se le dan al dar las órdenes.`,
          en: `All with the command card, up to ${MAX_COMBAT_CARDS_PER_TURN} a turn and never two copies of one. None is played in the battle as a reaction. The ones given to a unit (Street Equipment, Explosives…) are given while ordering.`,
        },
      },
      {
        title: { es: "Camuflaje", en: "Camouflage" },
        official: {
          es: "Una unidad con la ficha de camuflaje solo puede ser atacada en asalto cercano. La ficha se quita si la unidad se mueve o combate.",
          en: "A unit with a camouflage badge can only be battled in close assault. The badge is removed if the unit moves or battles.",
        },
        house: {
          es: "La carta Camuflaje se da a una infantería con orden, que recibe la ficha tras la batalla. La app la muestra en el mapa y, si el rival puede tenerla, pregunta al disparar a distancia si el objetivo está camuflado.",
          en: "The Camouflage card goes to an ordered infantry unit, which gets the badge after the battle. The app shows it on the map and, when the opponent may have it, asks when firing at range whether the target is camouflaged.",
        },
      },
      {
        title: { es: "Fuego concentrado y de supresión", en: "Concentrated and Suppressive Fire" },
        house: {
          es: "Con Fuego concentrado, tus unidades que no se movieron y disparan a la misma unidad enemiga tiran juntas: una sola tirada, cada una con su dado (la que está en asalto cercano, el de batalla; la que dispara a distancia, el de 8 caras si se juega con él), y los sacos terreros ignoran 1 bandera de toda la tirada. Con Fuego de supresión eliges en cada disparo con orden si tiras el dado de supresión: el de batalla con 1 infantería, tanque, granada, suministro y 2 banderas, o el de 8 caras con 2 infantería, 2 tanques, 2 banderas y 2 suministros.",
          en: "With Concentrated Fire, your units that didn't move and fire at the same enemy unit roll together: one roll, each with its own die (one in close assault the battle die, one firing from range the 8-sided die when the game uses it), and sandbags ignore 1 flag of the whole roll. With Suppressive Fire you choose on each ordered shot whether to roll the suppressive die: the battle die with 1 infantry, tank, grenade, supply and 2 flags, or the 8-sided one with 2 infantry, 2 tanks, 2 flags and 2 supplies.",
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
          es: "Sin tablero: la app conoce los dos ejércitos, mueve las unidades, tira los dados y aplica los impactos y las retiradas. Cada jugador elige carta y da órdenes en secreto; una pantalla tapa el juego cada vez que el dispositivo cambia de manos. El mapa se ve siempre desde el lado del bando elegido en el menú, sin girar al pasar el dispositivo, y las secciones también: la izquierda es la izquierda de la pantalla para los dos bandos, así que una carta de la derecha da órdenes en las mismas casillas a cualquiera de los dos.",
          en: "No board: the app knows both armies, moves the units, rolls the dice and deals the hits and retreats. Each player picks a card and gives orders in secret; a screen covers the game every time the device changes hands. The map is always seen from the side picked in the menu, without turning round as the device is passed, and so are the sections: left is the screen's left for both sides, so a card for the right orders units on the same hexes for either side.",
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
        title: { es: "Cartas de combate en el mapa", en: "Combat cards on the map" },
        house: {
          es: "Las cartas de ataque se tiran antes de que nadie dispare, y Asalto cercano marca solo las unidades junto a un enemigo.",
          en: "Attack cards are rolled before anyone fires, and Close Assault marks the units next to an enemy by itself.",
        },
      },
      {
        title: { es: "Contra el ordenador", en: "Against the computer" },
        house: {
          es: "Con «Contra el ordenador» juegas un bando y el ordenador el otro, en tu dispositivo y sin pantalla que tape el juego. Solo ve lo que vería un jugador: tus órdenes no, hasta que se muestran. Elige su carta y da sus órdenes a la vez que tú; en la batalla dispara tras una pausa, y sus dados quedan sobre el mapa hasta que tocas «Seguir». Busca casillas desde las que disparar con buena cobertura, dispara donde más daño hace (rematando unidades tocadas) y gasta sus suministros en órdenes extra y en cartas de combate: por ahora juega las de dados, las de ataque (marca las casillas con más enemigos), las que se dan a una unidad, Ni un paso atrás, Fortificar y Fuego concentrado; aún no las de movimiento, Táctico, Refuerzos, Reposicionamiento, Fuego de supresión ni ¡Fusiles arriba!.",
          en: "With \"Against the computer\" you play one side and the computer the other, on your device and with no screen covering the game. It sees only what a player would: not your orders, until they're shown. It picks its card and gives its orders as you give yours; in the battle it fires after a pause, and its dice stay on the map until you tap \"Continue\". It looks for hexes to fire from with good cover, fires where it does most damage (finishing off weakened units) and spends its supplies on extra orders and combat cards: for now it plays the dice cards, the attack cards (marking the hexes with the most enemies), the cards given to a unit, Not One Step Back, Fortify and Concentrated Fire; not yet the movement cards, Tactician, Reinforcements, Reposition, Suppressive Fire or Rifles Up!.",
        },
      },
      {
        title: { es: "Sin victoria por ahora", en: "No victory for now" },
        house: {
          es: "La partida sigue hasta que los jugadores paren; las medallas llegarán más adelante.",
          en: "The game goes on until the players stop; medals will come later.",
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
