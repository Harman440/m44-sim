# m44-sim roadmap

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

The house rules these steps come from are in [house-rules.md](house-rules.md). They were written for pen and paper a long time ago and may change, so every step that implements one starts by confirming it.

## Where we are

The full turn loop works on each player's device and survives reloads:
**Menu** → **Carta** (pick a command card) → **Órdenes** (move or hold units on the map, confirm) → **Batalla** (turn summary, fire questionnaire, dice, map sync) → next turn.

Done so far (details in git history):
- Steps 0–7: foundations, MUI, game-core tests, card flow, the `GameSession` store, ordering UX, unit sprites, battle helper, fire questionnaire, menu, Spanish UI, save/resume
- Step 8: firing is a commitment: one roll per unit, deliberate undo, "Tirada rápida", end-turn confirmation
- Step 9: refactor and dead-code cleanup
- Step 10: three selectable looks (Mapa de campaña, Caja del juego, Tienda de mando), icons, sound, motion
- Step 11: bunker, line of sight and sandbags in the fire questionnaire; official dice values kept

The app currently tracks **whole units only** (no figure counts), and each device knows **only its own side**. Several steps below depend on changing one or both of these; they are flagged.

---

## Part A: App polish

### Step 12: Install on the tablet (PWA)
- [ ] Web app manifest (name, icons, `display: fullscreen`/`standalone`, landscape and portrait) so Chrome on Android offers "Instalar aplicación"
- [ ] Offline cache of the app and its assets (fonts, textures, sounds, board art) with a service worker
- [ ] An app icon in the war-room style
- [ ] "Nueva versión disponible" prompt when an update is deployed
- [ ] **Decide:** add `vite-plugin-pwa` (generates the service worker), or write a small service worker by hand
- [ ] Check: install from Chrome on Android, then play a turn in airplane mode

### Step 13: Small polish
- [ ] Change the look and sound during a game ("Ajustes" in the in-game menu, not only on the start menu)
- [ ] Split the JS bundle (610 KB, 195 KB gzipped) so the first screen loads faster on the tablet
- [ ] Real art for the tank and artillery sprites (placeholder SVGs today). **Decide:** where the art comes from (you supply it, or a free-licence source)

### Step 14: Turn log and turn data as JSON
The house rules' programming note says to start from the turn data as JSON; the save format already is JSON, so this builds on it.
- [ ] Record each finished turn as plain JSON: card played, orders (paths), shots (dice and faces), map edits (casualties, retreats)
- [ ] "Historial" screen: past turns, newest first
- [ ] Export the game or a single turn as a JSON file (for backups and for Step 15)
- [ ] Keep it in the save (bump `SAVE_VERSION`)

---

## Part B: How the two devices relate

### Step 15: Decide how the two tablets share information
Many house rules need both sides at once: who fires first, collisions when units cross, coins spent, effects on the opponent's cards. Each device only knows its own side today.
- [ ] **Decide** one of:
  - **Independent** (as now): each app guides its player and asks about the opponent when needed ("¿El rival disparó ya?")
  - **Swap after orders**: at the movement phase each tablet shows a QR code (or file) with its orders, and the other scans it. That's the digital version of "show your opponent your map".
  - **Live connection** between the two tablets (local network or WebRTC). The most automatic option, but it needs a small server or pairing step.
- [ ] Record which later steps become automatic with the chosen option (collisions in Step 18, fire order in Step 19, opponent-card effects in Step 26)

---

## Part C: Simultaneous turn structure

### Step 16: Attacking side and the extra first turn
- [ ] Scenario data: which side attacks (the side that normally starts)
- [ ] The attacking side plays one extra turn at the start, played normally, but it can't take combat cards or coins
- [ ] Show who is attacking in the header and the menu
- [ ] **Decide:** what the defender's app shows during that extra turn (wait screen, or it simply starts at turn 2)

### Step 17: Movement and last phases
The house turn is Carta → Órdenes → **Movimiento** → Batalla → **Fase final**.
- [ ] **Movimiento:**
  - a full-screen "Mostrar al rival" map with the orders (arrows and fire markers), to show the opponent
  - pay coins for combat cards (Part E)
  - move the pieces on the table
