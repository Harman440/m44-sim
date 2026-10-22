// game-core/actionCard.ts
// The actions mode's command cards: a side holds them all from the start, may play one a turn
// if it can pay for it, and then waits out its cooldown. The scenario says which ones a side
// has (air, big guns) and can make some cheaper (`Scenario.cardCosts`). The cards are in
// data/actionCards.ts.
import type { UnitType } from "./unit";
import type { AttackEffect, MarkerRule } from "./combatCard";
import type { Faction } from "../types/faction";
import type { Scenario } from "../types/scenario";
import type { Localized } from "../i18n/lang";
import { ACTION_CARDS, CARD_COOLDOWN_TURNS } from "../data/actionCards";
import { airSortiesOf, hasBigGuns } from "../data/scenarioRules";

/** What a card does */
export type ActionCardEffect =
  /** Every unit of the side fires with this many extra dice on every shot this turn (Finest Hour) */
  | { kind: "extraDice"; dice: number }
  /** All the side's infantry gets its equipment back and its morale and ammo back to full (Resupply) */
  | { kind: "resupply" }
  /** The side's armour and artillery get their fuel back to full (Refuel) */
  | { kind: "refuel" }
  /** Attacks the marked hexes in the battle (Air Bombardment, Barrage, Air Power) */
  | AttackEffect
  /** A unit of this type arrives on the cross as the final phase starts (Reinforcements) */
  | { kind: "reinforcements"; unitType: UnitType };

export interface ActionCard {
  readonly id: string;
  readonly name: Localized;
  readonly description: Localized;
  /** The card painting: a file in src/assets/cards, by its name without `.webp` */
  readonly painting: string;
  /** Supplies to play it, unless the scenario makes it cheaper for the side */
  readonly cost: number;
  /** Only for a side the scenario gives air sorties, or big guns */
  readonly needs?: "air" | "bigGuns";
  /** Hexes to mark on the map while giving orders */
  readonly marker?: MarkerRule;
  readonly effect: ActionCardEffect;
}

/** A card a side holds in a scenario, at the side's cost */
export interface HeldCard {
  readonly card: ActionCard;
  readonly cost: number;
}

const sideKey = (faction: Faction) => (faction === "Axis" ? "axis" : "allies");

/** Whether the scenario gives the side this card */
export function sideHasCard(scenario: Scenario, faction: Faction, card: ActionCard): boolean {
  if (card.needs === "air") return airSortiesOf(scenario, faction) > 0;
  if (card.needs === "bigGuns") return hasBigGuns(scenario, faction);
  return true;
}

/** What the card costs the side: the scenario's price for it, or the card's own */
export const cardCost = (scenario: Scenario, faction: Faction, card: ActionCard): number =>
  scenario.cardCosts?.[sideKey(faction)][card.id] ?? card.cost;

/** The cards a side holds in a scenario, with their cost to it */
export const cardsOf = (scenario: Scenario, faction: Faction): HeldCard[] =>
  ACTION_CARDS.filter((card) => sideHasCard(scenario, faction, card)).map((card) => ({
    card,
    cost: cardCost(scenario, faction, card),
  }));

/** Turns before a card played on turn `playedOn` can be played again; 0 when it's ready (or was never played) */
export const turnsLeft = (playedOn: number | undefined, turn: number): number =>
  playedOn === undefined ? 0 : Math.max(0, playedOn + CARD_COOLDOWN_TURNS - turn);

export const isReady = (playedOn: number | undefined, turn: number): boolean => turnsLeft(playedOn, turn) === 0;
