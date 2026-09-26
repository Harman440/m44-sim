# m44-sim roadmap

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

The house rules these steps come from are in [house-rules.md](house-rules.md). They were written for pen and paper a long time ago and may change, so every step that implements one starts by confirming it.

## Where we are

The full turn loop works on each player's device and survives reloads:
**Menu** → **Carta** (pick a command card) → **Órdenes** (move or hold units on the map, confirm) → **Movimiento** (show the map to the opponent, move the pieces) → **Batalla** (turn summary, fire questionnaire, dice, map sync) → **Final** (draw a card) → next turn. The attacking side plays turn 1 alone while the defender waits.

Done so far (details in git history):
- Steps 0–7: foundations, MUI, game-core tests, card flow, the `GameSession` store, ordering UX, unit sprites, battle helper, fire questionnaire, menu, Spanish UI, save/resume
- Step 8: firing is a commitment: one roll per unit, deliberate undo, "Tirada rápida", end-turn confirmation
- Step 9: refactor and dead-code cleanup
- Step 10: three selectable looks (Mapa de campaña, Caja del juego, Tienda de mando), icons, sound, motion
- Step 11: bunker, line of sight and sandbags in the fire questionnaire; official dice values kept
- Steps 12–14: installable offline app, Ajustes in game, smaller first download, turn log with "Historial" and JSON export
- Steps 16–18: the attacker's extra first turn, the Movimiento and Fase final phases, and collisions

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
- [ ] No combat cards or coins in the extra turn: enforce with `extraTurn` once Part E exists
- [x] Show who is attacking in the header ("Atacante"/"Defensor", "Turno 1 · extra") and the menu ("Ataca: …" on the scenario, and what it means for the chosen side)
- [x] **Decided:** the defender's app starts on a waiting screen (`TurnPhase.AWAIT_ATTACKER`, `WaitingView`) with an "Empezar turno 2" button

### Step 17: Movement and last phases
The house turn is Carta → Órdenes → **Movimiento** → Batalla → **Fase final**.
- [x] **Movimiento** (`MovementView`):
  - [x] a full-screen "Mostrar al rival" map with the orders (arrows and fire markers), to show the opponent (`OpponentMap`)
  - [ ] pay coins for combat cards (Part E)
  - [x] move the pieces on the table (a checklist beside the read-only map, with the number of units that fire)
- [x] **Fase final** (`EndOfTurnView`):
  - [ ] apply the retreats marked in battle (Step 19); for now a reminder to finish them on the table
  - [x] draw the command card ("Robar carta" shows the card drawn), with a reminder that the attacking side draws first; then "Empezar turno N"
  - [ ] choose a combat card or 2 coins (Part E)
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
- [ ] Split the battle summary into "Sin mover" (fire first) and "Movidas" (fire after)
- [ ] Show who shoots first: the attacking side, then alternating one unit at a time (done at the table)
- [ ] After each roll, tell the player it's the opponent's turn to fire ("Ahora dispara el rival")
- [ ] Retreats:
  - mark a retreat on a unit ("Retirada pendiente") instead of moving it straight away
  - apply all marked retreats at the end of the battle (Fase final)
  - a unit marked to retreat can't take ground
- [ ] Close assault that rolls a retreat: ask whether the attacker takes ground (armor overrun); only then is the retreat applied at once, and the attacker must take ground
- [ ] The unit forced to retreat may still battle from its new hex

### Step 20: Reading the roll (hits, retreats, coins)
Today the app shows the faces; the player works out what they mean.
- [ ] Ask the target's type (infantry, tank, artillery; more types in Step 29)
- [ ] After the roll, show the result:
  - hits: the matching unit symbol hits; a **grenade only hits in close assault** (house rule); **stars hit artillery in close assault**
  - retreats: the flags
  - coins: +1 per star (Part E), but not for a star that counted as a hit
- [ ] **Decide:** confirm the hit rules, since the grenade rule differs from official M44

---

## Part D: Command cards

### Step 21: The house command-card deck
Replace today's 8 test cards with the house deck ("Breakthrough" counts in house-rules.md).
- [ ] Card database: every original, changed and new card with its count, text, and art or diagram
- [ ] Engine support for the new card shapes:
  - quotas per section (General Advance: 2 each; Recon in Force: 1 each; Pincer: 2 each)
  - all units in one section, chosen on play (Assault, Infantry Assault; this also covers the "Infantry Assault-style" idea)
  - unit-type cards with a section choice
  - orders that can't move (Firefight)
  - extra movement (Infantry Assault +1 hex)
  - "fire twice or move 3" (Artillery Bombardment)
  - dice modifiers:
    - Armor Assault +1 in close assault
    - Firefight: +1 at range, −1 in close assault; the general rule says one less with an adjacent enemy
    - Finest Hour +1
    - Close Assault card +1
  - a card with no orders (Close Assault: all units in close assault fire after the enemy moves)
  - Direct from HQ, Move Out
