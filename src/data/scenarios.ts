// data/scenarios.js

import { Scenario } from "../types/scenario";

export const scenarios: Scenario[] = [
  {
    id: 'foret-decouves',
    name: 'Foret DEcouves',
    description: 'A dense forest scenario with scattered patches.',
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
];