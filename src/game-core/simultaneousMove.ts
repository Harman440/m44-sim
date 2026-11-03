// game-core/simultaneousMove.ts
// Pass and play's movement (house rules): both armies move at once, one hex at a time. Every
// unit that moves takes its first step, then its second, and so on. Enemy units that meet
// collide: the movement stops until the collision is rolled and its retreats made, hex by hex,
// then it goes on. Plain functions over a serializable `MoveRun`; PassAndPlayMatch rolls the
// dice and deals the hits. All positions are in the Allies' view (unturned), for both sides.
import { Faction } from "../types/faction";
import { Position } from "../types/scenario";
import Hex from "./hex";
import { hexDistance } from "./fireTargets";
import { includesPosition, samePosition } from "./position";

/** An ordered unit that moves: its path from the start hex, start and end included */
export interface Mover {
  side: Faction;
  /** Its order's index in its side's turn */
  order: number;
  path: readonly Position[];
  /** It's infantry: armour with Armor Forward goes through it when it stays put (`throughInfantry`) */
  infantry?: boolean;
  /** Armor Forward (house rule): it goes through enemy infantry that stays put, which takes a flag */
  throughInfantry?: boolean;
}

/** A unit that doesn't move this turn: no order, or an order to hold */
export interface Stander {
  side: Faction;
  /** Its order's index when it was ordered to hold; null without an order */
  order: number | null;
  position: Position;
  /** It's infantry: armour with Armor Forward goes through it (`Mover.throughInfantry`) */
  infantry?: boolean;
}

/** A unit in the run: where it is now and how far along its path */
export interface RunUnit {
  side: Faction;
  order: number | null;
  /** Where its side's board has it while the run lasts: its order's end, or where it stands */
  boardAt: Position;
  /** Its path, start and end included; one hex for a unit that doesn't move */
  path: Position[];
  /** Index in `path` of the hex it's on; null once it's been pushed off its path */
  at: number | null;
  /** Once pushed off its path: the hexes it went to from there, in order (`path` up to where it left, then these) */
  offPath: Position[];
  /** The index in `path` of the hex it was pushed off from */
  leftAt: number | null;
  position: Position;
  /** The step it got to the hex it's on (0: it started there) */
  arrived: number;
  /** Still moving: it hasn't reached its end, collided or been pushed */
  moving: boolean;
  /** It reached the end of its path (a tank there cleared the wire) */
  reachedEnd: boolean;
  /** It met an enemy: it moves no more this turn */
  collided: boolean;
  /** Destroyed: off the map */
  gone: boolean;
  infantry: boolean;
  throughInfantry: boolean;
}

/**
 * Two enemy units that met (house rule). Both stop and roll their close assault dice minus 1,
 * terrain ignored.
 * - `same-hex`: both stepped into the same hex (`hex`) at once and share it until it's settled
 * - `crossing`: they stepped into each other's hex at once; each stays on its own
 * - `standing`: one stepped into the hex (`hex`) of an enemy that stays there, and shares it
 */
export interface RunCollision {
  /** The step the units met at, 1 for the first hex of the moves */
  step: number;
  kind: "same-hex" | "crossing" | "standing";
  /** The hex fought over; for a crossing, none (they meet on the edge between their hexes) */
  hex: Position | null;
  /** The two units, by index in `MoveRun.units` */
  units: [number, number];
  /** Which of the two keeps the hex when neither rolls a flag: the one that was there first; null for neither */
  priority: 0 | 1 | null;
  resolved: boolean;
}

/**
 * Armour with Armor Forward went through a hex of enemy infantry that stayed put (house rule):
 * no collision, and the infantry takes a flag, as if one had been rolled on it
 */
export interface Overrun {
  step: number;
  /** The infantry's hex */
  hex: Position;
  /** The armour that went through, by index in `MoveRun.units` */
  armour: number;
  /** The infantry it went through */
  infantry: number;
}

/** A unit pushed out by a collision: hexes still to go, away from the enemy it met */
export interface Push {
  unit: number;
  hexes: number;
  /** Where the enemy it collided with is: a hex it picks itself may not be nearer it */
  enemy: Position;
}