- [ ] **Fase final:**
  - apply the retreats marked in battle (Step 19)
  - draw the command card, attacking side first
  - choose a combat card or 2 coins (Part E)
- [ ] Add the phases to `TurnPhase` (append only; the values are saved) and to the header steps
- [ ] Tests for the new phase flow and for saves from before the change

### Step 18: Collisions during movement
When two units cross the same hex, or land on the same one, they battle at once.
- [ ] A "Choque" action on a unit in the movement phase that opens the fire dialog preset for this case:
  - close assault dice −1 (normally 3 − 1 = 2)
  - terrain ignored, both for battle restrictions and dice reductions
  - retreats can't be ignored
- [ ] Guide the outcome:
  - the loser retreats or is eliminated; the winner stays, or keeps moving to its destination
  - if nobody retreats, both units move one hex back along their path (which may be blocked)
- [ ] Detect collisions automatically if Step 15 chose "swap" or "live"

### Step 19: Battle order and retreats
- [ ] Split the battle summary into "Sin mover" (fire first) and "Movidas" (fire after)
- [ ] Show who shoots first: the attacking side, then alternating one unit at a time
- [ ] **Decide:** how the app tracks alternating shots without the opponent's device (a "Turno del rival" prompt, or nothing)
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
- [ ] **Decide:**
  - what "on the move" means in this variant (units that may move and still fire?) and the "1 less on standard maps" rule
  - which sections Pincer uses
  - how Counter Attack works without the opponent's card (honour system, or Step 15 sharing)
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
- [ ] Cards that act on the opponent show as reminders unless Step 15 connects the devices: Lost Message, Out of Ammo, Out of Fuel, Shells Shortage, Personal Armor, Spies, HQ Distraction, Message Interception

---

## Part F: Figures and new units

### Step 27: Decide whether to track figures
Today the app tracks whole units, and the physical table is the source of truth. Several house rules need figure counts: one-figure infantry, limited damages, Medic, Mechanic, Return to Duty, Tiger hits, and the unit sizes of the new units.
- [ ] **Decide:** track figures per unit on your own side (yes / no)
- [ ] If yes:
  - figures on `Unit`, with defaults per type from scenario data
  - "−1 figura / +1 figura" on the battle map
  - figure pips on the tokens
  - saved with the game
  - update the "whole units only" convention in CLAUDE.md

### Step 28: Firepower limited by figures
- [ ] Infantry with one figure left fires at most 2 dice, after all modifiers
- [ ] Limited damages: after the roll, a unit keeps at most as many results as it has figures (+1 when a card gave bonus dice); the player picks which results to keep
- [ ] **Decide:** confirm both rules; they need Step 27

### Step 29: New unit types
- [ ] Mobile artillery: 3 figures, hit like tanks, fires 3-3-2-2
- [ ] Tiger: 3-3-3-2 if it didn't move; a reroll hits on tank or grenade; after the first hit it moves only 1 hex; the second hit destroys it
- [ ] Jeep: 2 figures, fires 3-2, only grenades hit it
- [ ] Half-track: fires 3-2, moves 3 hexes
- [ ] For each: `UnitType`, movement, fire table, target-type hit rules (Step 20), sprites and scenario data
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
- [ ] Bigger units: infantry with 5 figures, tanks with 4
- [ ] Fewer cards (more predictable) with more orders per card
- [ ] A deck-probability view: how likely each card type is to be drawn, for balancing (the probability notes in house-rules.md)

---

## Checks for every step
- `npm run typecheck` reports 0 errors, and `npx vitest run` passes.
- `npm run dev` (port 3000), then check the flow by hand or with Playwright, at 1280×800 and 800×1280 with touch, and on desktop, in at least one look:
  1. Menu → start a game; the initial hand deals in.
  2. Picking a card highlights the right units.
  3. Issue orders, then undo, then commit, then battle.
  4. Fire with a unit: the dice roll once, the unit shows as fired, and a reload doesn't bring the roll back.
  5. Sync a casualty on the map, then end the turn.
  6. Only the one new card animates in, and the deck and discard counts add up.
  7. Reload in each phase: the game resumes where it was.
