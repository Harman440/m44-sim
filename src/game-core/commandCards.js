// game-core/commandCards.js

import CommandCard from './commandCard.js';

// Helper to generate multiple copies
function createCardCopies(template, count) {
    return Array.from({ length: count }, (_, i) => {
        return new CommandCard({ ...template, id: `${template.id}_${i + 1}` });
    });
}

// List of all cards (initial set)
const cardTemplates = [
    {
        id: 'assault_left',
        name: 'Assault Left',
        description: 'Order 3 units on the left flank.',
        maxOrdersLeftSection: 3,
        maxTotalOrders: 3,
    },
    {
        id: 'assault_right',
        name: 'Assault Right',
        description: 'Order 3 units on the right flank.',
        maxOrdersRightSection: 3,
        maxTotalOrders: 3,
    },
    {
        id: 'probe_center',
        name: 'Probe Center',
        description: 'Order 2 units in the center.',
        maxOrdersCenterSection: 2,
        maxTotalOrders: 2,
    },
    {
        id: 'attack_all',
        name: 'Attack All Fronts',
        description: 'Order 1 unit in each section.',
        maxOrdersLeftSection: 1,
        maxOrdersCenterSection: 1,
        maxOrdersRightSection: 1,
        maxTotalOrders: 3,
    }
];//TODO: add all cards

// Define how many copies of each card
const cards = [
    ...createCardCopies(cardTemplates[0], 2), // 2 x Assault Left
    ...createCardCopies(cardTemplates[1], 2), // 2 x Assault Right
    ...createCardCopies(cardTemplates[2], 3), // 3 x Probe Center
    ...createCardCopies(cardTemplates[3], 1), // 1 x Attack All Fronts
];

export default cards;
