# The actions mode

**Replaces the card game** (decided 2026-10-22). Every unit gets an action each turn, chosen from its own list, and pays for it from its own supplies: morale, energy, ammo and equipment for infantry, fuel and shells for armour and artillery. The scenario is **not** split into sections. Each side holds every command card from the start, may play **at most one** per turn, pays its cost in supplies, and then waits out a cooldown. Nothing is handed out at the end of the turn. When it all works, the old card game is removed: decks, combat cards, sections, the end-of-turn draw and reward.

Work through it one step at a time. Each step is one commit, and you tick items off (`[x]`) when they're done. Items marked **Decide** need the player's answer before they're built. The source is the player's note in [myNextPlan.md](myNextPlan.md) ("Rework"), and the answers below.

## Decided (2026-10-22)
- **Modes:** pass and play, against the computer, and own tablets. Own tablets can't know the flags rolled against their units, so they **don't track morale**: there a flag works as it does today (the first pins, each one after it is a hex of retreat), Morale Up isn't offered, and Medic and Mechanic are carried out at the table (own tablets don't track figures).
- **Cooldown:** the same for every card, 3 turns. A card played on turn 2 can be played again on turn 5.
- **Supplies:** as now, 1 for each supply face rolled in battle. A side starts with 0.
- **Per scenario:** a scenario can leave out a card for a side (no air: no Air Bombardment or Air Power; no big guns: no Barrage), or make it cheaper. Set in the map editor.
- **Luck:** goes from −3 to +3 and starts at 0. Each point adds or takes away about 5% chance per die of rolling a hit face. It moves on a **streak**: a die that hits is −(1 − p) and a miss is +p, where p is that die's chance to hit. So luck doesn't drift just because a target is hard to hit.
- **Flags on infantry** (pass and play, computer): −1 morale, *and* the pinned-then-retreat rule applies as now.
- **Morale 0:** the unit can only be given Morale Up (or rest). Resupply also fills its morale back up.
- **Luck's hits:** a die is a hit only if it hits the unit it's fired at: the target's symbol or a grenade. Whether a face hits depends on the target. Flags, supplies and faces of another unit's symbol are misses.
- **New units:** Reinforcements arrive with energy 0 and everything else full. An artillery crew left as infantry (the experimental setting) has everything full.
- **The enemy's supplies and luck are never shown**, not even on the battle screen both players share.
- **Firefight** fires with normal dice. Today's bonus (+1 die at range, −1 in close assault) goes, code included.
- **Equipment** (infantry; Resupply gives it all back): Explosives (Explosives fire option), Sandbags (Fortify), Medic kit (Medic), Camouflage net (Camouflage). A unit starts with one of each.
- **Elite infantry** no longer moves 2 and fires. Instead it has 2 of each piece of equipment, morale 10 and energy 10 (its cap).
- **Elite tanks:** 3 hits take away a figure, and they start with 7 fuel.
- **A unit with no action rests.** It doesn't move or fire, and infantry recovers 2 energy at the end of the turn instead of 1.
- **Free actions:** infantry Reload, armour Firefight and Mechanic, and artillery Firefight cost nothing.
- **Mechanic:** the tank clears the damage on a figure that has been hit but not lost (each figure needs 2 hits to go, 3 for elite). A figure already lost doesn't come back.
- **Take Cover** can't fire. **Armour Forward** fires, unless it ends on a hex its terrain doesn't let it fire from.
- **Collisions cost ammo or shells.**
- **Screen:** the list of units to order is on the **right** of the map. Selecting a unit opens its actions as a pop-up over the map, to the right of the unit. A chosen action's description is shown on the right, over the unit list.
- **Card art:** for now we reuse the closest paintings, and the player swaps them later with `npm run card-art`.

