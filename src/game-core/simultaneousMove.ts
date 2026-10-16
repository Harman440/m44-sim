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
 * first step, then its second, and so on. A unit stops when it meets an enemy (a collision).
 * Units of one side never hold each other up on the way: only the hex a unit ends on counts.
 * When two of them end on one hex (one stopped short there by a collision), the one that got
 * there last goes back along its path to the nearest free hex. All positions are in one side's
 * view of the board (the Allies', unturned), for both sides.
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

    // Enemies stepping into the same hex
    for (const a of stepping) {
      for (const b of stepping) {
        if (a.side >= b.side || !a.moving || !b.moving || !samePosition(next.get(a)!, next.get(b)!)) continue;
        collisions.push({ step, kind: "same-hex", hex: next.get(a)!, units: [colliding(a), colliding(b)] });
        halt(a);
        halt(b);
      }
    }

    // A hex held by an enemy that stays there is a collision. A unit stopping here may in turn
    // be in an enemy's way, so go round until nothing changes
    for (let changed = true; changed; ) {
      changed = false;
      for (const unit of stepping) {
        if (!unit.moving) continue;
        const target = next.get(unit)!;
        const stayingMover = units.find(
          (other) => other.side !== unit.side && !other.moving && samePosition(here(other), target)
        );
        const stander = standers.find((other) => other.side !== unit.side && samePosition(other.position, target));
        if (!stayingMover && !stander) continue;
        const held: CollidingUnit = stayingMover
          ? colliding(stayingMover)
          : { side: stander!.side, order: stander!.order, position: stander!.position };
        collisions.push({ step, kind: "standing", hex: target, units: [colliding(unit), held] });
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

  settleSharedHexes(units, standers, collisions);
  return {
    ends: units.map((unit) => ({ side: unit.side, order: unit.order, end: here(unit), stopped: unit.stopped })),
    collisions,
  };
}

/**
 * Two units that end on one hex: the one that got there last (a step per hex, so the furthest
 * along its path; on a tie, one stopped short, then the later order) goes back along its path
 * to the nearest hex nobody ends on, or one hex back to sort out from there. Its collisions
 * follow it. Units only share a hex when one was stopped short by a collision, so this is rare.
 */
function settleSharedHexes(units: Moving[], standers: readonly Stander[], collisions: Collision[]) {
  const ends = () => [
    ...units.map((unit) => ({ unit, position: unit.path[unit.at]! })),
    ...standers.map((stander) => ({ unit: null, position: stander.position })),
  ];
  const latest = (a: Moving, b: Moving) =>
    b.at - a.at || Number(b.stopped) - Number(a.stopped) || b.order - a.order;

  for (;;) {
    const all = ends();
    const shared = all.find(({ position }, i) => all.some((other, j) => j !== i && samePosition(other.position, position)));
    if (!shared) return;
    const back = all
      .filter(({ unit, position }) => unit && unit.at > 0 && samePosition(position, shared.position))
      .map(({ unit }) => unit!)
      .sort(latest)[0]!;
    const taken = (position: Position) => all.some((end) => end.unit !== back && samePosition(end.position, position));
    let to = back.at - 1;
    while (to > 0 && taken(back.path[to]!)) to--;
    if (taken(back.path[to]!)) to = back.at - 1;

    const from = back.path[back.at]!;
    back.at = to;
    back.stopped = true;
    for (const collision of collisions) {
      collision.units = collision.units.map((unit) =>
        unit.side === back.side && unit.order === back.order && samePosition(unit.position, from)
          ? { ...unit, position: back.path[to]! }
          : unit
      ) as Collision["units"];
    }
  }
}
