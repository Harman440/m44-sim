// game-core/coins.ts
// The coins a turn earns and spends, worked out from the turn's orders, shots
// and choices, so undoing an order or a shot gives its coins back. The numbers
// are in data/coinRules.ts; which supply faces earn a coin in data/hitRules.ts.
import Order from "./order";
import { UnitType } from "./unit";
import { appliedFaces, readRoll } from "./rollResult";
import { END_OF_TURN_COINS } from "../data/coinRules";
import type { Shot } from "./gameSession";
import type { CombatCard } from "./combatCard";

/** Final phase: 2 coins, or a combat card from the combat deck */
export type RewardChoice = "coins" | "combatCard";

export const isRewardChoice = (value: unknown): value is RewardChoice => value === "coins" || value === "combatCard";

/** One line of the coin ledger: positive earns, negative spends */
export type CoinEntry =
  | { kind: "extraOrder" | "cardOrder"; amount: number; unit: UnitType }
  | { kind: "supplies"; amount: number; unit: UnitType }
  | { kind: "endOfTurn" | "cardReward"; amount: number }
  | { kind: "combatCard"; amount: number; card: string }
  | { kind: "adjustment"; amount: number };

export interface TurnCoinsState {
  orders: readonly Order[];
  /** Combat cards played this turn, paid when played */
  combatCards: readonly CombatCard[];
  shots: readonly Shot[];
  /** Coins added or taken by hand (to match the table) */
  adjustments: readonly number[];
  reward: RewardChoice | null;
  /** Coins the played card gives in the final phase instead of the choice (Preparations); 0 before then */
  cardReward: number;
  /** The attacker's extra first turn: supply faces earn coins, but there is no final-phase reward */
  extraTurn: boolean;
}

/** This turn's ledger: combat cards and orders paid, supply faces rolled, the final phase's coins and changes by hand */
export function turnCoins({
  orders,
  combatCards,
  shots,
  adjustments,
  reward,
  cardReward,
  extraTurn,
}: TurnCoinsState): CoinEntry[] {
  const entries: CoinEntry[] = [];
  combatCards.forEach((card) => entries.push({ kind: "combatCard", amount: -card.cost, card: card.name }));
  orders.forEach((order) => {
    if (order.cost > 0) {
      entries.push({ kind: order.extra ? "extraOrder" : "cardOrder", amount: -order.cost, unit: order.unit.getUnitType() });
    }
  });
  // Supply faces earn coins in every turn, the attacker's extra first turn included
  shots.forEach((shot) => {
    const coins = readRoll(appliedFaces(shot.faces, shot.kept), shot.target).coins;
    if (coins > 0) entries.push({ kind: "supplies", amount: coins, unit: orders[shot.orderIndex]!.unit.getUnitType() });
  });
  // The extra first turn has no final-phase reward (nor Preparations' coins)
  if (!extraTurn) {
    if (reward === "coins") entries.push({ kind: "endOfTurn", amount: END_OF_TURN_COINS });
    if (cardReward > 0) entries.push({ kind: "cardReward", amount: cardReward });
  }
  adjustments.forEach((amount) => entries.push({ kind: "adjustment", amount }));
  return entries;
}

export const sumCoins = (entries: readonly CoinEntry[]) => entries.reduce((sum, entry) => sum + entry.amount, 0);
