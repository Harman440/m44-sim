import { UnitType } from "../game-core/unit";

/**
 * Pass and play's figures (house rules, not the official counts): how many figures a unit
 * starts with and how many hits each figure takes. Armour has 3 figures of 2 hits each (6 hits
 * in all); a destroyed artillery leaves its crew behind, `ARTILLERY_CREW_FIGURES` infantry figures
 */
export const FIGURES: Record<UnitType, { figures: number; hitsPerFigure: number }> = {
  [UnitType.INFANTRY]: { figures: 6, hitsPerFigure: 1 },
  [UnitType.TANK]: { figures: 3, hitsPerFigure: 2 },
  [UnitType.ARTILLERY]: { figures: 3, hitsPerFigure: 1 },
};

export const ARTILLERY_CREW_FIGURES = 1;

/** Hits each figure of an elite unit takes, where it differs from its type's (elite tanks: 3) */
export const ELITE_HITS_PER_FIGURE: Partial<Record<UnitType, number>> = {
  [UnitType.TANK]: 3,
};

/** Hits each figure of the unit takes */
export const hitsPerFigure = (unitType: UnitType, elite = false): number =>
  (elite ? ELITE_HITS_PER_FIGURE[unitType] : undefined) ?? FIGURES[unitType].hitsPerFigure;

/** Hits that destroy a unit of this type */
export const hitsToDestroy = (unitType: UnitType, elite = false): number => FIGURES[unitType].figures * hitsPerFigure(unitType, elite);

/**
 * A unit's figures, each with the hits it has taken, front first and the squad leader last. Only
 * armour has figures that take more than one hit, so only a tank figure is ever above 0
 */
export type Figures = readonly number[];

/** A unit's figures at full strength */
export const freshFigures = (unitType: UnitType, count = FIGURES[unitType].figures): Figures => Array<number>(count).fill(0);

/**
 * The figure the next hit goes to: the most damaged one in front of the squad leader (the front
 * one of equals); the leader only once it's alone
 */
const nextHit = (figures: Figures): number => {
  const inFront = figures.length > 1 ? figures.slice(0, -1) : figures;
  return inFront.indexOf(Math.max(...inFront));
};

/** The figures after `hits` more, one by one; a figure that has taken all it takes is lost */
export function takeHits(figures: Figures, hits: number, perFigure: number): Figures {
  const next = [...figures];
  for (let hit = 0; hit < hits && next.length > 0; hit++) {
    const at = nextHit(next);
    const taken = (next[at] ?? 0) + 1;
    if (taken >= perFigure) next.splice(at, 1);
    else next[at] = taken;
  }
  return next;
}

/** A figure has taken some of its hits but not all (armour hit once): it's marked on the map */
export const damagedFigures = (figures: Figures): number => figures.filter((hits) => hits > 0).length;

/** Mechanic: the most damaged figure is mended */
export function mendFigure(figures: Figures): Figures {
  const worst = Math.max(0, ...figures);
  if (worst === 0) return figures;
  const at = figures.indexOf(worst);
  return figures.map((hits, i) => (i === at ? 0 : hits));
}

/** Medic: a lost figure back, at the front, up to the unit's full strength */
export const healFigure = (figures: Figures, unitType: UnitType): Figures =>
  figures.length < FIGURES[unitType].figures ? [0, ...figures] : figures;

/**
 * Limited damage (house rule): a unit applies at most as many results as it has figures, one
 * more with a card's extra dice
 */
export const resultLimit = (figures: number, bonusDice: boolean): number => figures + (bonusDice ? 1 : 0);
