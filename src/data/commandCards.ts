// data/commandCards.js
import CommandCard, { CommandCardType } from '../game-core/commandCard.js';

//TODO: Change Id so that all cards have a unique Id
const cardTemplates = [
  {
    count: 1,
    props: {
      id: 'probe-left',
      name: 'Probe Left Flank',
      type: CommandCardType.LEFT,
      description: 'Order 2 units on the left flank.',
      maxTotalOrders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'probe-right',
      name: 'Probe Right Flank',
      type: CommandCardType.RIGHT,
      description: 'Order 2 units on the right flank.',
      maxTotalOrders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'attack-center',
      name: 'Attack Center',
      type: CommandCardType.CENTER,
      description: 'Order 3 units in the center.',
      maxTotalOrders: 3,
    },
  },
  {
    count: 1,
    props: {
      id: 'assault-left',
      name: 'Assault Left Flank',
      type: CommandCardType.LEFT,
      description: 'Order 4 units on the left flank.',
      maxTotalOrders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'assault-right',
      name: 'Assault Right Flank',
      type: CommandCardType.RIGHT,
      description: 'Order 4 units on the right flank.',
      maxTotalOrders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'all-out',
      name: 'All-Out Assault',
      type: CommandCardType.ALLSIDES,
      description: 'Order 6 units anywhere.',
      maxTotalOrders: 6,
    },
  },
  {
    count: 1,
    props: {
      id: 'tank-assault',
      name: 'Tank Assault',
      type: CommandCardType.TANK,
      description: 'Order 4 tanks anywhere.',
      maxTotalOrders: 4,
    },
  }
];

console.log("=== commandCards module loaded ===");
console.log("cardTemplates length:", cardTemplates.length);
const commandCards: CommandCard[] = [];

cardTemplates.forEach(template => {
  for (let i = 0; i < template.count; i++) {
    commandCards.push(new CommandCard({ ...template.props }));
  }
});

export default commandCards;
