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

export const scenarios: Scenario[] = [
  {
    id: 'foret-decouves',
    name: "Forêt d'Écouves",
    description: 'Bosque denso con claros dispersos y pueblos que disputar.',
    image: foretDEcouvesImage,
    initialHandSize: { allies: 5, axis: 3 },
    attacker: 'Allies',
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
    units: {
      allies:
      {
        infantry: [
          { row: 7, col: 1 }, { row: 7, col: 2 }
        ],
        tank: [
          { row: 7, col: 3 }, { row: 7, col: 4 }
        ],
        artillery: [
          { row: 7, col: 5 }, { row: 7, col: 6 }
        ]
      },
      axis:
      {
        infantry: [
          { row: 0, col: 4 }, { row: 0, col: 5 }, { row: 0, col: 6 }, { row: 0, col: 7 }
        ],
        tank: [
          { row: 0, col: 8 }, { row: 0, col: 9 }
        ],
        artillery: [
          { row: 0, col: 10 }, { row: 0, col: 11 }, { row: 0, col: 12 }
        ]
      }
    }
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
];
