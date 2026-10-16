# Pass and play: plan

**Finished** (PP1–PP7 are built). What's still open is in [../PASS_AND_PLAY_NEXT.md](../PASS_AND_PLAY_NEXT.md). Later changes to pass and play (the card rebalance, pinned units, limited damage dropped automatically, units of one side passing through each other) are in [PLAN-part2.md](PLAN-part2.md) and the commits after it.

A second way to play: both players on **one device**, passing it between them, with **everything played in the app**: no physical board. It lives beside the current mode (one tablet per side, next to the table), which stays as it is.

Work through it one step at a time, as in [PLAN.md](../PLAN.md), and tick items off when they're done. Items marked **Decide** need an answer from the player first. The turn follows the simultaneous rules in [house-rules.md](../house-rules.md).

## What changes from the companion mode

The companion mode rests on two decisions (see [PLAN.md](../PLAN.md), "Where we are") that this mode reverses:
- **One shared map with both armies.** The app knows every unit, so it works out line of sight, the enemy's sandbags, targets and terrain itself, and applies casualties and retreats. No "Actualizar mapa", no questions about the table.
- **Figures per unit.** The app has to apply hits, so units have figures again. **Decided** (not the official counts): infantry 7 figures (7 hits); armour 3 figures, each taking 2 hits (6 hits); artillery 3 pieces (3 hits), then its crew stays as an infantry unit of 1 figure, destroyed by one more hit. The limited-damage rule is applied by the app: a unit keeps at most as many results as it has figures (armour at most 3, infantry down to 2 figures at most 2); cards with bonus dice keep one more.

What stays hidden: each player's hand, the cards they pick and the orders they give. A cover screen ("Pasa el dispositivo a …", tap to continue) goes up between the two players whenever the device changes hands.

## The turn

1. **Cards and orders, in secret.** Player 1 picks a command card (and an order combat card), gives orders and marks hexes, then confirms. Cover screen. Player 2 does the same. Cover screen.
2. **Reveal.** Both players see the two cards played and both sets of orders on the map.
3. **Movement.** The app moves every ordered unit at once, one hex at a time: every unit takes its first step, then its second, and so on. Two units that pass through or land on the same hex collide: close assault dice minus 1, terrain ignored, retreats can't be ignored; the winner stays and may carry on, and with no retreat both step back one hex along their path (house rules, "Movement phase").
4. **Battle.** Units that didn't move fire first, then moved units; within each group the players alternate, the attacker first. The player whose turn it is taps a unit and a target; the app rolls and applies hits at once. Retreats are marked and carried out at the end of the battle, except when a close assault takes ground. Each player may play one battle combat card.
5. **Final phase.** Each player, in turn behind the cover screen, draws their command card and takes their reward (2 supplies or a combat card).

The attacker's extra first turn is played by the attacker alone (no cover screen needed).

## Steps

### PP1: The mode and the match
- [x] "Pasar y jugar" / "Pass and play" in the menu: pick a scenario, no side to choose
- [x] `game-core/passAndPlay.ts`: `PassAndPlayMatch` holds one `GameSession` per side (hand, decks, coins, orders), so the one-side rules are reused, plus who holds the device (`active`) and the cover screen (`covered`); `pass()` and `uncover()`
- [x] `MatchView`: the cover screen ("Turno del Eje", "Juego con el Eje: mostrar"), then the side's `GameView` with a "Pasar" button in the header. For now each side still plays its whole one-side turn, passing by hand; PP2 makes the handover automatic
- [x] Save and resume the match (`m44-sim:saved-match`, beside the one-side save; a new game of either kind replaces the other). A match resumes behind the cover screen


