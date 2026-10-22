// game-core/coins.ts
// The coins (supplies, in the UI) a turn earns and spends, worked out from the turn's card and
// shots, so undoing a shot gives its coins back. Which supply faces earn a coin is in
// data/hitRules.ts.
import Order from "./order";
import { UnitType } from "./unit";
import { appliedFaces, readRoll } from "./rollResult";
import type { Shot, StandingCollisionRoll } from "./gameSession";
import type { Localized } from "../i18n/lang";

/** One line of the coin ledger: positive earns, negative spends */
export type CoinEntry =
  | { kind: "supplies"; amount: number; unit: UnitType }
  | { kind: "card"; amount: number; card: Localized }
  | { kind: "adjustment"; amount: number };

export interface TurnCoinsState {
  /** The command card played this turn, paid when played, at the side's cost */
  card: { name: Localized; cost: number } | null;
  orders: readonly Order[];
  shots: readonly Shot[];
  /** Pass and play: collision rolls of units without an order, whose supply faces earn coins too */
  standingCollisions?: readonly StandingCollisionRoll[];
  /** Coins added or taken by hand (to match the table) */
  adjustments: readonly number[];
}

/** This turn's ledger: the card paid, supply faces rolled and changes by hand */
export function turnCoins({ card, orders, shots, standingCollisions = [], adjustments }: TurnCoinsState): CoinEntry[] {
  const entries: CoinEntry[] = [];
  if (card && card.cost > 0) entries.push({ kind: "card", amount: -card.cost, card: card.name });
  // Supply faces earn coins in every turn, the attacker's extra first turn included
  shots.forEach((shot) => {
    const coins = readRoll(appliedFaces(shot.faces, shot.kept), shot.target).coins;
    if (coins > 0) entries.push({ kind: "supplies", amount: coins, unit: orders[shot.orderIndex]!.unit.getUnitType() });
  });
  standingCollisions.forEach((roll) => {
    const coins = readRoll(appliedFaces(roll.faces, roll.kept), roll.target).coins;
    if (coins > 0) entries.push({ kind: "supplies", amount: coins, unit: roll.unitType });
  });
  adjustments.forEach((amount) => entries.push({ kind: "adjustment", amount }));
  return entries;
}

export const sumCoins = (entries: readonly CoinEntry[]) => entries.reduce((sum, entry) => sum + entry.amount, 0);
