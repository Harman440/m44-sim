// Values are stored in saves: append new phases, don't reorder
export enum TurnPhase {
  PICK_CARDS,
  ORDER_UNITS,
  BATTLE,
  /** The defender waits while the attacker plays the extra first turn */
  AWAIT_ATTACKER,
  /** Orders are shown to the opponent and carried out on the table */
  MOVEMENT,
  /** Fase final: retreats, then drawing a command card */
  END_OF_TURN,
  /** Before the first turn: place the paratroopers that landed on the table (Scenario.paradrop) */
  PARADROP,
}
