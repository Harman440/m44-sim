// Values are stored in saves: append new phases, don't reorder
export enum TurnPhase {
  PICK_CARDS,
  ORDER_UNITS,
  BATTLE,
  /** The defender waits while the attacker plays the extra first turn */
  AWAIT_ATTACKER,
}