- [x] **Decided:** Counter Attack is not in the game
- [ ] **Decide:**
  - what "on the move" means in this variant (units that may move and still fire?) and the "1 less on standard maps" rule
  - which sections Pincer uses
  - the final deck counts (the notes have several "(−1)" changes)

### Step 22: Drawing cards
- [ ] Gamble: when drawing, keep the card or discard it and draw another, which must be kept. **Decide:** is this a rule for every draw, or a card?
- [ ] Recon: draw 3 and choose 1. This replaces the "Coge 2 Cartas" debug button.
- [ ] Preparations: order 1 unit and take 3 coins and a combat card
- [ ] The attacking side draws first in the Fase final (Step 17)

---

## Part E: Coins and combat cards

### Step 23: Coins
- [ ] A coin counter in the header, saved with the game
- [ ] +1 coin per star rolled in combat, added automatically from the shots (not for other rolls, and not for a star that counted as a hit)
- [ ] End of turn: take 2 coins or a combat card (Step 24)
- [ ] Spending:
  - order one extra unit anywhere for 4 coins; it gets none of the command card's benefits, and it can be done several times per turn
  - Finest Hour: 1 coin per infantry, 2 per armor or artillery (max 4 orders)
- [ ] A ledger with undo, like battle edits
- [ ] No coins on the attacking side's extra first turn

### Step 24: Combat cards
- [ ] Database from house-rules.md: name, cost, phase (order, battle or command), text and count
- [ ] Combat deck; start with 2 cards; hand of at most 3 (swap one when drawing a fourth)
- [ ] Order combat cards: one per turn, chosen with the command card (face down), targets recorded on the map, paid in the movement phase
- [ ] Reaction (battle) cards: one per player per battle phase, paid immediately
  - the battle screen shows the reaction cards in your hand, and you can play one at any time while it's the opponent's turn to fire
  - Ambush, Out of Ammo, Out of Fuel and Shells Shortage work this way (the last three are reaction cards: the enemy unit can't fire, and with Out of Ammo/Out of Fuel it also moves; done at the table)
- [ ] End of turn: combat card or 2 coins (with Step 23)
- [ ] **Decide:**
  - the final card list, costs and counts (the notes list extra copies in brackets, and medic variants)
  - whether Ambush, Behind Enemy Lines, Barrage, Air Power, Medics and Dig In are combat cards or command cards

### Step 25: Map markers
Several cards need you to mark hexes on your map during orders.
- [ ] Marker tool on the orders map:
  - a barrage hex
  - an air power line (4 adjacent hexes)
  - air bombardment (2 hexes, not next to your own units)
  - a cross where a Sniper or Reinforcements will appear
- [ ] Lasting tokens on the board: sandbags (Dig In, Fortify) and camouflage
- [ ] Markers appear on the "Mostrar al rival" map (Step 17) and are saved

### Step 26: Combat card effects the app applies
- [ ] Dice:
  - Spotter: +1 for artillery
  - Street Fight: +1 on or next to a building
  - Explosives: +1 for infantry in close assault
  - Barrage: 4 dice, stars count, retreats can't be ignored
  - Air Power: 1 die per hex
  - Air Bombardment: 2 dice on 2 hexes
- [ ] Movement:
  - Frozen Ground: +1 hex
  - Armor Forward: ignore terrain
  - Rattenkrieg, House to House and Forest: move into that terrain and still battle
  - Reposition: artillery moves 2 after battle
  - Pull Back: retreat up to 2 before the enemy battles
- [ ] Orders:
  - Tactician: change the section of a section card
  - Behind Enemy Lines: fire and move before other attacks, with the move done in the retreat phase
  - Close Assault: fire after the enemy has moved
- [ ] Battle: Not a Step Back (ignore retreats), Heat of Battle (infantry overrun)
- [ ] **Decide when we get here:** a way to play Personal Armor (ignore 1 infantry the opponent rolled), Rifles Up! (fire before anyone else) and Behind Enemy Lines (fire and move before other attacks) without connecting the tablets

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
