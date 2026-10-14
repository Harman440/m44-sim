# Pass and play: plan

A second way to play: both players on **one device**, passing it between them, with **everything played in the app**: no physical board. It lives beside the current mode (one tablet per side, next to the table), which stays as it is.

Work through it one step at a time, as in [PLAN.md](PLAN.md), and tick items off when they're done. Items marked **Decide** need an answer from the player first. The turn follows the simultaneous rules in [house-rules.md](house-rules.md).

## What changes from the companion mode

The companion mode rests on two decisions (see PLAN.md) that this mode reverses:
- **One shared map with both armies.** The app knows every unit, so it works out line of sight, the enemy's sandbags, targets and terrain itself, and applies casualties and retreats. No "Actualizar mapa", no questions about the table.
- **Figures per unit.** The app has to apply hits, so units have figures again. **Decided** (not the official counts): infantry 7 figures (7 hits); armour 3 figures, each taking 2 hits (6 hits); artillery 3 pieces (3 hits), then its crew stays as an infantry figure. The limited-damage rule (keep at most as many results as figures) is applied by the app.

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
- [ ] "Pasar y jugar" / "Pass and play" in the menu: pick a scenario, no side to choose
- [ ] `game-core`: a match that holds the shared board (both armies) and, per side, the hand, decks, coins and orders; the current `GameSession` per-side rules are reused rather than copied
- [ ] Save and resume the match (its own save, beside the companion one)

### PP2: Hidden turns
- [ ] The cover screen between the players, saying whose turn it is
- [ ] Cards and orders for each side in turn, reusing `CardsView` and `OrdersView` on the shared map (the board turned for the Axis)
- [ ] The reveal: both cards and both sides' orders

### PP3: Movement
- [ ] Simultaneous movement on the shared map, with the collisions resolved by the app
- [x] **Decided:** units move step by step, all together: every unit's first hex, then the second, … A collision is two units in the same hex after a step, or two units swapping hexes in the same step

### PP4: Battle
- [ ] Figures per unit, shown on the token; units lose figures and are removed when they reach 0
- [ ] Firing order with alternating sides; the app picks the target kind, terrain, sandbags and line of sight from the map
- [ ] Hits, retreats (**Decided:** the owner picks the hex), taking ground
- [ ] Combat cards against the opponent applied by the app (Out of Ammo, Ambush, …) instead of "Bloqueado por el rival"

### PP5: Winning
- [x] **Decided:** no winning for now: the game goes on until the players stop. Winning conditions depend on the scenario and come later
- [ ] **Later:** medals and objective hexes per scenario, and the end of the game with a summary (from myNextPlan.md)

## Later
- Fog of war, and playing against the computer (myNextPlan.md)