## Overall approach
- **Building it:** while the mode is built, `GameSession` has a `ruleset: "cards" | "actions"`, so the card game keeps working and every push to `main` still deploys a working app. R16 makes actions the only way to play, and R17–R18 remove the card game and the switch with it.
- Movement, collisions, the battle's firing order, pinned units, limited damage, retreats, taking ground, fog of war and victory stay as they are.
- The new rules go in their own pure modules with tests, so `GameSession` (already 3,000 lines) only calls them:
  - `data/unitSupplies.ts`: the numbers.
  - `data/unitActions.ts`: the actions as data.
  - `data/actionCards.ts`: the 7 cards.
  - `game-core/unitSupplies.ts`, `game-core/actionRules.ts` and `game-core/luck.ts`: the rules on top of that data.
- Each rules step adds its text to `ruleBook.ts` in both languages, and bumps `SAVE_VERSION` when the save's shape changes.

---

## R0: Drop the sections variant
The three commits on `sections-variant` (8e580d4 orders by section with no command cards, 0bbaece a command card per section, f332692 combat cards by section) are discarded. The rework doesn't use sections.
- [x] Keep the plan and the notes: committed on `main`
- [x] Where 8e580d4 hooked a variant into the game, the seams the actions mode needs too: `Menu.tsx`, `App.tsx`, `saveGame.ts`, `gameSession.ts`, `passAndPlay.ts`, `CardsView`/`OrdersView`/`EndOfTurnView`, `turnLog.ts`, `ai/selfPlay.ts`
- [x] The work goes on from `main`; the three commits stay only on `sections-variant`
- [ ] Delete `sections-variant`, local and on `origin` (confirm first)

## Part 1: The rules (game-core and data, no UI)

### R1: Unit supplies
- [x] `data/unitSupplies.ts`, all the numbers in one place (what a unit starts with is also the most it can hold, so Reload never goes past it):
  - infantry: morale 5, energy 5, ammo 2, Reload +2, one of each piece of equipment
  - elite infantry: morale 10, energy 10, two of each piece of equipment
  - tanks: fuel 5 (elite 7), shells 2, Reload +2
  - artillery: fuel 1, shells 2, Reload +2
  - energy recovered at the end of the turn: 1, or 2 when resting
- [x] `game-core/unitSupplies.ts`, plain functions: a unit's full supplies (by type and elite), `canPay`, `pay`, `reload`, `refill` (Resupply, Refuel) and `endOfTurn` (energy back, capped), each returning a new value. Tests
- Elite infantry's move goes in R5, and the elite tank's 3 hits a figure in R8

### R2: The actions as data
- [ ] `data/unitActions.ts`: each action has an id, its unit type, its name and description (`Localized`), its painting (a card template id), and its cost (energy, fuel or a piece of equipment). It also says how far it moves (and whether it ignores terrain), how it fires, any effect, and whether own tablets offer it:
  - **Infantry:**
    - Firefight (firefight): fires, no move, 1 energy
    - Assault (infantry-assault): moves 1 and fires, 1 energy
    - No Respite (no-respite): moves 1 and fires with the units that didn't move, 2 energy
    - Close Assault (close-assault): no move, fires only in close assault with +1 die, 1 energy
    - Move Out (move-out): moves up to 2, no fire, 1 energy
    - Medic (medic): back 1 figure, uses the medic kit
    - Behind Enemy Lines (infiltrators): as today's card, 4 energy
    - Motorized (motorized): moves up to 3, no fire, 2 energy
    - Morale Up (not-a-step-back): morale back to full, 1 energy; not on own tablets
    - Camouflage (camouflage): no move or fire, 2 energy and the net
    - Fortify (fortify): sandbags on its hex, no move or fire, 2 energy and the sandbags
    - Take Cover (rattenkrieg): moves up to 1, no fire, ignores the first 2 infantry-symbol hits (as Personal Armor), 1 energy
    - Reload: +2 ammo, free
  - **Armour:**
    - Firefight: fires, no move
    - Assault: moves up to 3 and fires, 1 fuel
    - Armour Forward (armor-forward): moves up to 3, ignoring terrain movement limits, and fires unless its last hex forbids it, 2 fuel
    - Mechanic (mechanic): clears a hit figure's damage, no move or fire
    - Reload: +2 shells
  - **Artillery:**
    - Firefight (spotter): fires, no move
    - Artillery Bombardment (artillery-bombardment): fires twice, 1 fuel
    - Reposition (reposition): moves up to 2, no fire, 1 fuel
    - Fortify (fortify): sandbags, 1 fuel
    - Reload: +2 shells