export interface MoveRun {
  /** Steps taken so far */
  step: number;
  units: RunUnit[];
  collisions: RunCollision[];
  overruns: Overrun[];
  /** Pushes still to make, the first one next */
  pushes: Push[];
  /** Every unit has stopped and everything is settled */
  finished: boolean;
}

/** Whether a unit could stand on this hex (on the map, not water); the run checks that no unit is there */
export type Passable = (position: Position) => boolean;

/** The run before anything has moved */
export function startRun(movers: readonly Mover[], standers: readonly Stander[]): MoveRun {
  const units: RunUnit[] = [
    ...movers.map((mover) => ({
      side: mover.side,
      order: mover.order,
      boardAt: { ...mover.path.at(-1)! },
      path: mover.path.map((hex) => ({ ...hex })),
      at: 0,
      offPath: [],
      leftAt: null,
      position: { ...mover.path[0]! },
      arrived: 0,
      moving: mover.path.length > 1,
      reachedEnd: mover.path.length <= 1,
      collided: false,
      gone: false,
      infantry: !!mover.infantry,
      throughInfantry: !!mover.throughInfantry,
    })),
    ...standers.map((stander) => ({
      side: stander.side,
      order: stander.order,
      boardAt: { ...stander.position },
      path: [{ ...stander.position }],
      at: 0,
      offPath: [],
      leftAt: null,
      position: { ...stander.position },
      arrived: 0,
      moving: false,
      reachedEnd: true,
      collided: false,
      gone: false,
      infantry: !!stander.infantry,
      throughInfantry: false,
    })),
  ];
  return { step: 0, units, collisions: [], overruns: [], pushes: [], finished: false };
}

const copy = (run: MoveRun): MoveRun => ({
  ...run,
  units: run.units.map((unit) => ({ ...unit })),
  collisions: run.collisions.map((collision) => ({ ...collision })),
  overruns: [...run.overruns],
  pushes: run.pushes.map((push) => ({ ...push })),
});

/** What the run waits for: a collision to roll, a push to make (one hex), the next step, or nothing (finished) */
export function runWaitsFor(run: MoveRun): "collision" | "push" | "step" | null {
  if (run.finished) return null;
  if (run.pushes.length > 0) return "push";
  if (run.collisions.some((collision) => !collision.resolved)) return "collision";
  return "step";
}

/**
 * Every unit still moving takes its next hex at once. Enemies that meet collide and stop:
 * stepping into each other's hex (each stays on its own), into the same hex (both go in), or
 * into an enemy's hex that it doesn't leave (it goes in). Armour with Armor Forward goes through
 * infantry that stays put, on the way. Units of one side never hold each other up. When nobody
 * moves any more, units of one side left on one hex are sorted out and the run is finished
 */
