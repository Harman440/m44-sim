# The actions mode

**Replaces the card game** (decided 2026-10-22). Every unit gets an action each turn, chosen from its own list, and pays for it from its own supplies: morale, energy, ammo and equipment for infantry, fuel and shells for armour and artillery. The scenario is **not** split into sections. Each side holds every command card from the start, may play **at most one** per turn, pays its cost in supplies, and then waits out a cooldown. Nothing is handed out at the end of the turn. When it all works, the old card game is removed: decks, combat cards, sections, the end-of-turn draw and reward.

Work through it one step at a time. Each step is one commit, and you tick items off (`[x]`) when they're done. Items marked **Decide** need the player's answer before they're built. The source is the player's note in [myNextPlan.md](myNextPlan.md) ("Rework"), and the answers below.

## Decided (2026-10-22)
- **Modes:** pass and play, against the computer, and own tablets. Own tablets can't know the flags rolled against their units, so they **don't track morale**: there a flag works as it does today (the first pins, each one after it is a hex of retreat), Morale Up isn't offered, and Medic and Mechanic are carried out at the table (own tablets don't track figures).
- **Cooldown:** the same for every card, 3 turns. A card played on turn 2 can be played again on turn 5.
- **Supplies:** as now, 1 for each supply face rolled in battle. A side starts with 0.
- **Per scenario:** a side with no air sorties has no Air Bombardment or Air Power, and one with no big guns no Barrage (the scenario's existing `airPower` and `bigGuns`). A scenario can also make a card cheaper for a side (`Scenario.cardCosts`). Both are set in the map editor.
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
- **No extra turn for the attacker** (decided 2026-10-22): both sides play from turn 1. Instead, every unit of the defending side starts the game with 1 ammo less (infantry) or 1 shell less (tanks and artillery).
- **A unit with no action rests.** It doesn't move or fire, and infantry recovers 2 energy at the end of the turn instead of 1.
- **Energy back only without moving** (decided 2026-10-22): infantry that moved this turn (its action's move, taking ground, or a card's move after the battle) gets no energy back at the end of the turn. A retreat doesn't count as moving.
- **Free actions:** infantry Reload, armour Firefight and Mechanic, and artillery Firefight cost nothing.
- **Mechanic:** the tank clears the damage on a figure that has been hit but not lost (each figure needs 2 hits to go, 3 for elite). A figure already lost doesn't come back.
- **Take Cover** can't fire. **Armour Forward** fires, unless it ends on a hex its terrain doesn't let it fire from.
- **Collisions cost ammo or shells.**
- **Screen:** the list of units to order is on the **right** of the map. Selecting a unit opens its actions as a pop-up over the map, to the right of the unit. A chosen action's description is shown on the right, over the unit list.
- **Card art:** for now we reuse the closest paintings, and the player swaps them later with `npm run card-art`.

## Overall approach
- **Building it** (decided 2026-10-22): on the `actions-mode` branch, replacing the card game directly in `GameSession`, with no switch between the two. Each commit on the branch passes `npm run check`, so callers (the views, the computer, the tests) change with the rules they use. The branch is merged into `main` (and so deployed) once a pass and play match, a game against the computer and a turn on own tablets play end to end. Until then the tablets keep the card game.
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
- [x] Keep the plan and the notes: committed (now on `actions-mode`; local `main` is back at `origin/main`)
- [x] Where 8e580d4 hooked a variant into the game, the seams the actions mode needs too: `Menu.tsx`, `App.tsx`, `saveGame.ts`, `gameSession.ts`, `passAndPlay.ts`, `CardsView`/`OrdersView`/`EndOfTurnView`, `turnLog.ts`, `ai/selfPlay.ts`
- [x] The work goes on from `main`; the three commits stay only on `sections-variant`
- [ ] Delete `sections-variant`, local and on `origin` (confirm first)

## Part 1: The new rules as data

### R1: Unit supplies
- [x] `data/unitSupplies.ts`, all the numbers in one place (what a unit starts with is also the most it can hold, so Reload never goes past it):
  - infantry: morale 5, energy 5, ammo 2, Reload +2, one of each piece of equipment
  - elite infantry: morale 10, energy 10, two of each piece of equipment
  - tanks: fuel 5 (elite 7), shells 2, Reload +2
  - artillery: fuel 1, shells 2, Reload +2
  - energy recovered at the end of the turn: 1, or 2 when resting
- [x] `game-core/unitSupplies.ts`, plain functions: a unit's full supplies (by type and elite), `canPay`, `pay`, `reload`, `refill` (Resupply, Refuel) and `endOfTurn` (energy back, capped), each returning a new value. Tests
- Elite infantry's move goes in R6, and the elite tank's 3 hits a figure in R8

### R2: The actions as data
- [x] `data/unitActions.ts` (types in `game-core/unitAction.ts`): each action has an id, its unit type, its name and description (`Localized`), its painting (a card template id), and its cost (energy, fuel or a piece of equipment). It also says how far it moves (and whether it ignores terrain), how it fires, any effect, and whether own tablets offer it:
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
- [x] Fire options as data:
  - infantry, each spending 1 ammo: Normal; Explosives (close assault only, +1 die, uses the explosives); Suppressive
  - armour, each spending 1 shell: Normal (+1 die in close assault if it didn't move); Suppressive
  - artillery: Fire, 1 shell per shot
- [x] Suppressive dice in `dice.ts`: the 6-sided die is 1 infantry, 1 grenade, 3 flags and 1 supply; the 8-sided die is 4 flags, 2 infantry and 2 supplies (rolled where the 8-sided die is). The card game's Suppressive Fire card already had these dice: they now have the new faces, in its text and the rule book too
- [x] Tests: every action has both languages and a painting that exists, and the costs match this list

### R3: The command cards, their cooldown and the scenario's say
- [x] `data/actionCards.ts` (the type and rules in `game-core/actionCard.ts`):
  - Finest Hour (finest-hour) 15: every unit fires with +1 die this turn, on every shot (limited damage allows one more, as with a card's extra dice)
  - Resupply (preparations) 9: all infantry gets its equipment, ammo and morale back to full, a unit at morale 0 too
  - Refuel (armor-assault) 10: tanks and artillery get their fuel topped up
  - Air Bombardment 8, Reinforcements 10, Barrage 8, Air Power 7: as today's combat cards, with their markers and the attack die
- [x] `CARD_COOLDOWN_TURNS = 3`, plus pure functions `isReady(playedOn, turn)` and `turnsLeft`. Tests
- [x] Which cards a side has comes from the scenario's air and big guns, which it already sets (`airPower`, `bigGuns`, in the map editor too): the air cards need air sorties, Barrage big guns. `Scenario.cardCosts` (optional, per side, card id → cost) makes cards cheaper, in the scenario file, its schema and `validateScenario`. `cardsOf(scenario, side)` gives a side's cards at its cost. Tests

## Part 2: Replacing the card game (on `actions-mode`)

Command cards, combat cards and sections reach far beyond `GameSession`: about 15 views, the computer, the fire rules (`FireContext.card` gives the card's bonus dice) and some 20 test files (map of 2026-10-22). Each step below changes the rules together with their callers and tests, so every commit passes `npm run check`. The views get only what they need to keep working here. Part 3 gives them the new layout.

### R4–R5: The card game out, the action cards in
Done as one commit: the hand, card picking, coins, markers and the end of the turn were too tangled to take the combat cards out first and swap the command deck after.
- [x] Out: the command and combat decks and hands, the draw in the final phase (Recon's choice, draw again, `extraDraws`), the end-of-turn reward, order slots and sections in orders, extra orders bought with coins, the fallback card, the Close Assault card's marking, the cards' fire bonuses (`FireContext.card`), cards given to a unit, Concentrated Fire, Suppressive Fire as a card, Rifles Up!, Not One Step Back, Heat of Battle, Spotter, Street Equipment, Explosives as a card, Tactician, the movement cards, Fortify in the battle, card healing. Also `deck.ts`, `handOrder.ts`, `ai/combatCardChoice.ts`, `CardPiles`, the deck dialogs, `CloseAssaultMap`, and their tests
- [x] In: `GameSession`'s hand is the side's action cards (`cardsOf`, `snapshot.cards` with cost, cooldown and whether playable). `pickCard(card | null)`: none, or one that's ready and affordable, never in the attacker's extra turn; its cost goes on the supply ledger at once, and the turn it was played is kept for the cooldown (`cardsPlayedOn`, in the save). Test mode: plenty of supplies, no cooldown
- [x] The new cards' markers and effects: Air Bombardment, Barrage and Air Power mark and attack, Reinforcements marks its cross, Finest Hour adds a die to every shot (and one more result for limited damage). Resupply and Refuel come in R8
- [x] Until R6 gives actions, every unit can be ordered (once), moving and firing as a unit does with no card; a unit with no order rests
- [x] Kept, idle until R8 gives them to actions: the camouflage badge (kept from turn to turn) and the moves after the battle (`finalMove`, fed by an empty `movesAfterBattle`)
- [x] `airSortiesOf`, `hasBigGuns` and `hasUnits` moved to `data/scenarioRules.ts`
- [x] Views: `CardsView` shows the action cards (`ActionCardComponent`: cost crate, painting, cooldown badge), greyed when not playable, plus "Sin carta". `OrdersView` has no slots. `EndOfTurnView` keeps the map changes, the reinforcement and the moves after the battle, and shows the hand. The battle's side panel, the reveal and the history show the card played. The scenario panel counts each side's command cards. The header's deck piles and the deck dialog are gone
- [x] Computer: plays no card for now (R15 teaches it), and orders every unit
- [x] Rule book: the turn, the cards, the cooldown; the combat-card and deck chapters gone. `SAVE_VERSION` 37. Tests adapted, and new ones for the cards (cooldown, cost, extra turn, a card the scenario leaves out, nothing drawn)

### R6: Giving actions
- [x] `Order` gets `action` (an id from R2). `giveAction(position, actionId, to)` checks it in `actionRules.ts`:
  - the unit's type
  - enough energy, fuel or equipment
  - at morale 0, only Morale Up
  - ammo or shells for an action that fires
  - on own tablets, only the actions they offer

  The moves come from the action's move (Armour Forward and Behind Enemy Lines ignore terrain movement limits). Choosing another action replaces the unit's order; undo works as today. Only an order that holds is replaced, and it may become a move only when it's the last order (a later order may have moved through the hex it would free); an order that moved is changed with "Volver". A unit with no action it can pay for isn't offered (`orderable`). `issueOrder(from, to)` stays as the plain move: the cheapest plain action that makes it (`PLAIN_ACTIONS`)
- [x] Each unit's supplies (`unitSupplies.ts`) live in the session and the save. Costs are paid when the orders are confirmed. A unit with no order rests. The final phase gives energy back (2 if it rested, 1 if it held, none if it moved: `turnSpent`)
- [x] Elite infantry no longer moves 2 and fires (`Unit`'s elite move rule goes)
- [x] `OrdersView`: tapping a unit lists its actions (a plain list for now, the pop-up comes in R13)
- [x] Computer: turns the move it wants into an action (holding: Firefight, a move it fires after: Assault, a longer one: Move Out or Motorized), and rests when it can't pay
- [x] Tests for every action: allowed, refused for each missing supply, and the moves it offers

### R6b: No extra turn for the attacker
- [x] Both sides start on turn 1 together. The attacker's extra first turn goes: `AWAIT_ATTACKER`, `startFirstTurn`, `extraTurn` (and the "no card in the extra turn" rule), `WaitingView`, the match's waiting step, and the "Turno 1 · extra" chip
- [x] Every unit of the scenario's defending side starts with 1 ammo less (infantry) or 1 shell less (tanks and artillery) (`data/unitSupplies.ts`: a defender's adjustment, applied when the session fills its units' supplies; never below 0). Reloading still fills up to the full amount
- [x] The attacker still fires first in the battle (the firing order is unchanged)
- [x] Rule book ("El primer turno") and the menu's scenario panel ("Ataca"/"Defiende" info) say so. `SAVE_VERSION` bumped. Tests: both sides pick a card on turn 1, a defender's infantry starts with 1 ammo and its tanks and artillery with 1 shell, an attacker's with 2

### R7: Firing with actions
- [x] When a unit fires:
  - No Respite fires with the units that didn't move, and Behind Enemy Lines fires before anyone
  - Artillery Bombardment fires twice (a second shot only with a shell left)
  - Armour Forward can't fire from a hex whose terrain forbids it
  - an action without fire can't fire
- [x] Each shot picks a fire option (R2), which spends ammo or shells, and a unit with none left can't fire. Close Assault +1 die, armour's +1 die if it didn't move, Explosives, Suppressive and Finest Hour go through the dice steps, so `ShotSteps` explains them. `FireDialog` offers the options (and so does pass and play's battle screen, `FireOptionPicker`). Taking a shot back gives its ammo or shells back. Armour that takes ground with no shell left moves in without its shot more
- [x] Collisions spend 1 ammo or shell. A unit with none left, or at morale 0, doesn't roll in a collision (only the other side does)
- [x] Tests: each option's dice, what it spends, refused when empty, collisions, and the firing round of No Respite and Behind Enemy Lines
- [x] Brought forward from R8 so the computer's games still end: Reload's ammo or shells come back when the orders are confirmed, and the computer reloads a unit with nothing left to fire (R15 teaches it the rest). `SAVE_VERSION` 40

### R8: Morale, and the other actions and cards
- [x] Pass and play and computer: each flag on infantry is −1 morale (down to 0), on top of the pinned and retreat rule. Own tablets: flags as today, no morale
- [x] The action effects, on the plumbing kept in R4 (as the orders are confirmed, unless said otherwise):
  - Morale Up: morale back to full
  - Medic: +1 figure, using the kit, when the unit has lost one (pass and play refuses it with none lost: `nothingToMend`)
  - Mechanic: clears a hit figure's damage (refused with no figure hit)
  - Camouflage: the badge, after the battle
  - Fortify: sandbags now, for infantry and artillery (a battle edit, so the log shows it)
  - Take Cover: the first 2 infantry-symbol hits ignored in the battle (`TAKE_COVER_HITS`, `coverHits` in the save)
  - ~~Reposition: moves after the battle~~ It stays a move before the battle (decided 2026-10-22)
  - Behind Enemy Lines: the 3-hex move after the battle
  - ~~Reload~~ (done in R7)

  On own tablets, Medic, Mechanic, Take Cover and Behind Enemy Lines' move are reminders for the table on the movement screen (`tableReminders`)
- [x] Resupply and Refuel take effect as the orders are revealed
- [x] Elite tanks: a figure goes on its 3rd hit (`data/figures.ts`: `ELITE_HITS_PER_FIGURE`)
- [x] New units: Reinforcements arrive with energy 0 and everything else full; an artillery crew left as infantry has everything full
- [x] Rule book and tests for each one. `SAVE_VERSION` 41

### R9: The luck meter
- [x] `game-core/luck.ts`: each unit's luck from −3 to +3, starting at 0. Each point moves a die's chance of a hit face by 5%: a miss turns into a hit face of the right kind, or a hit into a miss, so the faces stay the die's own. After each die the meter moves on the streak: −(1 − p) for a hit, +p for a miss. The unit's luck is in the save. On own tablets, only the tablet's own rolls count
- [x] A hit is a face that hits the target (its symbol or a grenade, as `hitRules.ts` says for that target), and everything else is a miss. Luck also applies to suppressive dice and collisions, but not to the cards' attacks
- [x] Tests with a fixed random source: the chance at each level, the meter's steps and limits, and a unit firing at tanks for many turns staying near 0
- [x] Luck uses each die's own draw (where the draw falls within its side decides whether it's turned), so the dice need no extra draws and the tests' fixed dice stay as they were. `luckAt(position)` for the screens of R11; a shot taken back puts the luck back. `SAVE_VERSION` 42

### R10: Sections and the last of the cards
- [x] Sections: the hexes' sides (`hex.ts`), the dashed lines on the board art, `sectionsSeenFrom`, `OrderSummary.section`, `SectionIcon`, the section in place names (`describePlace`)
- [x] The scenario's card fields: `initialHandSize` and `extraDraws` stop being required (old files still read), and go from the editor, the menu's scenario panel and the built-ins
- [x] `commandCard.ts`, `data/commandCards.ts`, `combatCard.ts` and `data/combatCards.ts` go, with whatever still pointed at them. The rule book's last card text goes too. `house-rules.md` gets a note that its card rules are history, and the card items in `PLAN.md`, `PASS_AND_PLAY_NEXT.md` and `PLAY_THE_COMPUTER.md` are struck through
- [x] How it went: the dashed lines are painted over in `compose-board.mjs` (`eraseSectionLines`: the strip one hex to the left, feathered), so the empty board and the four built-ins' art were rebuilt; a bigger board drawn in the app has no lines either. A place is now just its terrain (`describePlace`). `MarkerRule` and `AttackEffect` moved to `actionCard.ts`, and the paintings' list to `components/cardPaintings.ts`; `CardArt`, `CommandCardComponent`, `CombatCardComponent` and `SectionIcon` went. Old scenario files with `initialHandSize` or `extraDraws` still load (the schema marks them as no longer used). The map editor lost its hand sizes, extra draws and Rattenkrieg note. ARCHITECTURE.md and CLAUDE.md's code map still name the old card modules: R16

## Part 3: The screens

### R11: The units to order
- [x] The list of the side's units on the **right** of the map. Each row shows the unit's icon and hex, its supplies as small meters (morale, energy, ammo and equipment icons, or fuel and shells), its luck, and the action it has, or "Descansa". Rows are at least 48px
- [x] Tapping a row selects the unit and zooms the map a little onto it (`boardZoom.ts`). Tapping the unit on the map still works and highlights its row
- [x] Portrait: the list goes below the map, and the page never scrolls sideways
- [x] How it went: `GameViews/UnitList.tsx`, in the orders screen's column (288px wide there, `phase-layout--wide-controls`), under the confirm button. Rows go left to right across the board. Supplies, equipment and luck are icons with their number (red at 0); the icons are from game-icons.net (credited in the README). Tapping a row picks the unit (or only zooms, for one whose order moved it) and zooms the map to at least 1.6× on it (`Board`'s `zoomOn`, `useBoardZoom().focusOn`); a unit picked on the map scrolls its row into sight. Luck shows rounded, with its sign

### R12: The action pop-up and the action's card
- [x] Selecting a unit opens its actions as a pop-up **over the map, to the right of the unit** (MUI `Popper` anchored to the unit's hex; it flips to the left near the map's right edge). One it can't pay for is greyed, with the reason ("Sin energía", "Moral 0")
- [x] Picking one shows its card **on the right, over the unit list**: the painting, the name, the description and the cost. Then the map offers the action's moves. Once the order is given or cancelled, the list comes back
- [x] Art: the paintings from R2. For the missing ones, the Explosives + Street Equipment mix is put together by a script (`src/assets/cards/explosives-mix.webp`, half and half). The rest borrow paintings until the player has new ones: armour Firefight → firefight, armour Assault → infantry-assault, Reload → preparations, Normal fire → firefight, Suppressive Fire → heat-of-battle
- [x] Tests: the pop-up offers only the unit's actions, a greyed one can't be picked, and both languages
- [x] How it went: `GameViews/ActionPopup.tsx` (MUI `Popper` on the unit's hex, found again each time it's placed; it follows the map's zooms and pans through `Board`'s `onViewChange`, stays inside the drawn map and scrolls when the list is taller) and `GameViews/ActionPanel.tsx` (the card, with the map's legend and the buttons under it). The unit's supplies are only in its row now. The Explosives painting is `npm run mix-paintings -- explosives street-equipment explosives-mix`: the two side by side, each trimmed to its drawing (cutting them in half split both figures). In portrait, picking a unit on the map no longer scrolls the page to its row

### R13: The battle and the final phase
- [x] Show the changes on the unit: morale lost, ammo spent, luck moved (a small number on the unit and in its row). The final phase lists the energy recovered and the cards coming back off cooldown
- [x] The history (`turnLog.ts`) records each unit's action and the card played
- [x] The enemy's supplies and luck are never shown, on any screen, and the shared battle screen shows only the side firing. Test
- [x] Every screen checked at 1280×800, 800×1280 and on desktop, in Spanish and English
- [x] How it went: `GameSession` keeps each unit's supplies and luck as the orders are confirmed (`turnStart`, in the save) and `snapshot.changes` gives each of this side's units' morale, ammo and shells, and luck moved since then; a pill under the token on the battle and final maps (`UnitComponent`'s `change`) and chips in the battle list's rows (`UnitChangeChips`) and pass and play's firing unit. `snapshot.turnEnd` gives the final phase's energy back and the cards off cooldown next turn ("Al empezar el turno N"). The turn log keeps each order's `action` and each shot's fire `option`, and the history names them. The shared battle draws the changes of the side whose map is shown, never the computer's; `EnemyUnit` carries no supplies or luck (test). `SAVE_VERSION` 43. Checked at 1280×800 and 800×1280 (Spanish and English) and 1440×900

### R14: The map editor
- [x] In the scenario's settings, for each side, the cost of each card it has (from the card's own down to 0), stored in `Scenario.cardCosts`. The air sorties and big guns there already decide which cards a side has. Shown in the menu's scenario panel. Test
- [x] How it went: "Coste de las cartas" in Datos del escenario, a stepper per card and side (`setCardCost` in `scenarioDraft.ts`; a card at its own cost is left out of `cardCosts`, which goes when empty), "No la tiene" for a card the side's air or big guns leave out. The menu's panel lists a side's cheaper cards under its card count, the card's own cost crossed out. The air and big guns help texts no longer speak of the combat deck. Checked at 1280×800 and 800×1280

## Part 4: The computer

### R15: The computer plays the actions game
- [x] `Brain` gets `chooseCard` (or none) and `chooseAction` for each unit, and a fire option. `standardBrain` scores the actions:
  - Reload when ammo or shells are empty, and Morale Up at morale 0 or close to it
  - rest when energy is low, and keep fuel for when it counts
  - Explosives in close assault, and Suppressive at targets it wants to push back
  - an attack card when it hits enough, Resupply or Refuel when its army is short
- [x] `selfPlay.ts`: computer-against-computer games end (as the medals test does today)
- [x] How it went: `ai/actionChoice.ts` (`chooseCard`, `chooseMark`, `chooseAction`, `chooseFireOption`), given to `standardBrain` as the `Brain`'s `pickCard`, `markFor`, `actionFor` and `fireOptionFor`. A card whose hexes can't all be marked is given up for the turn. 20 computer-against-computer games all ended. Against the brain before R15 it won 75–45 in 120 games; without the action rules it won 77–43, so the cards and fire options help and the action rules don't yet
- [x] **Decided (2026-10-23):** keep the action rules as they are

## Part 5: Finish

### R16: Docs
- [x] `ARCHITECTURE.md` (the actions game and its modules, without the card game), the rule book checked against the code, the README, and CLAUDE.md's code map (Cards, decks, sections). Tick off the "Rework" in `myNextPlan.md`

### R17: A test game, then merge
- [x] A pass and play match, a game against the computer and a turn on two tablets, at 1280×800 and 800×1280 with touch, in Spanish and English. Retune the costs, starting supplies and cooldown, which are all in the data files: the player's answers (2026-10-23) are R18
- [ ] Merge `actions-mode` into `main` (this deploys it to the tablets) and delete the branch

## R18: After the test game (2026-10-23)
The player's notes after playing it, and their answers: the cooldown goes to 4 turns; the starting supplies, Move Out's 1 energy and the computer's action rules stay.

- [x] Rules (`data/unitActions.ts`):
  - Behind Enemy Lines costs 5 energy and fires with the units that moved (no more "fires first": the round, its group in the battle and its rule book line go); it still moves 3 ignoring terrain, and 3 more after the battle
  - Move Out moves up to 2 and fires if it moved 1 hex or none (`UnitAction.fireMove`)
  - Infantry Assault moves up to 2 and fires, for 3 energy and 2 morale (a unit at morale 2 may, ending at 0); own tablets don't track morale and pay only the energy (`actionCost`)
  - Motorized costs 4 energy
  - Close Assault is gone, with the action dice it alone used (`ActionFire.bonusDice`, `closeAssaultOnly`, the "action" dice step)
  - A plain move tries Firefight, Move Out, Motorized: 2 hexes is Move Out, which doesn't fire; Infantry Assault only when picked
  - Cards wait 4 turns (`CARD_COOLDOWN_TURNS`)
  - An action that would change nothing is refused (`notNeeded`): Reload with full ammo or shells, Morale Up at full morale, Fortify on sandbags, Camouflage with the badge on
  - `SAVE_VERSION` 44, `MATCH_SAVE_VERSION` 19
- [x] The action pop-up: tighter and see-through, only the actions the unit can be given, costs as icons, an "i" by each that shows its card on the right (`ActionPopup`, `CostIcons` in `components/SupplyIcons.tsx`; the card from the "i" has "Elegir esta acción"). Rows stay 48px for the finger
- [x] The battle: changing the fire option keeps the target picked; a unit with nothing to fire at is passed over (it holds), one with a single target has it picked. How it went: `GameSession.ordersWithShotToTake` (an enemy in range, rolling dice and in sight, `hasFireTarget`, or wire to remove), cached by `PassAndPlayMatch` per pair of snapshots as it's asked on every snapshot; `BattleState.noTarget` says which, and the screen says so for the person's side. A tank that takes ground with no enemy next to it gets no shot more. The only unit that can fire is picked too. Own tablets can't know: they're unchanged
- [x] The collision phase shows the Close Assault painting at the top of its column (`RevealView`, once units have collided)
