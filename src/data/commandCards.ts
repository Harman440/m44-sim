// data/commandCards.ts
// The house command-card decks (docs/house-rules.md, "Command cards database",
// and the smaller deck of Steps 44 and 58). Each side gets 24 cards: 19 shared by
// every side, plus 5 that depend on the unit types it has in the scenario
// (`commandDeckFor`). The counts are meant to be tuned here. Names are the
// official Spanish edition's where we found them (Overlord supplement, Days of Wonder),
// and the official English edition's in English.
//
// Not in the deck: Recon, Counter Attack (not in the game) and Behind Enemy
// Lines, Barrage, Air Power, Dig In and Medics (combat cards, Step 24). Ambush was a
// combat card too, until the reaction cards were taken out (Step 61).
import CommandCard, { CommandCardProps, SECTIONS, Section } from '../game-core/commandCard';
import { UnitType } from '../game-core/unit';
import { Side } from '../types/hex';
import { Faction } from '../types/faction';
import { Scenario } from '../types/scenario';
import { Localized, byLang } from '../i18n/lang';

interface CardTemplate {
  count: number;
  props: CommandCardProps & { id: string };
}

/** Copies per section, left / center / right */
type SectionCounts = [number, number, number];

const SECTION_NAMES: Record<Section, { id: string; name: Localized; where: Localized }> = {
  [Side.LEFT]: {
    id: 'left',
    name: { es: 'en el flanco izquierdo', en: 'Left Flank' },
    where: { es: 'del flanco izquierdo', en: 'on the left flank' },
  },
  [Side.CENTER]: {
    id: 'center',
    name: { es: 'en el centro', en: 'Center' },
    where: { es: 'del centro', en: 'in the center' },
  },
  [Side.RIGHT]: {
    id: 'right',
    name: { es: 'en el flanco derecho', en: 'Right Flank' },
    where: { es: 'del flanco derecho', en: 'on the right flank' },
  },
};

/** One template per section for a card that exists for the left, center and right */
const perSection = (
  id: string,
  name: Localized,
  counts: SectionCounts,
  props: (where: Localized) => CommandCardProps
): CardTemplate[] =>
  ([Side.LEFT, Side.CENTER, Side.RIGHT] as const).map((section, i) => ({
    count: counts[i]!,
    props: {
      id: `${id}-${SECTION_NAMES[section].id}`,
      name: byLang((lang) => `${name[lang]} ${SECTION_NAMES[section].name[lang]}`),
      title: name,
      sections: [section],
      ...props(SECTION_NAMES[section].where),
    },
  }));

const ON_THE_MOVE: Localized = {
  es: 'Además, 1 unidad en cualquier lugar puede moverse, pero no disparar.',
  en: 'Also, 1 unit anywhere may move, but not fire.',
};