export function takeStep(previous: MoveRun): MoveRun {
  if (runWaitsFor(previous) !== "step") return previous;
  const run = copy(previous);
  const { units } = run;
  const live = units.filter((unit) => !unit.gone);
  const stepping = live.filter((unit) => unit.moving);
  if (stepping.length === 0) {
    settleSharedHexes(run);
    run.finished = true;
    return run;
  }
  const step = ++run.step;
  const index = (unit: RunUnit) => units.indexOf(unit);
  const next = new Map(stepping.map((unit) => [unit, unit.path[unit.at! + 1]!]));
  const halt = (unit: RunUnit) => {
    unit.moving = false;
    unit.collided = true;
  };
  const enter = (unit: RunUnit, hex: Position) => {
    unit.at = unit.at! + 1;
    unit.position = { ...hex };
    unit.arrived = step;
    if (unit.at === unit.path.length - 1) unit.reachedEnd = true;
  };

  // Enemies stepping into each other's hex: each stays on its own
  for (const a of stepping) {
    for (const b of stepping) {
      if (a.side >= b.side || !a.moving || !b.moving) continue;
      if (samePosition(next.get(a)!, b.position) && samePosition(next.get(b)!, a.position)) {
        run.collisions.push({ step, kind: "crossing", hex: null, units: [index(a), index(b)], priority: null, resolved: false });
        halt(a);
        halt(b);
      }
    }
  }

  // Enemies stepping into the same hex: both go in, and neither was there first
  for (const a of stepping) {
    for (const b of stepping) {
      if (a.side >= b.side || !a.moving || !b.moving || !samePosition(next.get(a)!, next.get(b)!)) continue;
      const hex = next.get(a)!;
      run.collisions.push({ step, kind: "same-hex", hex: { ...hex }, units: [index(a), index(b)], priority: null, resolved: false });
      enter(a, hex);
      enter(b, hex);
      halt(a);
      halt(b);
    }
  }

  // A hex held by an enemy that stays there: the unit goes in and collides with it (the enemy
  // was there first). A unit stopping there may in turn be in another's way: go round until
  // nothing changes
  for (let changed = true; changed; ) {
    changed = false;
    for (const unit of stepping) {
      if (!unit.moving) continue;
      const target = next.get(unit)!;
      const held = live.find((other) => other.side !== unit.side && !other.moving && samePosition(other.position, target));
      if (!held) continue;
      // Armor Forward goes through infantry that stays put, on the way (not to end there)
      const onTheWay = unit.at! + 1 < unit.path.length - 1;
      if (unit.throughInfantry && held.infantry && onTheWay) {
        if (!run.overruns.some((each) => each.armour === index(unit) && samePosition(each.hex, target))) {
          run.overruns.push({ step, hex: { ...target }, armour: index(unit), infantry: index(held) });
        }
        continue;
      }
      run.collisions.push({ step, kind: "standing", hex: { ...target }, units: [index(unit), index(held)], priority: 1, resolved: false });
      enter(unit, target);
      halt(unit);
      held.collided = true;
      changed = true;
    }
  }

  // The rest step on
  for (const unit of stepping) {
    if (!unit.moving) continue;
    enter(unit, next.get(unit)!);
    if (unit.reachedEnd) unit.moving = false;
  }
  return run;
}

/**
 * The collision has been rolled and its hits dealt: `flags` is each unit's flags taken (every
 * one a hex to retreat, house rule) and `gone` whether it was destroyed. A unit with flags is
 * pushed out that many hexes. With no flag on either, the unit that wasn't there first goes back
 * a hex (both, when they got there at once); in a crossing nobody gained a hex, so nobody moves.
 * A unit already destroyed or pushed away doesn't count: the other one holds
 */
export function resolveCollision(
  previous: MoveRun,
  collisionIndex: number,
  outcome: { flags: readonly [number, number]; gone: readonly [boolean, boolean] }
): MoveRun {
  const collision = previous.collisions[collisionIndex];
  if (!collision || collision.resolved) return previous;
  const run = copy(previous);
  const resolved = run.collisions[collisionIndex]!;
  resolved.resolved = true;
  const pair = resolved.units.map((i) => run.units[i]!) as [RunUnit, RunUnit];
  pair.forEach((unit, i) => {
    if (outcome.gone[i]) {
      unit.gone = true;
      unit.moving = false;
    }
  });
  // Still facing each other: both on the map, and on the hex fought over (or their own, in a crossing)
  const here = (unit: RunUnit) => !unit.gone && (resolved.hex === null || samePosition(unit.position, resolved.hex));
  if (!pair.every(here)) return run;

  const pushed: Push[] = [];
  pair.forEach((_, i) => {
    const flags = outcome.flags[i] ?? 0;
    if (flags > 0) pushed.push({ unit: resolved.units[i]!, hexes: flags, enemy: { ...pair[1 - i]!.position } });
  });
  if (pushed.length === 0 && resolved.kind !== "crossing") {
    pair.forEach((_, i) => {
      if (resolved.priority !== i) pushed.push({ unit: resolved.units[i]!, hexes: 1, enemy: { ...pair[1 - i]!.position } });
    });
  }
  run.pushes.push(...pushed);
  return run;
}

/** Where a unit can stand: on the map and passable, with no unit of either side on it */
const isFree = (run: MoveRun, passable: Passable, position: Position) =>
  passable(position) && !run.units.some((unit) => !unit.gone && samePosition(unit.position, position));

/**
 * The next push and where it can go: back the way the unit came, when that hex is free
 * (`back`); otherwise the free hexes next to it that aren't nearer the enemy it met, for its
 * player to pick (`options`). Neither, and it can't retreat: it takes a hit instead (`pushBlocked`)
 */
