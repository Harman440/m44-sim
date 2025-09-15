// data/commandCards.js
import CommandCard from '../game-core/commandCard.js';

//TODO: Change Id so that all cards have a unique Id
const cardTemplates = [
  {
    count: 4,
    props: {
      id: 'probe-left',
      name: 'Probe Left Flank',
      description: 'Order 2 units on the left flank.',
      maxTotalOrders: 2,
      maxOrdersLeftSection: 2,
    },
  },
  {
    count: 4,
    props: {
      id: 'probe-right',
      name: 'Probe Right Flank',
      description: 'Order 2 units on the right flank.',
      maxTotalOrders: 2,
      maxOrdersRightSection: 2,
    },
  },
  {
    count: 4,
    props: {
      id: 'attack-center',
      name: 'Attack Center',
      description: 'Order 3 units in the center.',
      maxTotalOrders: 3,
      maxOrdersCenterSection: 3,
    },
  },
  {
    count: 3,
    props: {
      id: 'assault-left',
      name: 'Assault Left Flank',
      description: 'Order 4 units on the left flank.',
      maxTotalOrders: 4,
      maxOrdersLeftSection: 4,
    },
  },
  {
    count: 3,
    props: {
      id: 'assault-right',
      name: 'Assault Right Flank',
      description: 'Order 4 units on the right flank.',
      maxTotalOrders: 4,
      maxOrdersRightSection: 4,
    },
  },
  {
    count: 2,
    props: {
      id: 'all-out',
      name: 'All-Out Assault',
      description: 'Order 6 units anywhere.',
      maxTotalOrders: 6,
    },
  },
];

const commandCards: CommandCard[] = [];

cardTemplates.forEach(template => {
  for (let i = 0; i < template.count; i++) {
    commandCards.push(new CommandCard({ ...template.props }));
  }
});

export default commandCards;
