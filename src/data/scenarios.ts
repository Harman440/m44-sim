// data/scenarios.js

import { Scenario } from "./types/scenario";

export const scenarios: Scenario[] = [
  {
    id: 'forest-blitz',
    name: 'Forest Blitz',
    description: 'A dense forest scenario with scattered patches.',
    tiles: {
      forest: [
        { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 3 },
        { row: 6, col: 7 }, { row: 6, col: 8 }, { row: 7, col: 7 },
        { row: 1, col: 9 }, { row: 2, col: 9 }, { row: 2, col: 10 },
        { row: 5, col: 2 }, { row: 6, col: 2 },
        { row: 4, col: 11 }, { row: 5, col: 11 }, { row: 5, col: 12 },
        { row: 4, col: 6 }, { row: 4, col: 7 }, { row: 5, col: 6 },
        { row: 0, col: 1 }, { row: 1, col: 1 },
        { row: 8, col: 4 }, { row: 8, col: 5 }
      ],
      town: [
        { row: 2, col: 1 }, { row: 2, col: 2 }
      ]
      // Add more types like river, town, hill, etc. later
    },
    units: {
      allies:
      {
        infantry: [
          { row: 2, col: 1 }, { row: 2, col: 2 }
        ]
      },
      axis:
      {
        infantry: [
          { row: 8, col: 4 }, { row: 8, col: 5 }
        ],
      }
    }
  },
];