export function nextPush(run: MoveRun, passable: Passable): { push: Push; back: Position | null; options: Position[] } | null {
  const push = run.pushes[0];
  if (!push) return null;
  const unit = run.units[push.unit]!;
  const behind = unit.at !== null && unit.at > 0 ? unit.path[unit.at - 1]! : null;
  if (behind && isFree(run, passable, behind)) return { push, back: behind, options: [] };
  const from = hexDistance(unit.position, push.enemy);
  const options = new Hex(unit.position)
    .getNeighbors()
    .filter((hex) => isFree(run, passable, hex) && hexDistance(hex, push.enemy) >= from);
  return { push, back: null, options };
}

/** The unit being pushed goes one hex: back the way it came, or to the hex its player picked */
export function pushTo(previous: MoveRun, passable: Passable, to: Position): MoveRun {
  const next = nextPush(previous, passable);
  if (!next) return previous;
  const allowed = next.back ? [next.back] : next.options;
  if (!includesPosition(allowed, to)) return previous;
  const run = copy(previous);
  const push = run.pushes[0]!;
  const unit = run.units[push.unit]!;
  if (next.back && unit.at !== null) unit.at -= 1;
  else {
    if (unit.at !== null) unit.leftAt = unit.at;
    unit.at = null;
    unit.offPath.push({ ...to });
  }
  unit.position = { ...to };
  unit.moving = false;
  finishHex(run);
  return run;
}

/** The unit being pushed has nowhere to go this hex: it stays, and takes a hit for it (the match deals it) */
export function pushBlocked(previous: MoveRun, passable: Passable): MoveRun {
  const next = nextPush(previous, passable);
  if (!next || next.back || next.options.length > 0) return previous;
  const run = copy(previous);
  run.units[run.pushes[0]!.unit]!.moving = false;
  finishHex(run);
  return run;
}

/** A hex of the first push is done: one less to go */
function finishHex(run: MoveRun) {
  const push = run.pushes[0]!;
  push.hexes--;
  if (push.hexes <= 0 || run.units[push.unit]!.gone) run.pushes.shift();
}

/** The unit was destroyed while being pushed (a hit it took for a hex it couldn't retreat) */
export function unitGone(previous: MoveRun, unitIndex: number): MoveRun {
  const run = copy(previous);
  const unit = run.units[unitIndex];
  if (!unit) return previous;
  unit.gone = true;
  unit.moving = false;
  run.pushes = run.pushes.filter((push) => push.unit !== unitIndex);
  return run;
}

/**
 * Units of one side that end on one hex (one stopped short there by a collision): the one that
 * got there last (on a tie, the later order) goes back along its path to the nearest hex nobody
 * is on, or one hex back to sort out from there
 */
function settleSharedHexes(run: MoveRun) {
  const live = () => run.units.filter((unit) => !unit.gone);
  const latest = (a: RunUnit, b: RunUnit) => b.arrived - a.arrived || (b.order ?? -1) - (a.order ?? -1);
  for (let guard = 0; guard < 100; guard++) {
    const all = live();
    const shared = all.find((unit) => all.some((other) => other !== unit && samePosition(other.position, unit.position)));
    if (!shared) return;
    const back = all
      .filter((unit) => unit.at !== null && unit.at > 0 && samePosition(unit.position, shared.position))
      .sort(latest)[0];
    if (!back) return;
    const taken = (position: Position) => all.some((other) => other !== back && samePosition(other.position, position));
    let to = back.at! - 1;
    while (to > 0 && taken(back.path[to]!)) to--;
    if (taken(back.path[to]!)) to = back.at! - 1;
    back.at = to;
    back.position = { ...back.path[to]! };
  }
}

/**
 * Where each unit ends once the run is finished, the hexes it went through to get there (its
 * path up to where it stopped, or up to where it was pushed off it and then the hexes it was
 * pushed to), and whether it got to the end of its path at some point
 */
export const runEnds = (run: MoveRun) =>
  run.units.map((unit) => ({
    side: unit.side,
    order: unit.order,
    boardAt: unit.boardAt,
    end: unit.position,
    path: unit.at !== null ? unit.path.slice(0, unit.at + 1) : [...unit.path.slice(0, (unit.leftAt ?? 0) + 1), ...unit.offPath],
    gone: unit.gone,
    reachedEnd: unit.reachedEnd,
  }));
