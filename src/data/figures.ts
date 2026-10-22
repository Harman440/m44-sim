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

/** Figures left after `hits`: a figure is only lost once all its hits are taken */
export const figuresLeft = (unitType: UnitType, hits: number, elite = false): number =>
  Math.max(0, Math.ceil((hitsToDestroy(unitType, elite) - hits) / hitsPerFigure(unitType, elite)));

/** A figure has taken some of its hits but not all (armour hit once): it's marked on the map */
export const figureDamaged = (unitType: UnitType, hits: number, elite = false): boolean =>
  hits > 0 && hits < hitsToDestroy(unitType, elite) && hits % hitsPerFigure(unitType, elite) !== 0;

/**
 * Limited damage (house rule): a unit applies at most as many results as it has figures, one
 * more with a card's extra dice
 */
export const resultLimit = (figures: number, bonusDice: boolean): number => figures + (bonusDice ? 1 : 0);
