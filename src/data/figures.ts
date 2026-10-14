import { UnitType } from "../game-core/unit";

/**
 * Pass and play's figures (house rules, not the official counts): how many figures a unit
 * starts with and how many hits each figure takes. Armour has 3 figures of 2 hits each (6 hits
 * in all); a destroyed artillery leaves its crew behind, `ARTILLERY_CREW_FIGURES` infantry figures
 */
export const FIGURES: Record<UnitType, { figures: number; hitsPerFigure: number }> = {
  [UnitType.INFANTRY]: { figures: 7, hitsPerFigure: 1 },
  [UnitType.TANK]: { figures: 3, hitsPerFigure: 2 },
  [UnitType.ARTILLERY]: { figures: 3, hitsPerFigure: 1 },
};

export const ARTILLERY_CREW_FIGURES = 1;

/** Hits that destroy a unit of this type */
export const hitsToDestroy = (unitType: UnitType): number => FIGURES[unitType].figures * FIGURES[unitType].hitsPerFigure;

/** Figures left after `hits`: a figure is only lost once all its hits are taken */
export const figuresLeft = (unitType: UnitType, hits: number): number =>
  Math.max(0, Math.ceil((hitsToDestroy(unitType) - hits) / FIGURES[unitType].hitsPerFigure));

/**
 * Limited damage (house rule): a unit applies at most as many results as it has figures, one
 * more with a card's extra dice
 */
export const resultLimit = (figures: number, bonusDice: boolean): number => figures + (bonusDice ? 1 : 0);
