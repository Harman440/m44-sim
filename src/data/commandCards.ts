// data/commandCards.ts
// The house command-card decks (docs/house-rules.md, "Command cards database",
// and the smaller deck of Step 44). Each side gets 25 cards: 21 shared by every
// side, plus 4 that depend on the unit types it has in the scenario
// (`commandDeckFor`). The counts are meant to be tuned here. Names are the
// official Spanish edition's where we found them (Overlord supplement, Days of Wonder).
//
// Not in the deck: Recon, Counter Attack (not in the game) and Behind Enemy
// Lines, Ambush, Barrage, Air Power, Dig In and Medics (combat cards, Step 24).
import CommandCard, { CommandCardProps, Section } from '../game-core/commandCard';
import { UnitType } from '../game-core/unit';
import { Side } from '../types/hex';
import { Faction } from '../types/faction';
import { Scenario } from '../types/scenario';

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

/** The cards every side gets */
const sharedTemplates: CardTemplate[] = [
  // --- Section cards (16)
  ...perSection('probe', 'Batida', [2, 2, 2], (_, where) => ({
    description: `Da órdenes a 2 unidades del ${where}. ${ON_THE_MOVE} En la fase final, roba 2 cartas y quédate con 1.`,
    orders: 2,
    onTheMove: 1,
    drawChoice: 2,
  })),
  ...perSection('attack', 'Ataque', [1, 1, 1], (_, where) => ({
    description: `Da órdenes a 3 unidades del ${where}.`,
    orders: 3,
  })),
  ...perSection('assault', 'Asalto', [1, 1, 1], (_, where) => ({
    description: `Da órdenes a todas las unidades del ${where}.`,
    orders: 'all',
  })),
  {
    count: 1,
    props: {
      id: 'recon-in-force',
      name: 'Tropa de Reconocimiento',
      description: 'Da una orden a 1 unidad en cada sección.',
      orders: 3,
      perSection: 1,
    },
  },
  {
    count: 2,
    props: {
      id: 'general-advance',
      name: 'Avance General',
      description: 'Da órdenes a 2 unidades en cada sección.',
      orders: 6,
      perSection: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'pincer',
      name: 'Movimiento en Pinza',
      description: 'Da órdenes a 2 unidades del flanco izquierdo y 2 del flanco derecho.',
      sections: [Side.LEFT, Side.RIGHT],
      orders: 4,
      perSection: 2,
    },
  },

  // --- Tactic cards (5)
  {
    count: 1,
    props: {
      id: 'finest-hour',
      name: 'La Hora de la Verdad',
      description:
        'Da órdenes a hasta 4 unidades pagando suministros: 1 por infantería y 2 por tanque o artillería. Las unidades con orden disparan con 1 dado más.',
      tactic: true,
      orders: 4,
      coinCost: { [UnitType.INFANTRY]: 1, [UnitType.TANK]: 2, [UnitType.ARTILLERY]: 2 },
      fireBonus: [{ dice: 1 }],
    },
  },
  {
    count: 1,
    props: {
      id: 'infantry-assault',
      name: 'Asalto de Infantería',
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
    count: 1,
    props: {
      id: 'firefight',
      name: 'Escaramuza',
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
    count: 1,
    props: {
      id: 'preparations',
      name: 'Preparativos',
      description:
        'Da una orden a 1 unidad. En la fase final recibes 3 suministros y una carta de combate, en lugar de elegir entre ellas.',
      tactic: true,
      orders: 1,
      endOfTurnReward: { coins: 3, combatCard: true },
    },
  },
];

// --- The tactic cards that depend on the side's units
const moveOut: CommandCardProps & { id: string } = {
  id: 'move-out',
  name: 'En marcha',
  description: 'Da órdenes a 4 unidades de infantería.',
  tactic: true,
  unitTypes: [UnitType.INFANTRY],
  orders: 4,
};

const armorAssault: CommandCardProps & { id: string } = {
  id: 'armor-assault',
  name: 'Asalto de Blindados',
  description: 'Da órdenes a 4 tanques. En asalto cercano tiran 1 dado más.',
  tactic: true,
  unitTypes: [UnitType.TANK],
  orders: 4,
  fireBonus: [{ dice: 1, closeAssault: true }],
};

const artilleryBombardment: CommandCardProps & { id: string } = {
  id: 'artillery-bombardment',
  name: 'Bombardeo de Artillería',
  description:
    'Da órdenes a toda la artillería: cada una dispara dos veces sin moverse, o se mueve hasta 3 casillas sin disparar.',
  tactic: true,
  unitTypes: [UnitType.ARTILLERY],
  orders: 'all',
  maxMove: 3,
  holdShots: 2,
};

const directFromHq: CommandCardProps & { id: string } = {
  id: 'direct-from-hq',
  name: 'Directo del Cuartel General',
  description: 'Da órdenes a 4 unidades en cualquier sección.',
  tactic: true,
  orders: 4,
};

/**
 * The 4 unit-type cards for a side with (or without) tanks and artillery. Infantry
 * isn't checked: a side without it gets the set for its armour and artillery
 */
const unitTemplates = (tanks: boolean, artillery: boolean): CardTemplate[] => {
  if (tanks && artillery) {
    return [moveOut, armorAssault, artilleryBombardment, directFromHq].map((props) => ({ count: 1, props }));
  }
  if (tanks) return [{ count: 1, props: moveOut }, { count: 1, props: armorAssault }, { count: 2, props: directFromHq }];
  if (artillery) {
    return [{ count: 1, props: moveOut }, { count: 1, props: artilleryBombardment }, { count: 2, props: directFromHq }];
  }
  return [{ count: 4, props: moveOut }];
};

const buildDeck = (templates: CardTemplate[]): CommandCard[] =>
  templates.flatMap((template) =>
    // Suffix each copy so ids stay unique when a template has count > 1
    Array.from({ length: template.count }, (_, i) => new CommandCard({ ...template.props, id: `${template.props.id}-${i + 1}` }))
  );

/** Whether a side starts with (or is dropped) units of a type in the scenario */
export const hasUnits = (scenario: Scenario, faction: Faction, type: UnitType): boolean =>
  (scenario.units[faction === 'Axis' ? 'axis' : 'allies'][type]?.length ?? 0) > 0 ||
  (scenario.paradrop?.faction === faction && scenario.paradrop.unitType === type);

/** A side's 25-card command deck: the shared cards plus 4 for the unit types it has */
export function commandDeckFor(scenario: Scenario, faction: Faction): CommandCard[] {
  return buildDeck([
    ...sharedTemplates,
    ...unitTemplates(hasUnits(scenario, faction, UnitType.TANK), hasUnits(scenario, faction, UnitType.ARTILLERY)),
  ]);
}