/** The cards every side gets */
const sharedTemplates: CardTemplate[] = [
  // --- Section cards (14)
  ...perSection('probe', { es: 'Batida', en: 'Probe' }, [1, 1, 1], (where) => ({
    description: {
      es: `Da órdenes a 2 unidades ${where.es}. ${ON_THE_MOVE.es}`,
      en: `Order 2 units ${where.en}. ${ON_THE_MOVE.en}`,
    },
    orders: 2,
    onTheMove: 1,
  })),
  ...perSection('attack', { es: 'Ataque', en: 'Attack' }, [1, 1, 1], (where) => ({
    description: { es: `Da órdenes a 3 unidades ${where.es}.`, en: `Order 3 units ${where.en}.` },
    orders: 3,
  })),
  ...perSection('assault', { es: 'Asalto', en: 'Assault' }, [1, 1, 1], (where) => ({
    description: { es: `Da órdenes a todas las unidades ${where.es}.`, en: `Order all units ${where.en}.` },
    orders: 'all',
  })),
  {
    count: 1,
    props: {
      id: 'recon-in-force',
      name: { es: 'Vanguardia', en: 'Recon in Force' },
      description: { es: 'Da una orden a 1 unidad en cada sección.', en: 'Order 1 unit in each section.' },
      orders: 3,
      perSection: 1,
    },
  },
  {
    count: 3,
    props: {
      id: 'general-advance',
      name: { es: 'Avance General', en: 'General Advance' },
      description: { es: 'Da órdenes a 2 unidades en cada sección.', en: 'Order 2 units in each section.' },
      orders: 6,
      perSection: 2,
    },
  },
  {
    count: 1,
    props: {
      id: 'pincer',
      name: { es: 'Movimiento en Pinza', en: 'Pincer Move' },
      description: {
        es: 'Da órdenes a 2 unidades del flanco izquierdo y 2 del flanco derecho.',
        en: 'Order 2 units on the left flank and 2 on the right flank.',
      },
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
      name: { es: 'La Hora de la Verdad', en: 'Their Finest Hour' },
      summary: {
        es: 'Hasta 4 órdenes pagadas con suministros. Disparan con +1 dado.',
        en: 'Up to 4 orders paid with supplies. They fire with +1 die.',
      },
      description: {
        es: 'Da órdenes a hasta 4 unidades pagando suministros: 1 por infantería y 2 por tanque o artillería. Las unidades con orden disparan con 1 dado más.',
        en: 'Order up to 4 units by paying supplies: 1 for infantry and 2 for a tank or artillery. Ordered units fire with 1 extra die.',
      },
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
      name: { es: 'Asalto de Infantería', en: 'Infantry Assault' },
      summary: {
        es: 'Toda la infantería de una sección. Mueve 1 casilla más.',
        en: 'All infantry in one section. Moves 1 extra hex.',
      },
      description: {
        es: 'Da órdenes a toda la infantería de una sección a elegir. Se mueve 1 casilla más, también para mover y disparar.',
        en: 'Order all infantry in a section of your choice. It moves 1 extra hex, also when moving and firing.',
      },
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
      name: { es: 'Asalto cercano', en: 'Close Assault' },
      summary: {
        es: 'Sin órdenes. Tus unidades en asalto cercano tiran +1 dado.',
        en: 'No orders. Your units in close assault roll +1 die.',
      },
      description: {
        es: 'Sin órdenes. En la batalla, cada unidad tuya adyacente a una unidad enemiga dispara en asalto cercano con 1 dado más.',
        en: 'No orders. In the battle, each of your units adjacent to an enemy unit fires in close assault with 1 extra die.',
      },
      tactic: true,
      closeAssaultOnly: true,
      fireBonus: [{ dice: 1, closeAssault: true }],
    },
  },
  {
    count: 1,
    props: {
      id: 'firefight',
      name: { es: 'Escaramuza', en: 'Firefight' },
      summary: {
        es: '4 órdenes sin mover. +1 dado a distancia, −1 en asalto cercano.',
        en: '4 orders, no moving. +1 die at range, −1 in close assault.',
      },
      description: {
        es: 'Da órdenes a 4 unidades que no se mueven. Disparan con 1 dado más a distancia y 1 menos en asalto cercano.',
        en: "Order 4 units that don't move. They fire with 1 extra die at range and 1 fewer in close assault.",
      },
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
      name: { es: 'Preparativos', en: 'Preparations' },
      summary: {
        es: '1 orden. Al final: 3 suministros, 1 de combate, roba 2 y quédate 1.',
        en: '1 order. At the end: 3 supplies, 1 combat card, draw 2, keep 1.',
      },
      description: {
        es: 'Da una orden a 1 unidad. En la fase final recibes 3 suministros y una carta de combate, en lugar de elegir entre ellas, y robas 2 cartas de mando y te quedas con 1.',
        en: 'Order 1 unit. In the final phase you get 3 supplies and a combat card, instead of choosing between them, and you draw 2 command cards and keep 1.',
      },
      tactic: true,
      orders: 1,
      drawChoice: 2,
      endOfTurnReward: { coins: 3, combatCard: true },
    },
  },
];

