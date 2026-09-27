# m44-sim roadmap

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

The house rules these steps come from are in [house-rules.md](house-rules.md). They were written for pen and paper a long time ago and may change, so every step that implements one starts by confirming it.

## Where we are

The full turn loop works on each player's device and survives reloads:
**Menu** → **Carta** (pick a command card) → **Órdenes** (move or hold units on the map, confirm) → **Movimiento** (show the map to the opponent, move the pieces) → **Batalla** (turn summary in firing order, fire questionnaire, dice) → **Final** (mirror casualties and retreats on the map, draw a card) → next turn. The attacking side plays turn 1 alone while the defender waits.

Done so far (details in git history):
- Steps 0–7: foundations, MUI, game-core tests, card flow, the `GameSession` store, ordering UX, unit sprites, battle helper, fire questionnaire, menu, Spanish UI, save/resume
- Step 8: firing is a commitment: one roll per unit, deliberate undo, "Tirada rápida", end-turn confirmation
- Step 9: refactor and dead-code cleanup
- Step 10: three selectable looks (Mapa de campaña, Caja del juego, Tienda de mando), icons, sound, motion
- Step 11: bunker, line of sight and sandbags in the fire questionnaire; official dice values kept
- Steps 12–14: installable offline app, Ajustes in game, smaller first download, turn log with "Historial" and JSON export
- Steps 16–18: the attacker's extra first turn, the Movimiento and Fase final phases, and collisions
- Step 19: firing order (units that didn't move first, enforced) and the map updated in the final phase
- Step 20: each roll is read against its target: hits, retreats and coins
- Step 21: the house command deck (57 cards) with its card rules: sections chosen on play, quotas per section, units on the move, points, no-move and close-assault cards
- Step 22: drawing cards: keep the card drawn or swap it once (Gamble), Recon draws 3 and keeps 1, Preparations reminds the player of its reward
- Step 23: coins: the counter and its ledger, stars earn coins, 2 coins or a combat card in the final phase, extra orders for 4 coins, Finest Hour paid in coins
- Step 24: combat cards: the house deck (53 cards), 2 to start and at most 3 in hand, order cards played with the command card, one battle card per battle, drawn in the final phase
- Step 25: map markers for combat cards (Barrage, Air Power, Air Bombardment, Sniper, Reinforcements) and reminders for tokens placed on the table
- Step 26: combat card effects: +1 die cards asked on the shot, attack cards rolled on the marked hexes, movement cards on the orders map, Tactician; the rest at the table with reminders

Two decisions shape the rest of the plan (Steps 15 and 27):
- **Each tablet stays independent** and knows only its own side. Anything that involves the opponent (alternating fire, collisions, cards that act on the other side) is done at the table, and the app reminds the player when.
- **No figure counts.** The app keeps tracking whole units. When a rule reduces a unit's firepower, the player picks how many of the rolled results to apply.

---

## Part A: App polish

### Step 12: Install on the tablet (PWA)
- [x] **Decided:** `vite-plugin-pwa` generates the service worker and manifest (`vite.config.ts`)
- [x] Web app manifest: name, `display: fullscreen`, any orientation, dark theme colour, icons (including a maskable one) so Chrome on Android offers "Instalar aplicación"
- [x] Offline: the service worker precaches everything the game uses: code, fonts (woff2), textures, sounds, icons and board art (45 files, 1.4 MB)
- [x] App icon in the war-room style (`public/icons/icon.svg`; `npm run icons` renders the PNGs)
- [x] "prompt" updates: "Nueva versión disponible" with "Actualizar" / "Más tarde", so the app never reloads mid-game (the game is saved anyway), plus "Lista para jugar sin conexión" once cached (`UpdatePrompt`)
- [x] `npm run tablet` builds and serves the real app on the network (port 4173); the README explains installing it
- [x] Checked in Chromium on the production build:
  - the service worker installs
  - offline reload: fonts, textures and board art load from the cache, and a game starts normally
  - deploying a changed build shows "Nueva versión disponible", and "Actualizar" loads it
- [ ] **Found:** service workers only run on HTTPS or `localhost`, so on `http://<IP>` the tablet needs a Chrome flag (README). **Decide:** keep the flag, or host the app on HTTPS (e.g. GitHub Pages, from the GitHub repo) so installing needs no flag
- [ ] Check on the real tablet: install from Chrome, then play a turn in airplane mode

### Step 13: Small polish
- [x] Change the look and sound during a game ("Ajustes" in the in-game menu, not only on the start menu)
- [x] Split the JS bundle (610 KB, 195 KB gzipped) so the first screen loads faster on the tablet: the game screen is lazy-loaded and preloaded from the menu, and react, MUI and motion are separate chunks. The menu now loads 151 KB gzipped (entry 20, react 59, MUI 72); the game screen adds 52 KB (game code 11, motion 41)
- [x] **Decided:** keep the placeholder SVGs for the tank and artillery sprites for now; real art can come later (from the player, or a free-licence source)

### Step 14: Turn log and turn data as JSON
The house rules' programming note says to start from the turn data as JSON; the save format already is JSON, so this builds on it.
- [x] Record each finished turn as plain JSON (`game-core/turnLog.ts`, `TurnRecord`): card played, orders (paths), shots (dice, steps and faces), map edits (casualties, retreats) with the unit type of each
- [x] "Historial" screen (in-game "Menú"): past turns, newest first
- [x] Export the game (the full save) or a single turn as a JSON file (for backups)
- [x] Keep it in the save (`SAVE_VERSION` 3; version 2 saves load with an empty history)

---

## Part B: How the two devices relate

### Step 15: The two tablets stay independent
- [x] **Decided:** no sharing or connection between the tablets. Each app knows only its own side; the opponent's actions happen at the table.
- [x] **Decided:** alternating fire is done at the table (Step 19 only reminds the player)
- [x] **Decided:** collisions get a "¿Ha habido un choque?" button in the battle phase (Step 18)
- [x] **Decided:** cards that act on the opponent: Counter Attack is removed; Out of Ammo, Out of Fuel and Shells Shortage are reaction cards (Step 24); the cards about the opponent's hand or orders come last (Step 33); the rest are worked out in Step 26

---

## Part C: Simultaneous turn structure

### Step 16: Attacking side and the extra first turn
- [x] Scenario data: which side attacks (`Scenario.attacker`; Forêt d'Écouves: Allies, who start with 5 cards to 3)
- [x] The attacking side plays one extra turn at the start (turn 1), played normally; the snapshot's `extraTurn` marks it
- [x] No combat cards or coins in the extra turn: enforced with `extraTurn` (Steps 23 and 24)
- [x] Show who is attacking in the header ("Atacante"/"Defensor", "Turno 1 · extra") and the menu ("Ataca: …" on the scenario, and what it means for the chosen side)
- [x] **Decided:** the defender's app starts on a waiting screen (`TurnPhase.AWAIT_ATTACKER`, `WaitingView`) with an "Empezar turno 2" button

### Step 17: Movement and last phases
The house turn is Carta → Órdenes → **Movimiento** → Batalla → **Fase final**.
- [x] **Movimiento** (`MovementView`):
  - [x] a full-screen "Mostrar al rival" map with the orders (arrows and fire markers), to show the opponent (`OpponentMap`)
  - [x] pay coins for combat cards (Part E): the order combat card is paid when chosen, and the movement phase reminds the player to show it
  - [x] move the pieces on the table (a checklist beside the read-only map, with the number of units that fire)
- [x] **Fase final** (`EndOfTurnView`):
  - [x] apply the retreats marked in battle (Step 19): made on the table, then mirrored on the map ("Actualizar mapa")
  - [x] draw the command card ("Robar carta" shows the card drawn); then "Empezar turno N"
  - [x] choose a combat card or 2 coins (Part E)
- [x] Add the phases to `TurnPhase` (`MOVEMENT`, `END_OF_TURN`, appended) and to the header steps (Carta, Órdenes, Movimiento, Batalla, Final). "Terminar batalla" leads to the final phase; the card is drawn with `drawCard()` there instead of in `endTurn()`
- [x] Tests for the new phase flow and for saves from before the change (`SAVE_VERSION` 4 adds the drawn card; version 3 saves carry on through the new phases)

### Step 18: Collisions
When two units cross the same hex, or land on the same one, they battle at once, before the normal battle.
- [x] A "¿Ha habido un choque?" button at the top of the battle phase (when a unit moved), with the reminder "Resuelve los choques antes que cualquier otro disparo"
- [x] It opens a collision dialog (`CollisionDialog`): pick the unit, see the dice, roll (`GameSession.fireCollision`, dice in `collisionSteps` in `fireQuestions.ts`):
  - close assault dice −1 (normally 3 − 1 = 2)
  - terrain ignored, both for battle restrictions and dice reductions
  - retreats can't be ignored (a reminder kept with the roll)
- [x] Explain the outcome after the roll:
  - the loser retreats or is eliminated; the winner stays, or keeps moving to its destination
  - if nobody retreats, both units move one hex back along their path (which may be blocked)
- [x] **Decided:** only units that moved and can fire this turn roll; a unit that moved too far to fire doesn't roll (the dialog still explains the outcome)
- [x] **Decided:** the card's close-assault bonus dice are added to a collision roll
- [x] **Decided:** a collision roll uses up the unit's shot for the turn

### Step 19: Battle order and retreats
- [x] Split the battle summary into "Sin mover" (fire first) and "Movidas" (fire after)
- [x] Show who shoots first: the attacking side, then alternating one unit at a time (done at the table)
- [x] After each roll, tell the player it's the opponent's turn to fire ("Ahora dispara el rival")
- [x] **Decided:** the order is enforced: moved units wait ("Espera") until every unit that didn't move has fired; "Pasar a las unidades movidas" gives up the remaining shots (`GameSession.skipUnmovedFire`, saved; `SAVE_VERSION` 5). Collisions don't wait: they come before any other shot
- [x] **Decided:** retreats aren't tracked in the app. The tablets aren't connected and flags hit enemy units, so the retreat markers, the overrun question and taking ground all happen at the table; the battle screen reminds the player (a marked unit may still fire but can't take ground)
- [x] **Decided:** removing and moving units moved from the battle to the Fase final ("Actualizar mapa", `EndOfTurnMap`), after the retreats are made on the table; the battle map ("Ver mapa") is read-only

### Step 20: Reading the roll (hits, retreats, coins)
- [x] Ask the target's type (infantry, tank, artillery; more types in Step 29): a fire question (`targetType`), on the quick roll (with "¿Está adyacente?") and in a collision. The shot keeps its target (`Shot.target`; older shots have none and show only the faces)
- [x] After the roll, show the result (`RollReading`, `readRoll` in `game-core/rollResult.ts`, rules in `data/hitRules.ts`), also in the battle summary and the Historial:
  - hits: the matching unit symbol hits; a grenade hits any unit; stars hit artillery in close assault (a collision counts as close assault)
  - retreats: the flags
  - coins: +1 per star, but not for a star that counted as a hit; not shown in the attacker's extra first turn. Only shown for now: Part E keeps the count
- [x] **Decided:** a grenade is a hit at any range, as in official M44 (the house note "only in close assault" is dropped)

---

## Part D: Command cards

### Step 21: The house command-card deck
Replace today's 8 test cards with the house deck ("Breakthrough" counts in house-rules.md).
- [x] Refactor first: cards describe their rules as data (`CommandCard`), and `game-core/orderRules.ts` works out the orderable units, order slots, move limits and orders left from the card and the orders given
- [x] Card database (`data/commandCards.ts`): 40 section cards (Recon, Probe, Attack and Assault for each section, Recon in Force, General Advance, Pincer) and 17 tactic cards (Move Out, Finest Hour, Direct from HQ, Artillery Bombardment, Infantry Assault, Close Assault, Armor Assault, Firefight, Preparations), each with its count and Spanish text. The card face is a diagram (sections, order count, tags for the special rules); no art yet
- [x] Engine support for the new card shapes:
  - quotas per section (General Advance: 2 each; Recon in Force: 1 each; Pincer: 2 left and 2 right)
  - all units in one section (Assault), or in a section chosen on play (Infantry Assault)
  - unit-type cards, with "1 unit of your choice" when none of that type are left
  - orders that can't move (Firefight), extra movement (Infantry Assault +1 hex, also for moving and firing), "fire twice or move 3" (Artillery Bombardment)
  - units on the move (Recon, Probe): 1 extra unit anywhere that can't fire
  - a points budget (Finest Hour: 4 points, infantry 1, tank or artillery 2)
  - dice modifiers: Armor Assault +1 in close assault, Firefight +1 at range and −1 in close assault, Finest Hour +1, Close Assault +1
  - a card with no orders (Close Assault): in the battle the player marks each unit adjacent to an enemy, which fires once, in close assault only
- [x] UI: pick the section when playing a card that needs one; pick which section's order a border unit takes (or put it on the move); the hold button says whether the unit will fire; the card played is shown while giving orders; "Marcar unidades" in the battle for Close Assault
- [x] **Decided:** Counter Attack is not in the game
- [x] **Decided:** a unit on a border hex can be ordered by either section it touches (left or center, center or right); for cards with quotas per section the player picks which section's order it takes
- [x] **Decided:** "on the move" (Recon, Probe): the player may order 1 extra unit anywhere, which may move but can't fire
- [x] **Decided:** Pincer orders 2 units on the left and 2 on the right
- [x] **Decided:** Infantry Assault's +1 hex also adds to how far infantry moves and still fires
- [x] **Decided:** Finest Hour is a 4-point budget (infantry 1, tank or artillery 2); the units ordered fire +1 die. Changed in Step 23: the orders cost coins
- [x] **Decided:** Behind Enemy Lines is a combat card, not in the command deck
- [x] **Decided:** a unit-type card with none of its units left orders 1 unit of any type, with no bonus
- [x] **Decided:** Close Assault: the player marks the units in close assault in the battle phase
- [x] **Decided (provisional):** deck counts are the notes' Breakthrough counts with the "(−1)" changes, which make a standard-size deck; the "1 less on standard maps" note is about these counts. Tune them in `data/commandCards.ts`

### Step 22: Drawing cards
- [x] Gamble: when drawing, keep the card or discard it and draw another, which must be kept ("Quedármela" / "Descartar y robar otra" in the Fase final; `GameSession.drawCard`, `keepCard`, `drawAgain`)
- [x] **Decided:** Gamble is a rule for every draw, not a card
- [x] Recon: draw 3 and choose 1 (`CommandCard.drawChoice`). The "Coge 2 Cartas" debug button is gone
- [x] **Decided:** only the Left/Center/Right Recon cards draw 3 (not Recon in Force), and choosing 1 of 3 replaces the gamble
- [x] Preparations: order 1 unit; the Fase final reminds the player to take 3 coins and a combat card at the table (`CommandCard.endOfTurnReward`; Step 23 adds the coins to the counter)
- [x] Saved: the cards drawn but not yet kept, and whether the first was swapped (`SAVE_VERSION` 8)
- [x] **Decided:** each tablet has its own command deck (the tablets don't connect), so nothing waits for the opponent to draw; the old "the attacking side draws first" reminder is gone

---

## Part E: Coins and combat cards

### Step 23: Coins
- [x] A coin counter in the header ("Monedas" dialog), saved with the game (`SAVE_VERSION` 9); numbers in `data/coinRules.ts`, each turn's ledger worked out in `game-core/coins.ts`
- [x] +1 coin per star rolled in combat, added automatically from the shots, collisions included (not for a star that counted as a hit); undoing the shot takes it back
- [x] End of turn: take 2 coins or a combat card ("Monedas o carta de combate" in the Fase final, needed before the next turn). Until Step 24 the combat card is taken at the table; Preparations adds its 3 coins by itself instead of the choice
- [x] Spending:
  - "Orden extra (4 monedas)" in the orders phase: any unit not yet ordered, as many times as the player can pay; it moves and fires like the unit, with none of the card's benefits (no bonus dice either). Undoing it gives the coins back
  - Finest Hour: 1 coin per infantry, 2 per tank or artillery, up to 4 orders; they're optional, so the player orders only what they want to pay for
- [x] **Decided:** Finest Hour's orders cost coins (replacing Step 21's free 4-point budget), max 4 orders
- [x] A ledger with undo: this turn's lines (orders, stars, final phase, by hand) in the "Monedas" dialog, where coins can also be paid or added by hand (e.g. a combat card played at the table) and the last change undone; each turn's lines are kept in the Historial
- [x] No coins on the attacking side's extra first turn: no stars, no choice in the Fase final, no changes by hand

### Step 24: Combat cards
- [x] Database (`data/combatCards.ts`, `CombatCard` in `game-core/combatCard.ts`): name, cost, phase (order or battle), Spanish text and count; 53 cards (23 order, 30 battle)
- [x] Combat deck (the generic `Deck`); start with 2 cards; hand of at most 3: drawing a fourth means discarding one, which may be the new one
- [x] Order combat cards: one per turn, picked on the card screen before the command card ("ponla boca abajo"), paid then; shown while giving orders (with "Quitar" until the orders are confirmed, which gives the coins back) and in the movement phase. Marking targets on the map comes in Step 25; until then the player notes them on paper
- [x] Battle (reaction) cards: one per battle phase, paid when played, with "Deshacer"; listed under the battle summary. The effects are resolved at the table (the app applies some in Step 26)
  - Ambush, Out of Ammo, Out of Fuel and Shells Shortage work this way
- [x] End of turn: combat card or 2 coins; the combat card is drawn when chosen, so the choice is then final. Preparations: "Robar carta de combate" along with its 3 coins
- [x] Deck types: `COMBAT_DECKS` holds the decks (only "standard" so far) and a scenario can name one per side (`Scenario.combatDecks`); what the other decks hold is decided once the app is finished
- [x] Saved (`SAVE_VERSION` 10) and in the Historial (cards played and drawn)
- [x] **Decided (Step 21):** Ambush, Behind Enemy Lines, Barrage, Air Power, Medics and Dig In are not in the command deck; they are combat cards
- [x] **Decided:** the deck is the player's set (39) with the extras in brackets (Ambush +2, Reinforcements +1, Medic +1, Infiltrators +1, Fortify +1) and 1 of each new card (Mechanic, Tactician, Barrage, Air Power, Personal Armor, Explosives, Shells Shortage, Rifles Up!): 53 cards. Counts are easy to tune in the data file
- [x] **Decided:** Heat of Battle costs 1 coin (the house rules gave no cost)
- [x] **Decided:** the command combat cards (Spies, HQ Distraction, Message Interception, Lost Message) stay out of the deck until Step 33
- [x] **Decided:** a battle card can be played at any time in the battle (the app can't tell whose turn it is to fire)

### Step 25: Map markers
Several cards need you to mark hexes on your map during orders.
- [x] Marker tool on the orders map ("Marcar en el mapa" on the order combat card, "Borrar última marca"); each card's rule is data (`CombatCard.marker`), checked in `game-core/markerRules.ts`:
  - a barrage hex (not on your own units)
  - an air power chain: 4 hexes, each next to the one marked before
  - air bombardment: 2 hexes, not on or next to your own units
  - a cross where a Sniper (an empty hex next to your infantry) or Reinforcements (any empty hex) will appear
- [x] **Decided:** every hex must be marked before the orders can be confirmed ("Quitar" on the card clears the marks)
- [x] **Decided:** lasting tokens (sandbags from Fortify, the camouflage badge) stay on the physical board; the final phase reminds the player to place them (`CombatCard.tableReminder`)
- [x] Markers are drawn as targets or crosses (numbered when there are several) on the orders, movement, "Mostrar al rival" and battle maps, saved (`SAVE_VERSION` 11) and listed in the Historial

### Step 26: Combat card effects the app applies
Each card's effect is data (`CombatCard.effect` in `data/combatCards.ts`); cards without one are resolved at the table.
- [x] Dice (battle cards, `diceBonus`): Spotter (+1 artillery), Street Fight (+1 infantry on or next to a building), Explosives (+1 infantry in close assault). Once played, the fire questions ask "¿la usas en este disparo?" when a unit that fits fires; it adds its die to that one shot (`Shot.combatBonus`), and undoing the shot frees it
- [x] Attacks (order cards, `attack`): Barrage 4 dice, Air Power 1 die per hex, Air Bombardment 2 dice per hex. The battle screen lists the marked hexes; for each the player says which enemy unit is there (or none) and the app rolls (`attackHex`). Stars hit, retreats can't be ignored, no coins. Units don't fire until every hex is rolled; a roll can be undone ("Anular tirada")
- [x] Movement (order cards, `move`): a "Usar …" toggle on the unit being ordered, for as many units as the card says (`Order.boosted`):
  - Frozen Ground: +1 hex (3 units)
  - Armor Forward: terrain doesn't stop the move (3 tanks; firing rules still apply)
  - House to House, Forest: move into a building / forest and still fire (1 infantry / 1 unit)
  - Rattenkrieg: 1 infantry on or next to a building moves up to 3 through any terrain, ends on a building and can fire
- [x] Orders: Tactician asks which section a one-section card orders instead (`cardNeedsSection` with the combat card)
- [x] **Decided:** the rest is resolved at the table with the card's text on screen, and a final-phase reminder when something must be mirrored on the map (Reposition, Pull Back, Behind Enemy Lines) or placed on the table (Fortify, Camouflage): Reposition, Pull Back, Not a Step Back, Heat of Battle, Behind Enemy Lines, Personal Armor, Rifles Up!, Ambush, Out of Ammo/Fuel, Shells Shortage, Medic, Mechanic, Return to Duty, Reinforcements, Sniper
- [x] Saved (`SAVE_VERSION` 12) and in the Historial (attack rolls)

---

## Part F: Figures and new units

### Step 27: No figure counts
- [x] **Decided:** figures aren't stored; the app keeps tracking whole units, and the table is the source of truth
- [x] **Decided:** Medic, Mechanic and Return to Duty are resolved at the table

### Step 28: Apply fewer results than were rolled
Covers the rules that reduce firepower because of figures (one-figure infantry fires at most 2 dice; limited damages: a unit keeps at most as many results as it has figures, +1 with a bonus-dice card).
- [ ] After a roll, "Aplicar menos resultados": the player taps the dice to keep, and the rest are shown as discarded
- [ ] The kept results are what the shot records, and what counts for hits and coins (Steps 20 and 23)
- [ ] The full roll stays visible for reference

### Step 29: New unit types
- [ ] Mobile artillery: 3 figures, hit like tanks, fires 3-3-2-2
- [ ] Jeep: 2 figures, fires 3-2, only grenades hit it
- [ ] Half-track: fires 3-2, moves 3 hexes
- [ ] For each: `UnitType`, movement, fire table, target-type hit rules (Step 20), sprites and scenario data
- [x] **Decided:** no Tigers
- [ ] **Decide:** anything the notes leave open (e.g. how far mobile artillery and jeeps move, whether half-tracks carry infantry)

---

## Part G: Air

### Step 30: Air rules
Large; split it into smaller steps when we get here.
- [ ] Air sorties: markers per scenario instead of air cards (the Air Power card is removed)
- [ ] Ordering a plane:
  - on a border hex of the card's section, or anywhere with Direct from HQ
  - ammo: 9 bullets for an attack plane, 3 bullets and 3 shells for a bomber
- [ ] Movement phase:
  - planes move 5 hexes and attack 3 adjacent hexes
  - ammo is returned if a hex had no enemy
  - bullets roll 1 die; bombs roll 1 die and stars count; retreats can't be ignored
- [ ] Dogfights; a plane blocks the hex it ends on; landing
- [ ] Ground fire: 3 dice against planes. Destroying a plane: a grenade hit plus a reroll hit (a flag on the reroll sends it away without a medal). A destroyed plane counts on the medal track, and that plane type can't be ordered again.
- [ ] Air cards in the combat deck (e.g. Pilot Initiative), and ordering a plane with Blitzkrieg Recon
- [ ] **Decide:** which parts to build first, and whether medals are tracked in the app at all

---

## Part H: Content and experiments

### Step 31: More scenarios
- [ ] More scenarios, each with its attacking side, air sorties, reinforcement table (for the Reinforcements card) and a data check
- [ ] The old board art (`defualt.png`) is in git history from before Step 9

### Step 32: Experiments (decide later)
- [ ] An 8-sided long-range die: tank, grenade, 3× infantry, retreat, 2× miss (the grenade doesn't count for infantry firing on a tank). Make sure one side gives a coin and one a retreat.
- [ ] Bigger units: infantry with 5 figures, tanks with 4 (a table rule; the app only needs changes if it affects dice)
- [ ] Fewer cards (more predictable) with more orders per card
- [ ] A deck-probability view: how likely each card type is to be drawn, for balancing (the probability notes in house-rules.md)

---

## Part I: Last

### Step 33: Cards about the opponent's hand and orders
Not important for gameplay, so they come last: Lost Message (the opponent loses 2 orders), Spies, HQ Distraction and Message Interception.
- [ ] A "Mostrar cartas al rival" button: shows your hand (or the cards you'll use) full screen, for the opponent to look at
- [ ] A "Perder cartas" / "Perder órdenes" button: discard the cards or give up the orders the opponent's card takes away
- [ ] Add these cards to the combat deck (Step 24)

### Step 34: Import a game
- [ ] "Importar partida" on the start menu: load a JSON file exported with "Exportar partida" (Step 14), check it with `GameSession.restore` and carry on from it

---

## Checks for every step
- `npm run typecheck` reports 0 errors, and `npx vitest run` passes.
- `npm run dev` (port 3000), then check the flow by hand or with Playwright, at 1280×800 and 800×1280 with touch, and on desktop, in at least one look:
  1. Menu → start a game; the initial hand deals in.
  2. Picking a card highlights the right units.
  3. Issue orders, then undo, then commit, then movement (open "Mostrar al rival"), then battle.
  4. Fire with a unit: the dice roll once, the unit shows as fired, and a reload doesn't bring the roll back.
  5. Sync a casualty on the map, end the battle, draw a card and start the next turn.
  6. Only the one new card animates in, and the deck and discard counts add up.
  7. Reload in each phase: the game resumes where it was.
