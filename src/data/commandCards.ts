// data/commandCards.ts
import CommandCard, { CommandCardProps } from '../game-core/commandCard';
import { UnitType } from '../game-core/unit';
import { Side } from '../types/hex';

const cardTemplates: { count: number; props: CommandCardProps & { id: string } }[] = [
  {
    count: 1,
    props: {
      id: 'probe-left',
      name: 'Sondeo en el flanco izquierdo',
      sections: [Side.LEFT],
      description: 'Da órdenes a 2 unidades del flanco izquierdo.',
      orders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'probe-right',
      name: 'Sondeo en el flanco derecho',
      sections: [Side.RIGHT],
      description: 'Da órdenes a 2 unidades del flanco derecho.',
      orders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'probe-center',
      name: 'Sondeo en el centro',
      sections: [Side.CENTER],
      description: 'Da órdenes a 2 unidades del centro.',
      orders: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'attack-center',
      name: 'Ataque en el centro',
      sections: [Side.CENTER],
      description: 'Da órdenes a 3 unidades del centro.',
      orders: 3,
    },
  },
  {
    count: 1,
    props: {
      id: 'assault-left',
      name: 'Asalto en el flanco izquierdo',
      sections: [Side.LEFT],
      description: 'Da órdenes a 4 unidades del flanco izquierdo.',
      orders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'assault-right',
      name: 'Asalto en el flanco derecho',
      sections: [Side.RIGHT],
      description: 'Da órdenes a 4 unidades del flanco derecho.',
      orders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'all-out',
      name: 'Asalto general',
      description: 'Da órdenes a 6 unidades en cualquier sección.',
      orders: 6,
    },
  },
  {
    count: 1,
    props: {
      id: 'tank-assault',
      name: 'Asalto blindado',
      unitTypes: [UnitType.TANK],
      description: 'Da órdenes a 4 tanques en cualquier sección.',
      orders: 4,
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