// --- The tactic cards that depend on the side's units
const moveOut: CommandCardProps & { id: string } = {
  id: 'move-out',
  name: { es: 'En marcha', en: 'Move Out!' },
  summary: { es: '4 órdenes a infantería.', en: '4 infantry orders.' },
  description: { es: 'Da órdenes a 4 unidades de infantería.', en: 'Order 4 infantry units.' },
  tactic: true,
  unitTypes: [UnitType.INFANTRY],
  orders: 4,
};

/** Kept out of the deck: only Refuel gives it */
const armorAssault: CommandCardProps & { id: string } = {
  id: 'armor-assault',
  name: { es: 'Asalto de Blindados', en: 'Armor Assault' },
  summary: { es: '4 órdenes a tanques. +1 dado en asalto cercano.', en: '4 tank orders. +1 die in close assault.' },
  description: {
    es: 'Da órdenes a 4 tanques. En asalto cercano tiran 1 dado más. Solo se consigue con Repostaje.',
    en: 'Order 4 tanks. In close assault they roll 1 extra die. Only Refuel gives it.',
  },
  tactic: true,
  unitTypes: [UnitType.TANK],
  orders: 4,
  fireBonus: [{ dice: 1, closeAssault: true }],
  reserve: true,
};

const refuel: CommandCardProps & { id: string } = {
  id: 'refuel',
  name: { es: 'Repostaje', en: 'Refuel' },
  summary: {
    es: '1 orden. Al final: 3 suministros, 1 de combate y Asalto de Blindados.',
    en: '1 order. At the end: 3 supplies, 1 combat card and Armor Assault.',
  },
  description: {
    es: 'Da una orden a 1 unidad. En la fase final recibes 3 suministros y una carta de combate, en lugar de elegir entre ellas, y en lugar de robar una carta de mando recibes Asalto de Blindados, que solo se consigue así. Si ya no te quedan blindados en el mapa, recibes Directo del Cuartel General.',
    en: 'Order 1 unit. In the final phase you get 3 supplies and a combat card, instead of choosing between them, and instead of drawing a command card you get Armor Assault, the only way to get it. If you have no armor left on the map, you get Direct from HQ.',
  },
  tactic: true,
  orders: 1,
  endOfTurnReward: { coins: 3, combatCard: true },
  rewardCard: { card: 'armor-assault', needs: UnitType.TANK, otherwise: 'direct-from-hq' },
};

const artilleryBombardment: CommandCardProps & { id: string } = {
  id: 'artillery-bombardment',
  name: { es: 'Bombardeo de Artillería', en: 'Artillery Bombardment' },
  summary: {
    es: 'Toda la artillería: dispara 2 veces, o mueve 3 sin disparar.',
    en: 'All artillery: fires twice, or moves 3 without firing.',
  },
  description: {
    es: 'Da órdenes a toda la artillería: cada una dispara dos veces sin moverse, o se mueve hasta 3 casillas sin disparar.',
    en: 'Order all artillery: each one fires twice without moving, or moves up to 3 hexes without firing.',
  },
  tactic: true,
  unitTypes: [UnitType.ARTILLERY],
  orders: 'all',
  maxMove: 3,
  holdShots: 2,
};

const directFromHq: CommandCardProps & { id: string } = {
  id: 'direct-from-hq',
  name: { es: 'Directo del Cuartel General', en: 'Direct from HQ' },
  summary: { es: '4 órdenes en cualquier sección.', en: '4 orders in any section.' },
  description: { es: 'Da órdenes a 4 unidades en cualquier sección.', en: 'Order 4 units in any section.' },
  tactic: true,
  orders: 4,
};

/**
 * The 5 unit-type cards for a side with (or without) tanks and artillery. Infantry
 * isn't checked: a side without it gets the set for its armour and artillery
 */
