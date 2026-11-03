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
 * A unit's figures, each with the hits it has taken, front first and the squad leaders last (one,
 * or more once a unit has taken in another's leader with Regroup: `leaders`). Only armour has
 * figures that take more than one hit, so only a tank figure is ever above 0
 */
export type Figures = readonly number[];

/** The squad leaders a unit is left with: they're its last figures, so never more than it has */
export const leadersLeft = (figures: Figures, leaders: number): number => Math.min(leaders, figures.length);

/** A unit's figures at full strength */
export const freshFigures = (unitType: UnitType, count = FIGURES[unitType].figures): Figures => Array<number>(count).fill(0);

/**
 * The figure the next hit goes to: the most damaged one in front of the squad leaders (the front
 * one of equals); a leader only once only leaders are left
 */
const nextHit = (figures: Figures, leaders: number): number => {
  const front = figures.slice(0, Math.max(0, figures.length - leaders));
  const inFront = front.length > 0 ? front : figures;
  return inFront.indexOf(Math.max(...inFront));
};

/**
 * The figures after `hits` more, one by one; a figure that has taken all it takes is lost. With
 * only leaders left, each figure lost is a leader (`leadersLeft`)
 */
export function takeHits(figures: Figures, hits: number, perFigure: number, leaders = 1): Figures {
  const next = [...figures];
  for (let hit = 0; hit < hits && next.length > 0; hit++) {
    const at = nextHit(next, leaders);
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

/** A unit's figures and how many of them are squad leaders */
export interface Squad {
  figures: Figures;
  leaders: number;
}

/**
 * Regroup: the giver's figures join the receiver until it's back to full, the giver's healthy ones
 * first, then its damaged ones (the least damaged first), and its squad leaders last. Plain
 * figures that join go in front of the receiver's; a giver's leader that joins stays a leader,
 * just in front of the receiver's own, so the receiver has a leader more. The giver keeps the
 * rest, its leaders last
 */
export function regroupFigures(receiver: Squad, giver: Squad, unitType: UnitType): { receiver: Squad; giver: Squad } {
  const room = Math.max(0, FIGURES[unitType].figures - receiver.figures.length);
  const giverLeaders = leadersLeft(giver.figures, giver.leaders);
  const firstLeader = giver.figures.length - giverLeaders;
  const plain = giver.figures
    .slice(0, firstLeader)
    .map((hits, at) => ({ hits, at }))
    .sort((a, b) => a.hits - b.hits)
    .map(({ at }) => at);
  const leaders = Array.from({ length: giverLeaders }, (_, i) => firstLeader + i);
  const taken = new Set([...plain, ...leaders].slice(0, Math.min(room, giver.figures.length)));
  const pick = (from: number, to: number) => [...taken].filter((at) => at >= from && at < to).map((at) => giver.figures[at]!);
  const receiverLeaders = leadersLeft(receiver.figures, receiver.leaders);
  const receiverFirstLeader = receiver.figures.length - receiverLeaders;
  const leadersJoining = pick(firstLeader, giver.figures.length);
  return {
    receiver: {
      figures: [
        ...pick(0, firstLeader),
        ...receiver.figures.slice(0, receiverFirstLeader),
        ...leadersJoining,
        ...receiver.figures.slice(receiverFirstLeader),
      ],
      leaders: receiverLeaders + leadersJoining.length,
    },
    giver: { figures: giver.figures.filter((_, at) => !taken.has(at)), leaders: giverLeaders - leadersJoining.length },
  };
}

/**
 * Limited damage (house rule): a unit applies at most as many results as it has figures, one
 * more with a card's extra dice
 */
export const resultLimit = (figures: number, bonusDice: boolean): number => figures + (bonusDice ? 1 : 0);