- [ ] Fire options as data:
  - infantry, each spending 1 ammo: Normal; Explosives (close assault only, +1 die, uses the explosives); Suppressive
  - armour, each spending 1 shell: Normal (+1 die in close assault if it didn't move); Suppressive
  - artillery: Fire, 1 shell per shot
- [ ] Suppressive dice in `dice.ts`: the 6-sided die is 1 infantry, 1 grenade, 3 flags and 1 supply; the 8-sided die is 4 flags, 2 infantry and 2 supplies (rolled where the 8-sided die is). Faces in `DieFaceIcon`, 2D and 3D, come in R13
- [ ] Tests: every action has both languages and a painting that exists, and the costs match this list

### R3: The command cards, their cooldown and the scenario's say
- [ ] `data/actionCards.ts`:
  - Finest Hour (finest-hour) 15: every unit fires with +1 die this turn, on every shot (limited damage allows one more, as with a card's extra dice)
  - Resupply (preparations) 9: all infantry gets its equipment, ammo and morale back to full, a unit at morale 0 too
  - Refuel (armor-assault) 10: tanks and artillery get their fuel topped up
  - Air Bombardment 8, Reinforcements 10, Barrage 8, Air Power 7: as today's combat cards, with their markers and the attack die
- [ ] `CARD_COOLDOWN_TURNS = 3`, plus pure functions `isReady(card, playedOn, turn)` and `turnsLeft`. Tests
- [ ] `Scenario.cards` (optional, per side): the cards the side doesn't have, and a lower cost for any card. In the scenario file, its schema and `validateScenario`. The built-ins set Air Bombardment, Air Power and Barrage from their air and big-gun rules. Tests

### R4: The turn without decks
- [ ] `GameSession` gets `ruleset`, saved in `SessionState` and `SavedGame` (bump `SAVE_VERSION`). `PassAndPlayMatch` creates both sessions with it, and the match save keeps it
- [ ] With `"actions"`:
  - the hand is every card the scenario gives the side (R3), and there's no deck, draw, end-of-turn reward or combat cards
  - the card phase picks no card or one that is ready and affordable, and its cost is paid when the orders are revealed, as coins are today
  - no sections anywhere (orders, cards, fog of war's `sectionsSeenFrom`, the turn log)
- [ ] The final phase: energy back for every infantry unit (2 if it rested), and cooldowns tick. Nothing to draw or choose
- [ ] Rule book: a chapter for the actions mode (the turn, the cards, the cooldown)
- [ ] Tests: playing a card twice within 3 turns fails, a card you can't afford fails, two cards in one turn fail, a card the scenario leaves out fails, and nothing is drawn at the end of the turn

### R5: Giving actions
- [ ] `Order` gets `action` (an id from R2). `giveAction(position, actionId)` checks it in `actionRules.ts`:
  - the unit's type
  - enough energy, fuel or equipment
  - at morale 0, only Morale Up
  - ammo or shells for an action that fires
  - on own tablets, only the actions they offer

  The move targets then come from the action's move, through today's `getMoveOptions`/`issueOrder` (Armour Forward ignores terrain movement limits, as today's card does). Choosing another action replaces the unit's order; undo works as today
- [ ] Elite infantry no longer moves 2 and fires: its moves come from its actions, as any infantry's
- [ ] A unit with no order rests. Costs are paid when the orders are carried out, and the session's units carry their supplies (in the save; bump `SAVE_VERSION`)
- [ ] Tests for every action: allowed, refused for each missing supply, and the moves it offers

### R6: Firing with actions
- [ ] When a unit fires:
  - No Respite fires with the units that didn't move, and Behind Enemy Lines fires before anyone
  - Artillery Bombardment fires twice (a second shot only with a shell left)
  - Armour Forward can't fire from a hex whose terrain forbids it
  - an action without fire can't fire
- [ ] Each shot picks a fire option (R2), which spends ammo or shells, and a unit with none left can't fire. Close Assault +1 die, armour's +1 die if it didn't move, Explosives, Suppressive and Finest Hour go through today's `combatBonusesFor`/dice steps, so `ShotSteps` explains them
- [ ] Collisions spend 1 ammo or shell. A unit with none left, or at morale 0, doesn't roll in a collision (only the other side does)
- [ ] Tests in `passAndPlay.test.ts`: each option's dice, what it spends, refused when empty, collisions, and the firing round of No Respite and Behind Enemy Lines

### R7: Morale
- [ ] Pass and play and computer: in `sufferHits`, each flag on infantry is −1 morale (down to 0), on top of today's pinned and retreat rule. Morale Up brings it back to full. Own tablets: flags as today, no morale
- [ ] Not One Step Back is gone, so nothing ignores flags. Tests

### R8: The other actions and cards
- [ ] The action effects, mostly reusing today's card code:
  - Medic: +1 figure, using the kit, when the unit has lost one
  - Mechanic: clears a hit figure's damage, 2 or 3 hits by elite
  - Camouflage: today's badge
  - Fortify: sandbags now, for infantry and artillery
  - Take Cover: Personal Armor
  - Reposition: moves after the battle, as today's card does
  - Behind Enemy Lines: today's Infiltrators, including the 3-hex move after the battle

  On own tablets, Medic and Mechanic are a reminder for the table
- [ ] The cards: Resupply and Refuel take effect as the orders are revealed, and Finest Hour for the turn. Air Bombardment, Barrage, Air Power and Reinforcements use today's markers, attacks and arrival
- [ ] Elite tanks: a figure goes on its 3rd hit (`data/figures.ts` by unit, not only by type), in the rule book too
- [ ] New units: Reinforcements arrive with energy 0 and everything else full; an artillery crew left as infantry has everything full
- [ ] Tests for each one

### R9: The luck meter
- [ ] `game-core/luck.ts`: each unit's luck from −3 to +3, starting at 0. Each point moves a die's chance of a hit face by 5%: a miss turns into a hit face of the right kind, or a hit into a miss, so the faces stay the die's own. After each die the meter moves on the streak: −(1 − p) for a hit, +p for a miss. The unit's luck is in the save (bump `SAVE_VERSION`). On own tablets, only the tablet's own rolls count
- [ ] Tests with a fixed random source: the chance at each level (a statistical test with a fixed seed), and the meter's steps and limits; a unit firing at tanks for many turns stays near 0
- [ ] A hit is a face that hits the target (its symbol or a grenade, as `hitRules.ts` says for that target), and everything else is a miss. Luck also applies to suppressive dice and collisions, but not to the cards' attacks

## Part 2: The screens

### R10: Choosing the mode and the card
- [ ] Menu: until R16, when a game starts, "Cartas" or "Acciones", marked "en pruebas", next to today's options such as the 8-sided die
- [ ] Card phase in this mode: the cards with their cost, a cooldown badge ("3 turnos") and greyed when not ready or affordable, plus "Sin carta". The picked card flies into the orders screen as today
- [ ] Checked at 1280×800, 800×1280 and on desktop, in Spanish and English

### R11: The units to order
- [ ] The list of the side's units on the **right** of the map. Each row shows the unit's icon and hex, its supplies as small meters (morale, energy, ammo and equipment icons, or fuel and shells), its luck, and the action it has, or "Descansa". Rows are at least 48px
- [ ] Tapping a row selects the unit and zooms the map a little onto it (`boardZoom.ts`). Tapping the unit on the map still works and highlights its row
- [ ] Portrait: the list goes below the map, and the page never scrolls sideways

### R12: The action pop-up and the action's card
- [ ] Selecting a unit opens its actions as a pop-up **over the map, to the right of the unit** (MUI `Popper` anchored to the unit's hex; it flips to the left near the map's right edge). One it can't pay for is greyed, with the reason ("Sin energía", "Moral 0")
- [ ] Picking one shows its card **on the right, over the unit list**: the painting, the name, the description and the cost. Then the map offers the action's moves, as orders do today. Once the order is given or cancelled, the list comes back
- [ ] Art: the paintings from R2. For the missing ones, the Explosives + Street Equipment mix is put together by a script (`src/assets/cards/explosives-mix.webp`, half and half). The rest borrow paintings until the player has new ones: armour Firefight → firefight, armour Assault → infantry-assault, Reload → preparations, Normal fire → firefight, Suppressive Fire → heat-of-battle
- [ ] Tests: the pop-up offers only the unit's actions, a greyed one can't be picked, and both languages

### R13: The battle and the final phase
- [ ] `FireDialog`: choosing the fire option, with what it spends. The suppressive dice in `DicePool`, 2D and 3D (`faceTextures`, `dieGeometry` for the 8-sided die)
- [ ] Show the changes on the unit: morale lost, ammo spent, luck moved (a small number on the unit and in its row). The final phase lists the energy recovered and the cards coming back off cooldown
- [ ] The history (`turnLog.ts`) records each unit's action
- [ ] The enemy's supplies and luck are never shown, on any screen, and the shared battle screen shows only the side firing. Test

### R14: The map editor
- [ ] In the scenario's settings, for each side, a switch for each card the side has, and its cost (lowered from the default), stored in `Scenario.cards`. Shown in the menu's scenario panel. Test

## Part 3: The computer

### R15: The computer plays the actions mode
- [ ] `Brain` gets `chooseCard` (or none) and `chooseAction` for each unit, and a fire option. `standardBrain` scores the actions:
  - Reload when ammo or shells are empty, and Morale Up at morale 0 or close to it
  - rest when energy is low, and keep fuel for when it counts
  - Explosives in close assault, and Suppressive at targets it wants to push back
- [ ] `selfPlay.ts` plays the actions mode, and computer-against-computer games end (as the medals test does today)

## Part 4: The switch, then the clean-up

### R16: Actions only
- [ ] Every new game uses actions, on all three ways to play; the menu's choice goes. `SAVE_VERSION` bumped, so old card games are dropped
- [ ] Own tablets: the full turn checked end to end (cards, actions, the battle with flags as today, Medic and Mechanic reminders)

### R17: Remove the card game's screens
Done before the rules, so the code that's left still typechecks:
- [ ] The card hand and pick view for the old deck, `CardPiles`, `CombatDeckDialog`, `DeckVisualizerDialog`, `CoinsDialog`'s rewards and extra orders, the combat-card parts of `OrdersView`/`EndOfTurnView`, `SectionIcon` and the section lines on the board, and their texts and tests
- [ ] "Modo prueba" becomes: plenty of supplies and no cooldown

### R18: Remove the card game's rules
- [ ] The old decks in `data/commandCards.ts` and `data/combatCards.ts` (keeping what the attack cards and Reinforcements in R3 still use), `deck.ts`, `handOrder.ts`, the card parts of `orderRules.ts` (Firefight's +1/−1 die bonus included), sections (`Section`, section hexes, `frontSections` if anything is left), the reward and extra-order coins in `coinRules.ts`, `ai/combatCardChoice.ts`, the `ruleset` switch, and the save fields they used (bump `SAVE_VERSION`). Their tests go too, and the rest of the tests still pass
- [ ] Rule book: the card game's chapters go. `house-rules.md` gets a note that its card rules are history. Card items in `PLAN.md`, `PASS_AND_PLAY_NEXT.md` and `PLAY_THE_COMPUTER.md` are struck through

## Part 5: Finish

### R19: Docs
- [ ] `ARCHITECTURE.md` (the actions mode and its modules, without the card game), the rule book checked against the code, the README, and CLAUDE.md's code map (Cards, decks, sections). Tick off the "Rework" in `myNextPlan.md`

### R20: A test game
- [ ] A pass and play match, a game against the computer and a turn on two tablets, at 1280×800 and 800×1280 with touch, in Spanish and English. Then retune the costs, starting supplies and cooldown, which are all in the data files
