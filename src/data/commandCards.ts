// data/commandCards.ts
// The house command-card deck (docs/house-rules.md, "Command cards database").
// Counts are the Breakthrough deck with the notes' "(−1)" changes, which bring
// it to about a standard deck (40 section cards + 17 tactic cards). They are
// provisional: tune them here.
//
// Not in the deck: Counter Attack (not in the game) and Behind Enemy Lines,
// Ambush, Barrage, Air Power, Dig In and Medics (combat cards, Step 24).
import CommandCard, { CommandCardProps, Section } from '../game-core/commandCard';
import { UnitType } from '../game-core/unit';
import { Side } from '../types/hex';

interface CardTemplate {
  count: number;
  props: CommandCardProps & { id: string };
}

/** Copies per section, left / center / right */
type SectionCounts = [number, number, number];

const SECTION_NAMES: Record<Section, { id: string; name: string }> = {
  [Side.LEFT]: { id: 'left', name: 'en el flanco izquierdo' },
  [Side.CENTER]: { id: 'center', name: 'en el centro' },
  [Side.RIGHT]: { id: 'right', name: 'en el flanco derecho' },
};

/** One template per section for a card that exists for the left, center and right */
const perSection = (
  id: string,
  name: string,
  counts: SectionCounts,
  props: (section: Section, where: string) => CommandCardProps
): CardTemplate[] =>
  ([Side.LEFT, Side.CENTER, Side.RIGHT] as const).map((section, i) => ({
    count: counts[i]!,
    props: {
      id: `${id}-${SECTION_NAMES[section].id}`,
      name: `${name} ${SECTION_NAMES[section].name}`,
      sections: [section],
      ...props(section, SECTION_NAMES[section].name.replace(/^en (el )?/, '')),
    },
  }));

const ON_THE_MOVE = 'Además, 1 unidad en cualquier lugar puede moverse, pero no disparar.';

const cardTemplates: CardTemplate[] = [
  // --- Section cards (40)
  ...perSection('recon', 'Reconocimiento', [2, 2, 2], (_, where) => ({
    description: `Da una orden a 1 unidad del ${where}. ${ON_THE_MOVE} En la fase final, roba 3 cartas y quédate con 1.`,
    orders: 1,
    onTheMove: 1,
    drawChoice: 3,
  })),
  ...perSection('probe', 'Sondeo', [4, 5, 4], (_, where) => ({
    description: `Da órdenes a 2 unidades del ${where}. ${ON_THE_MOVE}`,
    orders: 2,
    onTheMove: 1,
  })),
  ...perSection('attack', 'Ataque', [3, 4, 3], (_, where) => ({
    description: `Da órdenes a 3 unidades del ${where}.`,
    orders: 3,
  })),
  ...perSection('assault', 'Asalto', [2, 2, 2], (_, where) => ({
    description: `Da órdenes a todas las unidades del ${where}.`,
    orders: 'all',
  })),
  {
    count: 2,
    props: {
      id: 'recon-in-force',
      name: 'Reconocimiento en fuerza',
      description: 'Da una orden a 1 unidad en cada sección.',
      orders: 3,
      perSection: 1,
    },
  },
  {
    count: 2,
    props: {
      id: 'general-advance',
      name: 'Avance general',
      description: 'Da órdenes a 2 unidades en cada sección.',
      orders: 6,
      perSection: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'pincer',
      name: 'Movimiento en pinza',
      description: 'Da órdenes a 2 unidades del flanco izquierdo y 2 del flanco derecho.',
      sections: [Side.LEFT, Side.RIGHT],
      orders: 4,
      perSection: 2,
    },
  },

  // --- Tactic cards (17)
  {
    count: 3,
    props: {
      id: 'move-out',
      name: 'En marcha',
      description: 'Da órdenes a 4 unidades de infantería.',
      tactic: true,
      unitTypes: [UnitType.INFANTRY],
      orders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'finest-hour',
      name: 'Su mejor hora',
      description:
        'Reparte 4 puntos: cada infantería cuesta 1 y cada tanque o artillería 2. Las unidades con orden disparan con 1 dado más.',
      tactic: true,
      orders: 4,
      orderCost: { [UnitType.TANK]: 2, [UnitType.ARTILLERY]: 2 },
      fireBonus: [{ dice: 1 }],
    },
  },
  {
    count: 2,
    props: {
      id: 'direct-from-hq',
      name: 'Directo del Cuartel General',
      description: 'Da órdenes a 4 unidades en cualquier sección.',
      tactic: true,
      orders: 4,
    },
  },
  {
    count: 1,
    props: {
      id: 'artillery-bombardment',
      name: 'Bombardeo de artillería',
      description:
        'Da órdenes a toda la artillería: cada una dispara dos veces sin moverse, o se mueve hasta 3 casillas sin disparar.',
      tactic: true,
      unitTypes: [UnitType.ARTILLERY],
      orders: 'all',
      maxMove: 3,
      holdShots: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'infantry-assault',
      name: 'Asalto de infantería',
      description:
        'Da órdenes a toda la infantería de una sección a elegir. Se mueve 1 casilla más, también para mover y disparar.',
      tactic: true,
      sections: 'chosen',
      unitTypes: [UnitType.INFANTRY],
      orders: 'all',
      moveBonus: 1,
    },
  },
  {
    count: 1,
    props: {
      id: 'close-assault',
      name: 'Asalto cercano',
      description:
        'Sin órdenes. En la batalla, cada unidad tuya adyacente a una unidad enemiga dispara en asalto cercano con 1 dado más.',
      tactic: true,
      closeAssaultOnly: true,
      fireBonus: [{ dice: 1, closeAssault: true }],
    },
  },
  {
    count: 2,
    props: {
      id: 'armor-assault',
      name: 'Asalto blindado',
      description: 'Da órdenes a 4 tanques. En asalto cercano tiran 1 dado más.',
      tactic: true,
      unitTypes: [UnitType.TANK],
      orders: 4,
      fireBonus: [{ dice: 1, closeAssault: true }],
    },
  },
  {
    count: 2,
    props: {
      id: 'firefight',
      name: 'Tiroteo',
      description:
        'Da órdenes a 4 unidades que no se mueven. Disparan con 1 dado más a distancia y 1 menos en asalto cercano.',
      tactic: true,
      orders: 4,
      noMove: true,
      fireBonus: [
        { dice: 1, closeAssault: false },
        { dice: -1, closeAssault: true },
      ],
    },
  },
  {
    count: 4,
    props: {
      id: 'preparations',
      name: 'Preparativos',
      description:
        'Da una orden a 1 unidad. En la fase final recibes 3 monedas y una carta de combate, en lugar de elegir entre ellas.',
      tactic: true,
      orders: 1,
      endOfTurnReward: { coins: 3, combatCard: true },
    },
  },
];

const commandCards: CommandCard[] = [];

cardTemplates.forEach(template => {
  for (let i = 0; i < template.count; i++) {
    // Suffix each copy so ids stay unique when a template has count > 1
    commandCards.push(new CommandCard({ ...template.props, id: `${template.props.id}-${i + 1}` }));
  }
});

export default commandCards;
