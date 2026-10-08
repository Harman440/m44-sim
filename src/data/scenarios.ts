// data/scenarios.ts

import { Scenario, Tiles } from "../types/scenario";
import { DieFace } from "../game-core/dice";
import { UnitType } from "../game-core/unit";
import foretDEcouvesImage from "../assets/scenarios/ForetDEcouves.webp";
// Board art made with `npm run board` from the same terrain file
import arracourtImage from "../assets/scenarios/Arracourt.webp";
import arracourtTiles from "./boards/arracourt.json";
import sainteMereEgliseImage from "../assets/scenarios/SainteMereEglise.webp";
import sainteMereEgliseTiles from "./boards/sainte-mere-eglise.json";
import pegasusBridgeImage from "../assets/scenarios/PegasusBridge.webp";
import pegasusBridgeTiles from "./boards/pegasus-bridge.json";

export const scenarios: Scenario[] = [
  {
    // Official scenario 7045 by jdrommel (Days of Wonder archives, 12 August 1944): Leclerc's
    // French 2e DB attacks the Germans dug into the Écouves forest. The map, units, sandbags,
    // elite badges and hands are the official ones (in the .m44 file a column is twice ours).
    // Écouché, the Allies' temporary medal objective, and the medals stay on the table; air
    // and the reinforcement table are ours
    id: 'foret-decouves',
    name: "Forêt d'Écouves",
    description: {
      es:
        'Agosto de 1944: la 2.ª División Blindada de Leclerc ataca a los alemanes atrincherados en el bosque de Écouves. ' +
        'Toda la infantería francesa es de élite: mueve 2 casillas y aún dispara; también las unidades alemanas con distintivo.',
      en:
        "August 1944: Leclerc's 2nd Armored Division attacks the Germans dug into the Écouves forest. " +
        'All French infantry is elite: it moves 2 hexes and still fires; so are the German units with a badge.',
    },
    image: foretDEcouvesImage,
    initialHandSize: { allies: 6, axis: 5 },
    attacker: 'Allies',
    // August 1944: the French 2e DB attacks with Allied fighter-bombers overhead
    airPower: { allies: 1, axis: 0 },
    reinforcements: {
      [DieFace.INFANTRY]: UnitType.INFANTRY,
      [DieFace.TANK]: UnitType.TANK,
      [DieFace.GRENADE]: UnitType.INFANTRY,
      [DieFace.SUPPLY]: UnitType.ARTILLERY,
      [DieFace.FLAG]: null,
    },
    "tiles": {
      "forest": [
        { "row": 1, "col": 3 }, { "row": 1, "col": 7 },
        { "row": 2, "col": 3 }, { "row": 2, "col": 4 }, { "row": 2, "col": 5 }, { "row": 2, "col": 7 },
        { "row": 3, "col": 2 }, { "row": 3, "col": 3 }, { "row": 3, "col": 6 }, { "row": 3, "col": 7 }, { "row": 3, "col": 8 },
        { "row": 4, "col": 4 }, { "row": 4, "col": 5 }, { "row": 4, "col": 7 }, { "row": 4, "col": 8 }, { "row": 4, "col": 9 },
        { "row": 5, "col": 2 }, { "row": 5, "col": 3 }, { "row": 5, "col": 4 }, { "row": 5, "col": 6 }, { "row": 5, "col": 7 },
      ],
      "town": [
        { "row": 0, "col": 5 },
        { "row": 1, "col": 2 },
        { "row": 1, "col": 8 },
        { "row": 3, "col": 1 },
        { "row": 3, "col": 5 },
        { "row": 3, "col": 10 },
        { "row": 6, "col": 2 },
        { "row": 8, "col": 6 },
      ]
    },
    // The German infantry dug in at Carrouges, Sées and in the forest
    sandbags: [{ row: 3, col: 1 }, { row: 3, col: 10 }, { row: 4, col: 5 }],
    // Every French infantry unit, and the German units with a badge (2 infantry, 1 tank)
    elite: [
      { row: 7, col: 3 }, { row: 7, col: 8 }, { row: 8, col: 1 }, { row: 8, col: 6 }, { row: 8, col: 7 }, { row: 8, col: 10 },
      { row: 1, col: 2 }, { row: 1, col: 7 }, { row: 2, col: 4 },
    ],
    units: {
      allies: {
        infantry: [
          { row: 7, col: 3 }, { row: 7, col: 8 }, { row: 8, col: 1 },
          { row: 8, col: 6 }, { row: 8, col: 7 }, { row: 8, col: 10 },
        ],
        tank: [
          { row: 7, col: 1 }, { row: 7, col: 7 }, { row: 7, col: 9 },
          { row: 8, col: 3 }, { row: 8, col: 5 }, { row: 8, col: 11 },
        ],
      },
      axis: {
        infantry: [{ row: 1, col: 7 }, { row: 2, col: 4 }, { row: 3, col: 1 }, { row: 3, col: 10 }, { row: 4, col: 5 }],
        tank: [{ row: 0, col: 5 }, { row: 1, col: 2 }, { row: 3, col: 8 }, { row: 4, col: 3 }],
      },
    },
  },
  {
    // Memoir '44 scenario 23 (19 September 1944): the 111th Panzer Brigade drives on Arracourt,
    // where the US 4th Armored Division waits in the fog. The map, units, sandbags and hands are
    // the official ones; the medals stay on the table, and the reinforcement table is ours
    id: 'arracourt',
    name: 'Arracourt',
    description: {
      es:
        'Septiembre de 1944: entre la niebla, las brigadas Panzer atacan Lezey y Arracourt, ' +
        'defendidos por los blindados de la 4.ª División Acorazada estadounidense.',
      en:
        'September 1944: through the fog, the Panzer brigades attack Lezey and Arracourt, ' +
        "held by the tanks of the US 4th Armored Division.",
    },
    image: arracourtImage,
    initialHandSize: { allies: 6, axis: 4 },
    attacker: 'Axis',
    // Air rules: one air sortie to the Axis; the other is shuffled into the deck, which gives
    // the Allies none
    airPower: { allies: 0, axis: 1 },
    reinforcements: {
      [DieFace.INFANTRY]: UnitType.INFANTRY,
      [DieFace.TANK]: UnitType.TANK,
      [DieFace.GRENADE]: UnitType.TANK,
      [DieFace.SUPPLY]: UnitType.ARTILLERY,
      [DieFace.FLAG]: null,
    },
    tiles: arracourtTiles as Tiles,
    // The artillery dug in west of Arracourt
    sandbags: [{ row: 7, col: 4 }],
    units: {
      allies: {
        infantry: [{ row: 2, col: 6 }, { row: 6, col: 4 }, { row: 6, col: 9 }, { row: 7, col: 2 }, { row: 8, col: 6 }],
        tank: [
          { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 6, col: 2 },
          { row: 6, col: 3 }, { row: 8, col: 8 }, { row: 8, col: 9 },
        ],
        artillery: [{ row: 7, col: 4 }, { row: 7, col: 7 }, { row: 7, col: 9 }],
      },
      axis: {
        infantry: [{ row: 0, col: 3 }, { row: 0, col: 4 }, { row: 0, col: 9 }, { row: 0, col: 11 }, { row: 1, col: 1 }, { row: 1, col: 3 }],
        tank: [
          { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 5 },
          { row: 0, col: 6 }, { row: 0, col: 12 }, { row: 1, col: 0 }, { row: 1, col: 11 },
        ],
      },
    },
  },
  {
    // Memoir '44 base game, scenario 2 (6 June 1944): the US 82nd Airborne drops round the
    // town at night. The map and units are the official ones; the reinforcement table is ours
    id: 'sainte-mere-eglise',
    name: 'Sainte-Mère-Église',
    description: {
      es: 'Los paracaidistas estadounidenses caen de noche alrededor del pueblo, entre setos y bosques.',
      en: 'American paratroopers drop at night around the town, among hedgerows and woods.',
    },
    image: sainteMereEgliseImage,
    initialHandSize: { allies: 6, axis: 5 },
    attacker: 'Allies',
    // The scenario says nothing about air superiority, so both sides keep their air cards
    paradrop: { faction: 'Allies', unitType: UnitType.INFANTRY, units: 4 },
    reinforcements: {
      [DieFace.INFANTRY]: UnitType.INFANTRY,
      [DieFace.TANK]: UnitType.TANK,
      [DieFace.GRENADE]: UnitType.INFANTRY,
      [DieFace.SUPPLY]: UnitType.INFANTRY,
      [DieFace.FLAG]: null,
    },
    tiles: sainteMereEgliseTiles as Tiles,
    units: {
      allies: {
        infantry: [
          { row: 5, col: 1 }, { row: 6, col: 6 }, { row: 7, col: 7 },
          { row: 7, col: 10 }, { row: 8, col: 4 }, { row: 8, col: 7 },
        ],
      },
      axis: {
        infantry: [
          { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 11 },
          { row: 1, col: 0 }, { row: 1, col: 10 }, { row: 1, col: 11 },
          { row: 2, col: 0 }, { row: 2, col: 10 }, { row: 4, col: 6 },
        ],
        tank: [{ row: 0, col: 12 }],
      },
    },
  },
  {
    // Memoir '44 base game, scenario 1 (6 June 1944): British gliders land by the bridges over
    // the Caen canal and the Orne at night. The map, units, barbed wire, the sandbags of the two
    // German units guarding the canal bridge and the Axis' surprise (2 cards, and 2 drawn after
    // each of its first two turns) are the official ones; the medals are only on the table, and
    // the reinforcement table is ours
    id: 'pegasus-bridge',
    name: 'Pegasus Bridge',
    description: {
      es: 'Los planeadores británicos aterrizan junto a los puentes del canal de Caen y del Orne: hay que tomarlos.',
      en: 'British gliders land by the bridges over the Caen canal and the Orne: they must be taken.',
    },
    image: pegasusBridgeImage,
    initialHandSize: { allies: 6, axis: 2 },
    extraDraws: { faction: 'Axis', turns: 2 },
    attacker: 'Allies',
    // A night glider raid on two bridges: no heavy guns (the player's ruling) or aircraft on either side
    bigGuns: [],
    airPower: { allies: 0, axis: 0 },
    reinforcements: {
      [DieFace.INFANTRY]: UnitType.INFANTRY,
      [DieFace.TANK]: UnitType.TANK,
      [DieFace.GRENADE]: UnitType.INFANTRY,
      [DieFace.SUPPLY]: UnitType.INFANTRY,
      [DieFace.FLAG]: null,
    },
    tiles: pegasusBridgeTiles as Tiles,
    wire: [{ row: 2, col: 5 }, { row: 3, col: 4 }, { row: 4, col: 3 }, { row: 4, col: 4 }],
    sandbags: [{ row: 2, col: 4 }, { row: 3, col: 3 }],
    units: {
      allies: {
        infantry: [
          { row: 5, col: 2 }, { row: 6, col: 2 }, { row: 6, col: 3 },
          { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 7 },
          { row: 8, col: 5 }, { row: 8, col: 7 }, { row: 8, col: 8 },
        ],
      },
      axis: {
        infantry: [
          { row: 0, col: 0 }, { row: 1, col: 10 }, { row: 2, col: 2 },
          { row: 2, col: 4 }, { row: 3, col: 3 }, { row: 6, col: 12 },
        ],
      },
    },
  },
];
