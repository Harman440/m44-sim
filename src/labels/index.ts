// labels/index.ts
// UI text for game enums and game objects, one set per language (code
// identifiers stay in English). Screens get theirs with `useLabels()`; code
// outside React picks one with `LABELS[lang]`, or builds a text in every
// language with `byLang`.
import type Hex from "../game-core/hex";
import type Unit from "../game-core/unit";
import type { UnitType } from "../game-core/unit";
import type { DieFace } from "../game-core/dice";
import type { HexType, Side } from "../types/hex";
import type { Faction } from "../types/faction";
import type { ShotTarget } from "../data/hitRules";
import type { RollResult } from "../game-core/rollResult";
import type { MoveLimits } from "../game-core/orderRules";
import type { ActionRefusal } from "../game-core/actionRules";
import type { SupplyCost, UnitSupplies } from "../game-core/unitSupplies";
import type { Equipment, Supply } from "../data/unitSupplies";
import type { CoinEntry } from "../game-core/coins";
import type { DeckReason, MarkerRule } from "../game-core/combatCard";
import type { Lang } from "../i18n/lang";
import es from "./es";
import en from "./en";

export interface Labels {
  factions: Record<Faction, string>;
  units: Record<UnitType, string>;
  terrain: Record<HexType, string>;
  sections: Record<Side, string>;
  /** Section names short enough for a row of the fire order */
  sectionsShort: Record<Side, string>;
  dieFaces: Record<DieFace, string>;
  /** Why a side gets a combat card: a short name for the group */
  deckReasons: Record<DeckReason, string>;
  /** What a shot's target is: infantry, or any other unit (the tank face hits both armour and artillery) */
  target: (infantry: boolean) => string;
  /** "forest, center": where a hex is, without its unit */
  describePlace: (hex: Hex | null) => string;
  /** "Infantry", or "Elite infantry" for a unit with the scenario's badge */
  unit: (unit: Unit) => string;
  /** The same from a unit's type and badge, for summaries and the turn log, which keep no unit objects */
  unitKind: (type: UnitType, elite?: boolean) => string;
  /** "Tank in forest", or just the terrain for an empty hex; "… with barbed wire" on barbed wire */
  describeHex: (hex: Hex) => string;
  /** How far a unit moves with its order, and whether it can still fire */
  describeMovement: (limits: MoveLimits) => string;
  /** A unit's supplies: morale, energy, ammo, fuel, shells */
  supplies: Record<Supply, string>;
  /** The equipment infantry carries */
  equipment: Record<Equipment, string>;
  /** "Morale 5 · Energy 3 · Ammo 2 · Explosives 1…": what a unit has left */
  describeSupplies: (supplies: UnitSupplies) => string;
  /** "2 energy + sandbags", or "free": what an action costs */
  describeCost: (cost: SupplyCost) => string;
  /** Why a unit can't be given an action, in a few words ("No energy", "Morale 0") */
  actionRefusals: Record<ActionRefusal, string>;
  /** "2 × Infantry · 1 × Grenade", or "no effect" when no dice were rolled */
  describeFaces: (faces: readonly DieFace[]) => string;
  /** The results a shot applies, and how many of the dice rolled they are when some were set aside */
  describeAppliedFaces: (faces: readonly DieFace[], kept: readonly number[] | null) => string;
  /** "Against infantry · close assault" */
  describeTarget: (target: ShotTarget) => string;
  /** "2 hits · 1 retreat · +1 supply"; coins are left out when the turn earns none */
  describeRoll: (roll: RollResult, withCoins?: boolean) => string;
  /** "1 supply", "3 supplies" */
  coins: (n: number) => string;
  /** "1 hex", "3 hexes" */
  hexes: (n: number) => string;
  /** What a line of the coin ledger was for */
  describeCoinEntry: (entry: CoinEntry) => string;
  /** What to mark on the map for a combat card */
  describeMarkerRule: (rule: MarkerRule) => string;
}

export const LABELS: Record<Lang, Labels> = { es, en };

/** "+2" or "−4": a signed number of coins */
export const signedCoins = (amount: number): string => (amount < 0 ? `−${-amount}` : `+${amount}`);
