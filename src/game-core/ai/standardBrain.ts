// game-core/ai/standardBrain.ts
// The computer player the app uses: like the basic one, but it weighs each
// hex by the shots it gives against the fire it draws (terrain cover counts)
// and fires where it can destroy or weaken most. It plays no card yet.
import { AiView, Brain, MoveChoice } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { bestShotFrom, nearestEnemy, shotValue, threatAt, top, unitWorth } from "./scoring";
import { includesPosition, positionKey, samePosition } from "../position";
import { turnedRound } from "../BoardManager";
import { hexDistance } from "../fireTargets";
import { UnitType } from "../unit";
import { Position } from "../../types/scenario";

export { shotValue, threatAt };

/** How a standard brain weighs a hex to move to, against the shot it gives there */
export interface BrainWeights {
  /** The fire the hex draws */
  threat: number;
  /** Each hex from the nearest enemy, for a unit with no shot from the hex (one with a shot keeps it) */
  approach: number;
  /** Standing on one of its side's objective hexes: a medal while it holds it */
  ownObjective: number;
  /** Standing on one of the enemy's: the enemy can't hold it */
  enemyObjective: number;
  /** Each hex from the nearest objective hex (its side's or the enemy's) */
  objectiveApproach: number;
}

/** The weights the computer played with first: it kept its figures well, but seldom won a game */
export const CAUTIOUS_WEIGHTS: BrainWeights = {
  threat: 2,
  approach: 0.15,
  ownObjective: 0.6,
  enemyObjective: 0.3,
  objectiveApproach: 0,
};

/** The hex in the Allies' view, as objectives are */
const inAlliesView = (view: AiView, position: Position) => (view.side === "Axis" ? turnedRound(position, view.session.board.size) : position);

/** What ending a move on this hex is worth for the scenario's objectives */
function objectiveWorth(view: AiView, position: Position, weights: BrainWeights): number {
  const objectives = view.session.scenario.victory?.objectives ?? [];
  if (objectives.length === 0) return 0;
  const hex = inAlliesView(view, position);
  const on = objectives.reduce((sum, objective) => {
    if (!includesPosition(objective.hexes, hex)) return sum;
    return sum + (objective.faction === view.side ? weights.ownObjective : weights.enemyObjective);
  }, 0);
  const nearest = Math.min(...objectives.flatMap((objective) => objective.hexes.map((h) => hexDistance(h, hex))));
  return on - weights.objectiveApproach * nearest;
}

/** A standard brain moving its units with these weights */
export function makeStandardBrain(weights: BrainWeights): Brain {
  const brain: Brain = {
    ...basicBrain,

    // The unit with the most to gain goes first
    nextToOrder: (view, orderable) => top(orderable, (position) => unitWorth(view, position), view.random),

    moveFor(view, from): MoveChoice {
      const { session, enemies, random } = view;
      const options = session.getMoveOptions(from);
      const unitType = session.board.getHex(from)?.unit?.getUnitType();
      if (!options || !unitType || enemies.length === 0) return { to: from };

      const taken = new Set(enemies.map((enemy) => positionKey(enemy.position)));
      const canFire = new Set(options.moveAndFire.map(positionKey));
      const holdFires = options.limits.holdShots > 0;
      const figures = Math.max(1, session.figuresAt(from) ?? 1);
      const score = (position: Position) => {
        const holds = samePosition(position, from);
        const fires = holds ? holdFires : canFire.has(positionKey(position));
        const offence = fires ? bestShotFrom(view, unitType, position) : 0;
        return (
          offence -
          weights.threat * threatAt(view, unitType, position, figures) -
          (offence > 0 ? 0 : weights.approach * nearestEnemy(enemies, position)) +
          objectiveWorth(view, position, weights)
        );
      };
      const candidates = [from, ...options.moves.filter((position) => !taken.has(positionKey(position)))];
      return { to: top(candidates, score, random) ?? from };
    },

    shotFor(view, fireable) {
      const { session } = view;
      const shots = fireable.flatMap((order) =>
        session
          .fireTargetsFor(order)
          .filter((target) => target.lineOfSight && target.dice > 0)
          .flatMap((target) => {
            const enemy = view.enemies.find((e) => samePosition(e.position, target.position));
            return enemy
              ? [
                  {
                    order,
                    position: target.position,
                    value: shotValue(target.dice, enemy),
                  },
                ]
              : [];
          }),
      );
      const best = top(shots, (shot) => shot.value, view.random);
      if (!best) return { order: fireable[0]!, targets: [] };
      // The other targets of the same unit, in case the first can't be fired at after all
      const others = shots
        .filter((shot) => shot.order === best.order && !samePosition(shot.position, best.position))
        .sort((a, b) => b.value - a.value)
        .map((shot) => shot.position);
      return { order: best.order, targets: [best.position, ...others] };
    },

    retreatTo(view, from, options) {
      const unitType = view.session.board.getHex(from)?.unit?.getUnitType() ?? UnitType.INFANTRY;
      const figures = Math.max(1, view.session.figuresAt(from) ?? 1);
      return top(options, (position) => -threatAt(view, unitType, position, figures), view.random) ?? options[0]!;
    },
  };
  return brain;
}

/**
 * The weights the computer plays with (2026-10-19): it fears the enemy's fire a quarter as much,
 * closes in faster and makes for the objectives. Against the cautious weights it won far more
 * games than it lost (duel.test.ts, AI_TUNE)
 */
export const STANDARD_WEIGHTS: BrainWeights = { ...CAUTIOUS_WEIGHTS, threat: 0.5, approach: 0.35, objectiveApproach: 0.15 };

export const standardBrain = makeStandardBrain(STANDARD_WEIGHTS);
