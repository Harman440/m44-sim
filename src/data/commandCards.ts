// data/commandCards.js
import CommandCard, { CommandCardType } from '../game-core/commandCard.js';

const cardTemplates = [
  {
    count: 1,
    props: {
      id: 'probe-left',
      name: 'Sondeo en el flanco izquierdo',
      type: CommandCardType.LEFT,
      description: 'Da órdenes a 2 unidades del flanco izquierdo.',
      maxTotalOrders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'probe-right',
      name: 'Sondeo en el flanco derecho',
      type: CommandCardType.RIGHT,
      description: 'Da órdenes a 2 unidades del flanco derecho.',
      maxTotalOrders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'probe-center',
      name: 'Sondeo en el centro',
      type: CommandCardType.CENTER,
      description: 'Da órdenes a 2 unidades del centro.',
      maxTotalOrders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'attack-center',
      name: 'Ataque en el centro',
      type: CommandCardType.CENTER,
      description: 'Da órdenes a 3 unidades del centro.',
      maxTotalOrders: 3,
    },
  },
  {
    count: 1,
    props: {
      id: 'assault-left',
      name: 'Asalto en el flanco izquierdo',
      type: CommandCardType.LEFT,
      description: 'Da órdenes a 4 unidades del flanco izquierdo.',
      maxTotalOrders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'assault-right',
      name: 'Asalto en el flanco derecho',
      type: CommandCardType.RIGHT,
      description: 'Da órdenes a 4 unidades del flanco derecho.',
      maxTotalOrders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'all-out',
      name: 'Asalto general',
      type: CommandCardType.ALLSIDES,
      description: 'Da órdenes a 6 unidades en cualquier sección.',
      maxTotalOrders: 6,
    },
  },
  {
    count: 1,
    props: {
      id: 'tank-assault',
      name: 'Asalto blindado',
      type: CommandCardType.TANK,
      description: 'Da órdenes a 4 tanques en cualquier sección.',
      maxTotalOrders: 4,
    },
  }
];

const commandCards: CommandCard[] = [];

cardTemplates.forEach(template => {
  for (let i = 0; i < template.count; i++) {
    // Suffix each copy so ids stay unique when a template has count > 1
    commandCards.push(new CommandCard({ ...template.props, id: `${template.props.id}-${i + 1}` }));
  }
});

export default commandCards;
