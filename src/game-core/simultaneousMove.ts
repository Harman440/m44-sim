import { Faction } from "../types/faction";
import { Position } from "../types/scenario";
import { samePosition } from "./position";

/** An ordered unit that moves: its path from the start hex, start and end included */
export interface Mover {
  side: Faction;
  /** Its order's index in its side's turn */
  order: number;
  path: readonly Position[];
}

/** A unit that doesn't move this turn: no order, or an order to hold */
export interface Stander {
  side: Faction;
  /** Its order's index when it was ordered to hold; null without an order */
  order: number | null;
  position: Position;
}

/** One of the two units in a collision, where it stands once the movement is over */
export interface CollidingUnit {
  side: Faction;
  order: number | null;
  position: Position;
}

/**
 * Two enemy units that met while moving (house rule): both stop and roll their close assault
 * dice minus 1, terrain ignored.
 * - `same-hex`: both stepped into the same hex (`hex`); neither enters it
 * - `crossing`: they stepped into each other's hex at once; each stays on its own
 * - `standing`: one stepped into the hex (`hex`) of an enemy that doesn't move there; it stays out
 */
export interface Collision {
  /** The step the units met at, 1 for the first hex of the moves */
  step: number;
  kind: "same-hex" | "crossing" | "standing";
  /** The hex fought over; for a crossing, none (they meet on the edge between their hexes) */
  hex: Position | null;
  units: [CollidingUnit, CollidingUnit];
}

export interface MovementResult {
  /** Where each mover ends, by side and order index: its path's end, or where it stopped */
  ends: { side: Faction; order: number; end: Position; stopped: boolean }[];
  collisions: Collision[];
}

interface Moving {
  side: Faction;
  order: number;
  path: readonly Position[];
  /** Index in the path of the hex it stands on */
  at: number;
  /** Still moving: it hasn't reached its end, met an enemy or been blocked */
  moving: boolean;
  stopped: boolean;
}

/**
 * Carry out both sides' moves at once, one hex at a time (house rule): every unit takes its
 * first step, then its second, and so on. A unit stops when it meets an enemy (a collision) or
 * when its next hex holds one of its own units that stays there. All positions are in one
 * side's view of the board (the Allies', unturned), for both sides.
 */
export function moveSimultaneously(movers: readonly Mover[], standers: readonly Stander[]): MovementResult {
  const units: Moving[] = movers.map((mover) => ({
    ...mover,
    at: 0,
    moving: mover.path.length > 1,
    stopped: false,
  }));
  const collisions: Collision[] = [];
  const longest = Math.max(0, ...movers.map((mover) => mover.path.length - 1));

  const here = (unit: Moving) => unit.path[unit.at]!;
  const colliding = (unit: Moving): CollidingUnit => ({ side: unit.side, order: unit.order, position: here(unit) });
  const halt = (unit: Moving) => {
    unit.moving = false;
    unit.stopped = unit.at < unit.path.length - 1;
  };

  for (let step = 1; step <= longest; step++) {
    // Each unit still moving wants its next hex
    const stepping = units.filter((unit) => unit.moving);
    const next = new Map(stepping.map((unit) => [unit, unit.path[unit.at + 1]!]));

    // Enemies stepping into each other's hex
    for (const a of stepping) {
      for (const b of stepping) {
        if (a.side >= b.side || !a.moving || !b.moving) continue;
        if (samePosition(next.get(a)!, here(b)) && samePosition(next.get(b)!, here(a))) {
          collisions.push({ step, kind: "crossing", hex: null, units: [colliding(a), colliding(b)] });
          halt(a);
          halt(b);
        }
      }
    }

    // Units stepping into the same hex: enemies collide; of two friends, the later order waits
    for (const a of stepping) {
      for (const b of stepping) {
        if (a === b || !a.moving || !b.moving || !samePosition(next.get(a)!, next.get(b)!)) continue;
        if (a.side !== b.side) {
          if (a.side < b.side) {
            collisions.push({ step, kind: "same-hex", hex: next.get(a)!, units: [colliding(a), colliding(b)] });
            halt(a);
            halt(b);
          }
        } else if (a.order > b.order) {
          halt(a);
        }
      }
    }

    // A hex held by a unit that stays there: a friend waits, an enemy is a collision. A unit
    // stopping here may in turn hold up another, so go round until nothing changes
    for (let changed = true; changed; ) {
      changed = false;
      for (const unit of stepping) {
        if (!unit.moving) continue;
        const target = next.get(unit)!;
        const stayingMover = units.find((other) => other !== unit && !other.moving && samePosition(here(other), target));
        const stander = standers.find((other) => samePosition(other.position, target));
        const holder = stayingMover ?? stander;
        if (!holder) continue;
        if (holder.side !== unit.side) {
          const held: CollidingUnit = stayingMover
            ? colliding(stayingMover)
            : { side: stander!.side, order: stander!.order, position: stander!.position };
          collisions.push({ step, kind: "standing", hex: target, units: [colliding(unit), held] });
        }
        halt(unit);
        changed = true;
      }
    }

    // The rest step on
    for (const unit of stepping) {
      if (!unit.moving) continue;
      unit.at++;
      if (unit.at === unit.path.length - 1) unit.moving = false;
    }
  }

  return {
    ends: units.map((unit) => ({ side: unit.side, order: unit.order, end: here(unit), stopped: unit.stopped })),
    collisions,
  };
}