const unitTemplates = (tanks: boolean, artillery: boolean): CardTemplate[] => {
  if (tanks && artillery) {
    return [
      { count: 2, props: moveOut },
      { count: 1, props: refuel },
      { count: 1, props: artilleryBombardment },
      { count: 1, props: directFromHq },
    ];
  }
  if (tanks) return [{ count: 2, props: moveOut }, { count: 1, props: refuel }, { count: 2, props: directFromHq }];
  if (artillery) {
    return [{ count: 2, props: moveOut }, { count: 1, props: artilleryBombardment }, { count: 2, props: directFromHq }];
  }
  return [{ count: 5, props: moveOut }];
};

const buildDeck = (templates: CardTemplate[]): CommandCard[] =>
  templates.flatMap((template) =>
    // Suffix each copy so ids stay unique when a template has count > 1
    Array.from({ length: template.count }, (_, i) => new CommandCard({ ...template.props, id: `${template.props.id}-${i + 1}`, templateId: template.props.id }))
  );

/** Whether a side starts with (or is dropped) units of a type in the scenario */
export const hasUnits = (scenario: Scenario, faction: Faction, type: UnitType): boolean =>
  (scenario.units[faction === 'Axis' ? 'axis' : 'allies'][type]?.length ?? 0) > 0 ||
  (scenario.paradrop?.faction === faction && scenario.paradrop.unitType === type);

/**
 * The cards a side with armour keeps out of its deck, which only Refuel gives: Armor Assault, and
 * a Direct from HQ for when no armour is left
 */
const reserveCards = (change = (props: CommandCardProps & { id: string }) => props): CommandCard[] => [
  new CommandCard({ ...change(armorAssault), id: 'armor-assault-1', templateId: armorAssault.id }),
  new CommandCard({ ...change(directFromHq), id: 'direct-from-hq-reserve-1', templateId: directFromHq.id, reserve: true }),
];

/**
 * A side's 24-card command deck: the shared cards plus 5 for the unit types it has. A side with
 * armour also gets the cards kept out of the deck (`reserve`) that Refuel gives
 */
export function commandDeckFor(scenario: Scenario, faction: Faction): CommandCard[] {
  const tanks = hasUnits(scenario, faction, UnitType.TANK);
  return [
    ...buildDeck([...sharedTemplates, ...unitTemplates(tanks, hasUnits(scenario, faction, UnitType.ARTILLERY))]),
    ...(tanks ? reserveCards() : []),
  ];
}


// --- The sections variant (game-core/frontSections.ts): a card for each section every turn, so
// no card picks or spreads over sections. The section cards all become Attack (Ataque), some
// tactic cards order more units, and no card draws two to keep one.

const attack: CommandCardProps & { id: string } = {
  id: 'attack',
  name: { es: 'Ataque', en: 'Attack' },
  summary: { es: '4 órdenes.', en: '4 orders.' },
  description: { es: 'Da órdenes a 4 unidades de la sección.', en: 'Order 4 units in the section.' },
  // Drawn with a painting, not the section arrows
  tactic: true,
  orders: 4,
};

/** The section cards: Batida, Ataque, Asalto, Vanguardia, Avance General and Movimiento en Pinza */
const isSectionCard = ({ props }: CardTemplate) => !props.tactic;

