# Pass and play: plan

A second way to play: both players on **one device**, passing it between them, with **everything played in the app**: no physical board. It lives beside the current mode (one tablet per side, next to the table), which stays as it is.

Work through it one step at a time, as in [PLAN.md](PLAN.md), and tick items off when they're done. Items marked **Decide** need an answer from the player first. The turn follows the simultaneous rules in [house-rules.md](house-rules.md).

## What changes from the companion mode

The companion mode rests on two decisions (see PLAN.md) that this mode reverses:
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
- [ ] The shared board for the rules: line of sight and targets still only know this side's units (PP4)

### PP3: Movement
- [x] **Decided:** units move step by step, all together: every unit's first hex, then the second, … A collision is two units in the same hex after a step, or two units swapping hexes in the same step
- [x] **Decided:** a unit may be ordered into or through a hex where an enemy stands: stepping into it is a collision too. Both units roll at once (close assault dice minus 1, terrain ignored); the collision is the unit's shot for the turn; the winner always stops where it is
- [x] `game-core/simultaneousMove.ts`: `moveSimultaneously` carries out every move in the Allies' view, one step at a time: enemies stepping into the same hex (`same-hex`), into each other's hex (`crossing`) or into the hex of an enemy that stays there (`standing`) stop and collide, short of the hex; a unit whose next hex holds one of its own that stays there waits behind it (of two wanting the same hex, the earlier order goes)
- [x] `GameSession.haltOrders` cuts the orders short where the units stopped (the wire a tank didn't reach goes back, a unit that never left keeps its sandbags); `rollCollision` rolls a unit's collision: an ordered unit's is its shot, an unordered unit's is kept apart (`standingCollisions`, its supplies count), also while the defender waits out the extra turn. `SAVE_VERSION` 29
- [x] `PassAndPlayMatch.moveUnits` and `rollCollision`, saved in `SavedMatch.movement` (`MATCH_SAVE_VERSION` 3). The extra first turn is revealed and carried out too, the attacker's orders alone, as its moves can run into the defender's units
- [x] The reveal screen: "Mover las unidades", then the map as it stands with each collision numbered on it, and per collision "Tirar los dados" for both units (`ShotDice`); "Seguir" once all are rolled
- [x] The collision's hits and flags are applied by the app (PP4a)
- [ ] The one-side screens after the reveal still speak of the table (Movimiento's instructions, the battle's "¿Ha habido un choque?")

### PP4: Battle
- [x] **Decided:** a retreat is carried out at once only after a close assault where the attacker takes ground (the attacker asks, the owner picks the hexes); otherwise the unit is marked and retreats after all the battles. Flags add up, and a unit marked to retreat can't battle any more this turn. A unit whose order doesn't let it fire (infantry moving 2, into a forest…) doesn't roll in a collision either, wherever it stopped. The battle is one shared screen, each side's combat cards behind its own button. A retreat is 1 hex per flag toward the unit's own edge, picked by its owner, and a figure is lost for each hex it can't retreat
- [x] PP4a: figures per unit (`data/figures.ts`: infantry 7, armour 3 of 2 hits each, artillery 3 then a 1-figure infantry crew), kept by each side's session in pass and play (`GameSession.figures`, `sufferHits`, `figuresAt`, `isRetreating`; hits kept from turn to turn, flags for the turn, saved), shown on the tokens with a flag badge for a unit marked to retreat. A marked unit has no shot left (`summarizeOrders`' `retreating`). Collisions are dealt by the app (`PassAndPlayMatch.applyCollision`): both units' results at once, after the player picks the dice when a unit rolled more results than its figures (`keepCollisionResults`, limited damage, `resultLimit`)
- [ ] Figures per unit, shown on the token; units lose figures and are removed when they reach 0 (PP4a; the battle's shots in PP4b)
- [ ] Firing order with alternating sides; the app picks the target kind, terrain, sandbags and line of sight from the map
- [ ] Hits, retreats (**Decided:** the owner picks the hex), taking ground
- [ ] Combat cards against the opponent applied by the app (Out of Ammo, Ambush, …) instead of "Bloqueado por el rival"

### PP5: Winning
- [x] **Decided:** no winning for now: the game goes on until the players stop. Winning conditions depend on the scenario and come later
- [ ] **Later:** medals and objective hexes per scenario, and the end of the game with a summary (from myNextPlan.md)

## Later
- Fog of war, and playing against the computer (myNextPlan.md)