### PP2: Hidden turns
- [x] The cover screen between the players, saying whose turn it is
- [x] Cards and orders for each side in turn, in the one-side screens. Locking the orders hands the device to the other side when it hasn't given its own (even if it's still finishing the last turn); the defender joins in at turn 2 as soon as the attacker's extra turn ends, and "Pasar" is off during that turn
- [x] Both armies on every map of the game screen (`OpponentContext`, `Board`'s `opponent`): the other army turned round onto this side's view, at the hexes its orders started from while they're secret (orders move units on their side's board as they're given), and its orders, in its colour, once revealed (`PassAndPlayMatch.opponentOf`)
- [x] The reveal (`RevealView`): once both sides have locked their orders, both cards and both armies' orders on one map; "Seguir" gives the device to the attacker for movement, battle and the final phase, still each side in its own screens, passing by hand, until PP3 and PP4
- [x] The shared board for the rules: targets and line of sight know both armies (PP4b)

### PP3: Movement
- [x] **Decided:** units move step by step, all together: every unit's first hex, then the second, … A collision is two units in the same hex after a step, or two units swapping hexes in the same step
- [x] **Decided:** a unit may be ordered into or through a hex where an enemy stands: stepping into it is a collision too. Both units roll at once (close assault dice minus 1, terrain ignored); the collision is the unit's shot for the turn; the winner always stops where it is
- [x] `game-core/simultaneousMove.ts`: `moveSimultaneously` carries out every move in the Allies' view, one step at a time: enemies stepping into the same hex (`same-hex`), into each other's hex (`crossing`) or into the hex of an enemy that stays there (`standing`) stop and collide, short of the hex; a unit whose next hex holds one of its own that stays there waits behind it (of two wanting the same hex, the earlier order goes)
- [x] `GameSession.haltOrders` cuts the orders short where the units stopped (the wire a tank didn't reach goes back, a unit that never left keeps its sandbags); `rollCollision` rolls a unit's collision: an ordered unit's is its shot, an unordered unit's is kept apart (`standingCollisions`, its supplies count), also while the defender waits out the extra turn. `SAVE_VERSION` 29
- [x] `PassAndPlayMatch.moveUnits` and `rollCollision`, saved in `SavedMatch.movement` (`MATCH_SAVE_VERSION` 3). The extra first turn is revealed and carried out too, the attacker's orders alone, as its moves can run into the defender's units
- [x] The reveal screen: "Mover las unidades", then the map as it stands with each collision numbered on it, and per collision "Tirar los dados" for both units (`ShotDice`); "Seguir" once all are rolled
- [x] The collision's hits and flags are applied by the app (PP4a)
- [x] The one-side screens after the reveal still speak of the table (Movimiento's instructions, the battle's "¿Ha habido un choque?"): done in PP7

### PP4: Battle
- [x] **Decided:** a retreat is carried out at once only after a close assault where the attacker takes ground (the attacker asks, the owner picks the hexes); otherwise the unit is marked and retreats after all the battles. Flags add up, and a unit marked to retreat can't battle any more this turn. A unit whose order doesn't let it fire (infantry moving 2, into a forest…) doesn't roll in a collision either, wherever it stopped. The battle is one shared screen, each side's combat cards behind its own button. A retreat is 1 hex per flag toward the unit's own edge, picked by its owner, and a figure is lost for each hex it can't retreat
- [x] PP4a: figures per unit (`data/figures.ts`: infantry 7, armour 3 of 2 hits each, artillery 3 then a 1-figure infantry crew), kept by each side's session in pass and play (`GameSession.figures`, `sufferHits`, `figuresAt`, `isRetreating`; hits kept from turn to turn, flags for the turn, saved), shown on the tokens with a flag badge for a unit marked to retreat. A marked unit has no shot left (`summarizeOrders`' `retreating`). Collisions are dealt by the app (`PassAndPlayMatch.applyCollision`): both units' results at once, after the player picks the dice when a unit rolled more results than its figures (`keepCollisionResults`, limited damage, `resultLimit`)
- [x] PP4b: the shared battle (`SharedBattleView`, after the movement): `PassAndPlayMatch.fire`, `holdFire`, `keepShotResults`, `applyShot`, `endBattle`, saved in `SavedMatch.battle` (`MATCH_SAVE_VERSION` 4). The units that didn't move fire first, then the moved ones; in each group the attacker first and the sides alternate, a side with nothing left letting the other go on. Each side's session sees the enemy army (`GameSession.setEnemyView`): only enemy hexes are targets, enemy units block the view (`fireTargets`' `enemies`), and the target's type and sandbags are known (`FireDialog`'s `knownTarget`, no questions; no "Anular disparo", as the hits are dealt at once). Sandbags ignore 1 flag. Each side's combat cards are behind its own button ("Cartas de los Aliados"), with its coins
- [x] PP4c: retreats and taking ground. "Terminar la batalla" carries out the retreats: the attacker's marked units first, then the defender's, each hex tapped on the map by the unit's player among the two behind it toward its own edge that are free (`GameSession.retreatOptions`, `retreatTo`); with none, the unit loses a figure for that hex (`retreatBlocked`, done by the app). After a close assault that destroyed the enemy unit or marked it to retreat, armour (or infantry with Fragor del combate) is asked "¿Tomar terreno?" (`decideGround`): yes, the enemy unit retreats at once, its player picking the hexes, then the unit moves in and fires once more in close assault (`MatchBattle.bonus`); no, the enemy unit stays marked. A unit marked to retreat can't take ground
- [x] **Later** (done in PP6): the attack combat cards (Barrage, Air Power…), Ambush, Close Assault's marking and the cards that stop an enemy unit firing (Out of Ammo, Shell Shortage, Out of Fuel) aren't wired into the shared battle yet: they should be applied by the app instead of "Bloqueado por el rival"
- [ ] **Decide:** the order of the retreats after the battle (now: the attacker's units first, top of its view first), and whether a retreat may go through or onto a hex the units can't fire from (now: any free, passable hex behind)

### PP5: Winning
- [x] **Decided:** no winning for now: the game goes on until the players stop. Winning conditions depend on the scenario and come later
- [ ] **Later:** medals and objective hexes per scenario, and the end of the game with a summary (from [myNextPlan.md](../myNextPlan.md))

## Next steps
In order; the first ones finish what PP1–PP4 started.

### PP6: Combat cards in the shared battle
- [x] Attack cards (Barrage, Air Power, Air Bombardment): "Tirar en las casillas marcadas" rolls every marked hex before anyone fires (`PassAndPlayMatch.rollAttacks`), the hits and flags dealt to the enemy unit standing there now (retreats can't be ignored), the results in a dialog. The marks show on the battle map, whichever side played the card
- [x] Ambush: once played from the side's cards, "Disparar primero" opens `AmbushDialog` in shared mode (`onAmbush`, `knownTarget`, no undo): the unit attacked fires first at the adjacent enemy (`PassAndPlayMatch.ambush`), its hits dealt like a shot's (limited damage included)
- [x] Close Assault: the units next to an enemy are marked by the app as the battle starts (`markCloseAssaults`)
- [x] Out of Ammo, Shell Shortage, Out of Fuel: once played, the card's player taps the enemy unit on the map (ordered units that can still fire, of the card's types: `BLOCKING_CARDS`), which can't fire any more (`GameSession.blockUnit`). Out of Ammo then moves it to an empty hex of its baseline, its player tapping the hex (`relocate`, `GameSession.baselineHexes`, `moveUnitTo`); Out of Fuel sends it back to the hex it started from, if free. `MATCH_SAVE_VERSION` 6
- [ ] **Decide:** the cards are played whenever their player wants (Ambush meant for when an enemy is about to close-assault, the blocking cards for the unit about to fire); the app doesn't check the moment. The other battle cards (Not One Step Back, Camouflage, Pull Back, Medic, Personal Armor…) still only remind the players, as in the one-side game

### PP7: Polish
- [x] The one-side screens in pass and play stop speaking of the table (`OpponentContext` set means pass and play): Órdenes has no "Actualizar mapa" and its sandbags note leaves out the table; the final phase says the app did the retreats and casualties and keeps "Actualizar mapa" only for what a card says (Pull Back, Medic…), and the Reinforcements lines don't mention the table. Movimiento and the one-side battle aren't shown in pass and play (the reveal and the shared battle take their place)
- [x] A player's hand doesn't deal in again every time they get the device back (`MatchView` remembers the sides already dealt, `GameView`'s `handDealt`; a resumed match counts both as dealt)
- [x] The reveal's collisions fit the landscape column: one line per collision with what each unit dealt, the dice in a dialog that opens as they're rolled ("Ver dados"), where a unit with more results than figures picks them and "Aplicar" deals them; the collision rules behind an "i"
- [x] The rule book's pages for pass and play (`data/ruleBook.ts`, the "Pasar y jugar" group: everything in the app, figures, moving at once, the battle, retreats after the battle, combat cards on the map, no victory yet)
- [ ] Play a whole game on the tablet and note what feels wrong

## Later
- Fog of war, and playing against the computer (myNextPlan.md)