/** How the variant changes a card, by template id */
const VARIANT_CHANGES: Record<string, Partial<CommandCardProps>> = {
  'finest-hour': {
    orders: 6,
    summary: { es: 'Hasta 6 órdenes pagadas con suministros. Disparan con +1 dado.', en: 'Up to 6 orders paid with supplies. They fire with +1 die.' },
    description: {
      es: 'Da órdenes a hasta 6 unidades de la sección pagando suministros: 1 por infantería y 2 por tanque o artillería. Las unidades con orden disparan con 1 dado más.',
      en: 'Order up to 6 units in the section by paying supplies: 1 for infantry and 2 for a tank or artillery. Ordered units fire with 1 extra die.',
    },
  },
  'infantry-assault': {
    sections: SECTIONS,
    summary: { es: 'Toda la infantería de la sección. Mueve 1 casilla más.', en: 'All infantry in the section. Moves 1 extra hex.' },
    description: {
      es: 'Da órdenes a toda la infantería de la sección. Se mueve 1 casilla más, también para mover y disparar.',
      en: 'Order all infantry in the section. It moves 1 extra hex, also when moving and firing.',
    },
  },
  'close-assault': {
    summary: { es: 'Sin órdenes. Tus unidades de la sección en asalto cercano tiran +1 dado.', en: 'No orders. Your units in the section roll +1 die in close assault.' },
    description: {
      es: 'Sin órdenes. En la batalla, cada unidad tuya de la sección adyacente a una unidad enemiga dispara en asalto cercano con 1 dado más.',
      en: 'No orders. In the battle, each of your units in the section adjacent to an enemy unit fires in close assault with 1 extra die.',
    },
  },
  firefight: {
    orders: 6,
    summary: { es: '6 órdenes sin mover. +1 dado a distancia, −1 en asalto cercano.', en: '6 orders, no moving. +1 die at range, −1 in close assault.' },
    description: {
      es: 'Da órdenes a 6 unidades de la sección que no se mueven. Disparan con 1 dado más a distancia y 1 menos en asalto cercano.',
      en: "Order 6 units in the section that don't move. They fire with 1 extra die at range and 1 fewer in close assault.",
    },
  },
  preparations: {
    drawChoice: 1,
    summary: { es: '1 orden. Al final: 3 suministros y 1 de combate.', en: '1 order. At the end: 3 supplies and 1 combat card.' },
    description: {
      es: 'Da una orden a 1 unidad de la sección. En la fase final recibes 3 suministros y una carta de combate, en lugar de elegir entre ellas.',
      en: 'Order 1 unit in the section. In the final phase you get 3 supplies and a combat card, instead of choosing between them.',
    },
  },
  'move-out': {
    orders: 6,
    summary: { es: '6 órdenes a infantería.', en: '6 infantry orders.' },
    description: { es: 'Da órdenes a 6 unidades de infantería de la sección.', en: 'Order 6 infantry units in the section.' },
  },
  'artillery-bombardment': {
    summary: { es: 'Toda la artillería de la sección: dispara 2 veces, o mueve 3 sin disparar.', en: 'All artillery in the section: fires twice, or moves 3 without firing.' },
    description: {
      es: 'Da órdenes a toda la artillería de la sección: cada una dispara dos veces sin moverse, o se mueve hasta 3 casillas sin disparar.',
      en: 'Order all artillery in the section: each one fires twice without moving, or moves up to 3 hexes without firing.',
    },
  },
  'direct-from-hq': {
    orders: 6,
    summary: { es: '6 órdenes.', en: '6 orders.' },
    description: { es: 'Da órdenes a 6 unidades de la sección.', en: 'Order 6 units in the section.' },
  },
};

const inVariant = <T extends CommandCardProps & { id: string }>(props: T): T => ({ ...props, ...VARIANT_CHANGES[props.id] });

/**
 * A side's deck in the sections variant: the same cards as `commandDeckFor`, the section cards
 * turned into as many Attack cards and the tactic cards changed as `VARIANT_CHANGES` says
 */
export function sectionsVariantDeck(scenario: Scenario, faction: Faction): CommandCard[] {
  const tanks = hasUnits(scenario, faction, UnitType.TANK);
  const templates = [...sharedTemplates, ...unitTemplates(tanks, hasUnits(scenario, faction, UnitType.ARTILLERY))];
  const attacks = templates.filter(isSectionCard).reduce((sum, template) => sum + template.count, 0);
  const others = templates.filter((template) => !isSectionCard(template)).map((template) => ({ ...template, props: inVariant(template.props) }));
  return [...buildDeck([{ count: attacks, props: attack }, ...others]), ...(tanks ? reserveCards(inVariant) : [])];
}
