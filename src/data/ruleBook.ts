// data/ruleBook.ts
// The rule book, opened from the menu: a tutorial on playing a game with the
// app, and the house rules that differ from the official Memoir '44 rules
// (Days of Wonder's 2004 rulebook and the base game's cards). The numbers come
// from the data files; when a rule changes, change its text here too.
import { TurnPhase } from "../types/gameManager";
import { END_OF_TURN_COINS, EXTRA_ORDER_COST } from "./coinRules";
import { MAX_COMBAT_HAND, STARTING_COMBAT_CARDS } from "./combatCards";
import { Localized } from "../i18n/lang";

export type TutorialStepId = "setup" | "turn" | "card" | "orders" | "movement" | "battle" | "final" | "tips";

/** A page of the tutorial */
export interface TutorialStep {
  id: TutorialStepId;
  title: Localized;
  /** The turn phase the page is about, picked out in the row of phases */
  phase?: TurnPhase;
  points: readonly Localized[];
}

export type HouseRuleGroupId = "simultaneous" | "dice" | "terrain" | "commandCards" | "supplies" | "optional";

/** A rule played differently from the official game */
export interface HouseRule {
  title: Localized;
  /** What the official rules say; left out for a rule that is new */
  official?: Localized;
  /** How it's played with the app */
  house: Localized;
  /** An official rule the app doesn't apply (yet): it's played at the table */
  notImplemented?: boolean;
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
        es: "Si quieres, añade una carta de combate de órdenes. Cuesta suministros, que se pagan al jugarla.",
        en: "If you like, add an order combat card. It costs supplies, paid when you play it.",
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
        es: `Una orden extra cuesta ${EXTRA_ORDER_COST} suministros: cualquier unidad, sin las ventajas de la carta.`,
        en: `An extra order costs ${EXTRA_ORDER_COST} supplies: any unit, without the card's benefits.`,
      },
      {
        es: "Si la carta de combate marca casillas (Cortina de Fuego, Refuerzos…), márcalas en el mapa.",
        en: "If the combat card marks hexes (Barrage, Reinforcements…), mark them on the map.",
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
        es: "Quita las bajas en la mesa. Las retiradas se marcan y se hacen en la fase final.",
        en: "Remove the casualties on the table. Retreats are marked and carried out in the final phase.",
      },
      {
        es: "Puedes jugar una carta de combate de batalla en cualquier momento, normalmente cuando dispara el rival.",
        en: "You can play a battle combat card at any time, usually when the opponent fires.",
      },
    ],
  },
  {
    id: "final",
    title: { es: "5. Final", en: "5. Final" },
    phase: TurnPhase.END_OF_TURN,
    points: [
      {
        es: "Haz las retiradas en la mesa y refleja en «Actualizar mapa» las bajas y los movimientos de los dos bandos.",
        en: "Carry out the retreats on the table, and mirror both sides' casualties and moves in \"Update map\".",
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
          es: "Si dos unidades enemigas pasan por la misma casilla o acaban en ella, combaten antes que nadie: cada una tira sus dados de asalto cercano menos 1, sin contar el terreno, y las retiradas no se pueden ignorar. La que no se retira ni es eliminada se queda y puede seguir su camino. Si nadie se retira, las dos vuelven 1 casilla por donde vinieron. El choque cuenta como el disparo de la unidad.",
          en: "If two enemy units go through the same hex or end on it, they battle before anyone else: each rolls its close assault dice minus 1, terrain doesn't count, and retreats can't be ignored. The one that isn't pushed back or eliminated stays and may carry on. If neither retreats, both go back 1 hex the way they came. The collision counts as the unit's shot.",
        },
      },
      {
        title: { es: "Orden de fuego", en: "Firing order" },
        official: {
          es: "El jugador del turno combate con sus unidades en el orden que quiera.",
          en: "The player whose turn it is battles with their units in any order.",
        },
        house: {
          es: "Los dos bandos se alternan, una unidad cada uno, empezando por el atacante: primero los choques, después los ataques de cartas de combate, luego las unidades que no se movieron y, por último, las que se movieron.",
          en: "The two sides take turns, one unit each, the attacker first: collisions, then combat card attacks, then units that didn't move and, last, units that moved.",
        },
      },
      {
        title: { es: "Retiradas", en: "Retreats" },
        official: {
          es: "La unidad se retira en cuanto se resuelven los impactos.",
          en: "The unit retreats as soon as the hits are resolved.",
        },
        house: {
          es: "Se marcan en la mesa y se hacen todas en la fase final. Hasta entonces la unidad marcada sigue en su casilla y puede disparar, pero no tomar terreno.",
          en: "They're marked on the table and all carried out in the final phase. Until then the marked unit stays on its hex and can fire, but not take ground.",
        },
      },
      {
        title: { es: "Tomar terreno", en: "Taking ground" },
        official: {
          es: "La infantería que gana un asalto cercano puede avanzar a la casilla que deja el enemigo. Un blindado puede avanzar y combatir otra vez (arrollamiento), también a distancia.",
          en: "Infantry that wins a close assault may advance into the hex the enemy leaves. Armor may advance and battle again (overrun), at range too.",
        },
        house: {
          es: "Solo los blindados toman terreno; la infantería, solo con la carta Fragor del combate. Si el objetivo tiene que retirarse, lo hace en ese momento; la unidad ocupa su casilla y combate otra vez, solo en asalto cercano. Una vez por unidad y turno.",
          en: "Only armor takes ground; infantry only with the Heat of Battle card. If the target has to retreat, it does so right then; the unit moves into its hex and battles again, in close assault only. Once per unit per turn.",
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
          es: "La unidad que dispara no puede aplicar más resultados que figuras le quedan: su jugador elige cuáles aplica («Aplicar menos resultados»). Con una carta que da dados extra, puede aplicar uno más.",
          en: "The firing unit can't apply more results than it has figures left: its player picks which ones apply (\"Apply fewer results\"). With a card that gives extra dice, it can apply one more.",
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
    id: "terrain",
    title: { es: "Terreno", en: "Terrain" },
    rules: [
      {
        title: { es: "Blindados en una alambrada", en: "Armor on barbed wire" },
        official: {
          es: "Un blindado que entra en una alambrada la quita, y puede disparar.",
          en: "Armor that enters barbed wire removes it, and can still fire.",
        },
        house: {
          es: "La app no la quita sola. El blindado dispara como siempre; quita la alambrada en la mesa y en el mapa con «Actualizar mapa» en la fase final.",
          en: "The app doesn't remove it. The tank fires as usual; take the wire off the table, and off the map with \"Update map\" in the final phase.",
        },
        notImplemented: true,
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
          es: "Cada bando tiene su mazo de 25 cartas: 21 comunes y 4 según sus unidades. No hay Reconocimiento ni Contraataque. Emboscada, Cortina de Fuego, Poder aéreo y Tras las líneas enemigas pasan a ser cartas de combate; Médicos y Mecánicos se divide en Médico y Mecánico, y Atrincherarse pasa a ser Fortificar.",
          en: "Each side has its own 25-card deck: 21 shared cards and 4 by its units. There's no Recon or Counter-Attack. Ambush, Barrage, Air Power and Behind Enemy Lines become combat cards; Medics & Mechanics splits into Medic and Mechanic, and Dig-In becomes Fortify.",
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
          es: "Órdenes a 2 unidades de la sección y, además, 1 unidad en cualquier lugar se mueve sin disparar. En la fase final robas 2 cartas y te quedas 1.",
          en: "Order 2 units in the section, and 1 more unit anywhere may move but not fire. In the final phase you draw 2 cards and keep 1.",
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
          es: "Una carta táctica nueva: orden a 1 unidad. En la fase final recibes 3 suministros y una carta de combate, en lugar de elegir.",
          en: "A new tactic card: order 1 unit. In the final phase you get 3 supplies and a combat card, instead of choosing.",
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
          es: `Por ${EXTRA_ORDER_COST} suministros das una orden a cualquier unidad, en cualquier sección, sin las ventajas de la carta de mando. Tantas como puedas pagar.`,
          en: `For ${EXTRA_ORDER_COST} supplies you order any unit, in any section, without the command card's benefits. As many as you can pay for.`,
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
          es: "Las de órdenes, una por turno, junto con la carta de mando. Las de batalla, una por batalla, en cualquier momento de la batalla.",
          en: "Order cards: one per turn, with the command card. Battle cards: one per battle, at any time in the battle.",
        },
      },
      {
        title: { es: "Refuerzos", en: "Reinforcements" },
        house: {
          es: "La carta marca una cruz en el mapa. En la fase final la app tira el dado y llega a esa casilla la unidad que diga la tabla del escenario; con bandera no llega nada.",
          en: "The card marks a cross on the map. In the final phase the app rolls the die, and the unit the scenario's table names arrives on that hex; on a flag nothing arrives.",
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
