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
    // Écouché, the Allies' temporary medal objective, and the medals stay on the table; big
    // guns, air and the reinforcement table are ours
    id: 'foret-decouves',
    name: "Forêt d'Écouves",
    description:
      'Agosto de 1944: la 2.ª División Blindada de Leclerc ataca a los alemanes atrincherados en el bosque de Écouves. ' +
      'Toda la infantería francesa es de élite: mueve 2 casillas y aún dispara; también las unidades alemanas con distintivo.',
    image: foretDEcouvesImage,
    initialHandSize: { allies: 6, axis: 5 },
    attacker: 'Allies',
    // August 1944: the French 2e DB attacks with American guns and Allied fighter-bombers overhead
    bigGuns: ['Allies'],
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
    // Made up for the app, loosely after the tank battle of Arracourt (September 1944):
    // German armour attacks across open farmland towards the American-held village
    id: 'arracourt',
    name: 'Arracourt',
    description: 'Campo abierto entre pueblos y bosquecillos: los blindados alemanes atacan el pueblo.',
    image: arracourtImage,
    initialHandSize: { allies: 4, axis: 5 },
    attacker: 'Axis',
    // The American artillery and, once the fog lifted, the P-47s broke the German attacks
    bigGuns: ['Allies'],
    airPower: { allies: 1, axis: 0 },
    reinforcements: {
      [DieFace.INFANTRY]: UnitType.INFANTRY,
      [DieFace.TANK]: UnitType.TANK,
      [DieFace.GRENADE]: UnitType.TANK,
      [DieFace.SUPPLY]: UnitType.ARTILLERY,
      [DieFace.FLAG]: null,
    },
    tiles: arracourtTiles as Tiles,
    units: {
      allies: {
        infantry: [{ row: 6, col: 5 }, { row: 6, col: 6 }, { row: 7, col: 1 }, { row: 7, col: 10 }],
        tank: [{ row: 7, col: 2 }, { row: 7, col: 5 }, { row: 7, col: 7 }, { row: 6, col: 9 }],
        artillery: [{ row: 8, col: 5 }, { row: 8, col: 7 }],
      },
      axis: {
        infantry: [{ row: 0, col: 3 }, { row: 0, col: 6 }, { row: 0, col: 8 }, { row: 0, col: 10 }],
        tank: [
          { row: 1, col: 2 }, { row: 1, col: 4 }, { row: 1, col: 5 },
          { row: 1, col: 6 }, { row: 1, col: 7 }, { row: 1, col: 9 },
        ],
        artillery: [{ row: 0, col: 5 }],
      },
    },
  },
  {
    // Memoir '44 base game, scenario 2 (6 June 1944): the US 82nd Airborne drops round the
    // town at night. The map and units are the official ones; the reinforcement table is ours
    id: 'sainte-mere-eglise',
    name: 'Sainte-Mère-Église',
    description: 'Los paracaidistas estadounidenses caen de noche alrededor del pueblo, entre setos y bosques.',
    image: sainteMereEgliseImage,
    initialHandSize: { allies: 6, axis: 5 },
    attacker: 'Allies',
    // The paratroopers landed without heavy guns, while German artillery shelled the town;
    // the scenario says nothing about air superiority, so both sides keep their air cards
    bigGuns: ['Axis'],
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
    description: 'Los planeadores británicos aterrizan junto a los puentes del canal de Caen y del Orne: hay que tomarlos.',
    image: pegasusBridgeImage,
    initialHandSize: { allies: 6, axis: 2 },
    extraDraws: { faction: 'Axis', turns: 2 },
    attacker: 'Allies',
    // A night glider raid on two bridges: no heavy guns or aircraft on either side
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
