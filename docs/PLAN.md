# m44-sim roadmap, part 2

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

The first plan (Steps 0–34) is finished and kept in [oldPlans/PLAN.md](oldPlans/PLAN.md); commits and code comments that mention a step number up to 34 refer to it. This plan carries on from Step 35. It comes from the notes in [FoundBugs.md](FoundBugs.md), which is the inbox: new findings go there first, then into a step here. The house rules are in [house-rules.md](house-rules.md).

## Where we are

The full turn loop works on each player's device and survives reloads: Menu → Carta → Órdenes → Movimiento → Batalla → Final → next turn, with the attacker's extra first turn, the house command and combat decks, coins, combat card effects and the long-range die. Three scenarios: Forêt d'Écouves, Arracourt and Sainte-Mère-Église (official map, with hedgerows, a hill and the paratrooper drop).

The two decisions from the first plan still hold:
- **Each tablet stays independent** and knows only its own side. Anything about the opponent is done at the table, and the app reminds the player when.
- **No figure counts.** The app tracks whole units.

---

## Part A: Bugs

### Step 35: Known bugs
- [x] Tactician can still be played with a card that orders several sections (like General Advance): it's paid for but does nothing, and the app doesn't warn. The session refuses it (`combatCardFits`), and the cards screen warns and offers to play the command card alone
- [x] A dice combat card isn't offered on a "Tirada rápida" shot, because there the player enters the dice. The quick roll now asks whether to use it and adds its dice to the number entered
- [x] Reinforcements and Sniper can't add their unit to the map: the cross marks where it goes, but nothing appears
  - [x] **Decided:** Sniper is taken out of the game (the player doesn't want snipers)
  - [x] **Decided:** Reinforcements: in the final phase the app rolls the die, reads the scenario's table and puts the unit on the cross (`rollReinforcements`). If the cross was taken by then, the player taps an empty hex (`placeReinforcement`). The new unit is a battle edit, so "Deshacer" takes it off again

## Part B: Screens

### Step 36: Everything fits on the screen
- [x] No page scroll on the game screens in landscape: the game screen is one screen high (`GameView.css`), and only lists (the hand, combat cards, the turn summary, a crowded controls column) scroll inside their own box. Cards: title and small piles in one row, hand on the left, combat cards in a column. Battle: turn summary on the left, who fires first and the combat cards on the right. Final phase: the three steps side by side
- [x] Checked each phase and the dialogs at 1280×800, 1024×768, 1366×768 and 1920×1080
- [ ] **Later:** portrait (800×1280) still scrolls the page; the player asked to leave it for now. The menu also still scrolls at 800px high

### Step 37: Choosing a card
- [x] Go back after a card is chosen: "Cambiar carta" in Órdenes while no order has been given (`unpickCard`; a combat card played with it goes back to the hand, and its coins come back)
- [x] Look at a card as a preview without playing it: tapping a card in the hand puts it on the table with its full text (`CardDetails`); a command card is played from there ("Jugar esta carta"), an order combat card is picked there ("Jugarla con la carta de mando"). The final phase shows the drawn cards the same way
- [x] "Mostrar al rival" also shows the command card chosen, and the combat card played with it
- [x] Also: playing-card shaped cards (5:7, sized from `--card-width`) held in a fanned hand (`CardHand`) that scrolls sideways, with the combat cards on the right
- [x] Movement phase redesign: "Mostrar al rival" is gone; the command card and order combat card played sit above the instructions, and tapping one shows its full text
- [x] No UI text refers to physical cards: the app replaces them (no "boca abajo en la mesa", "Descubre tu carta", "cartas que juegues en la mesa")

### Step 38: Battle screen
- [x] Rework the battle info so combat cards and coins stand out more (what's in hand, what can be played now, what it costs)
- [x] **Decided** (mock-up option A): the fire order as a tight list on the left, the reserve (coins and battle combat cards) filling the rest of the screen. The reserve's coin count replaces the header counter in the battle
- [x] Fire order as numbered steps: 1 collisions, 2 an attack combat card (Barrera…) as rows per marked hex, 3 units that didn't move, 4 moved units. Each row shows the unit, its hex (a thumbnail of the board art) and its section as icons, not how far it moved; tapping the row opens the fire dialog (no "Disparar" button)
- [x] Instructions and long warnings go into an "Instrucciones" dialog; only a short "who fires first" chip stays on screen
- [x] No command card summary; "Ver mapa" looks like Movimiento, with the cards played (command card and order combat card) above, tappable for their full text

## Part C: Firing and feel

### Step 39: A better fire questionnaire
- [x] Taking ground: armour that wins a close assault can take ground and fire again; infantry can too only with Fragor del combate. **Decided:** the extra shot is close assault only (from the hex taken), once per unit per turn. Offered in the fire dialog after a close assault ("Tomar terreno"), and said in the battle's "Instrucciones"
- [x] Start from the firing unit: its hex, range and dice at each distance in the fire dialog's title
- [x] **Decided:** tap the target's hex on the map. The dialog shows the part of the board in range, with the hexes it can fire at (in range, in sight, dice > 0) and their dice; the tap answers the distance and terrain, then the unit type (with the unit art) and sandbags (a toggle) in the same dialog, and the dice add up as they're answered
- [x] **Decided:** line of sight from the terrain (forest, town, hill, hedgerow) and this side's units in between; enemy units in between can't be known, so the player still checks the table. The quick roll stays for anything the map can't answer (a bunker, a target the app thinks is hidden)

### Step 40: Dice and coin animations
- [ ] Better dice roll animations, and different dice (the 8-sided long-range die looks like its own die)
- [ ] Coins animate when earned or spent (the counter, and in the ledger)
- [ ] Respect reduced motion; keep sounds optional

## Part D: Rules

### Step 41: Coins on the attacker's extra turn
- [ ] The attacker earns coins on the extra first turn but can't spend them
- [ ] **Decide:** which coins count (stars rolled, the final-phase reward), and whether the defender gets anything in return

## Part E: Maps and scenarios

### Step 42: More terrain
- [x] Card art: command and combat cards drawn from their rules (commit `d2b7015`)
- [x] Hills drawn by `npm run board` (`scripts/terrain-tiles.mjs`)
- [x] Hedgerows: `HexType.HEDGEROW` with the official rules (enter only from an adjacent hex and stop, no firing that turn, leave 1 hex; infantry −1, tanks −2) and their art
- [x] Sainte-Mère-Église, the official base-game scenario, with its paradrop (`Scenario.paradrop`, the PARADROP phase)
- [ ] Rivers: the art is drawn (a stony river from any edge to any other). Officially a river is impassable except at a bridge, so it also needs a bridge tile
- [ ] **Decide:** river and bridge rules in the house variant, then a scenario that uses them (e.g. Pegasus Bridge)
- [ ] **Decide:** the Sainte-Mère-Église reinforcement table is a proposal (grenade and star → infantry, flag → none), like the other two

### Step 43: Scenario tools
- [ ] A map editor in the app: paint terrain and place units on the board, save as a scenario
- [ ] Import a scenario from a PDF or a map image. Sainte-Mère-Église was read by hand from the map image with a hex grid laid over it; **Decide:** how much of that to automate, and whether a scenario file format (e.g. the official editor's `.m44` JSON) is worth reading

## Part F: The deck

### Step 44: Deck visualizer
- [ ] A view of the command deck: every card, how many copies, and how likely each kind is to be drawn (the probability notes in house-rules.md)

### Step 45: A smaller deck
- [ ] Fewer cards, split into two decks, so each card turns up more often and the game is less random
- [ ] **Decide:** how the deck is split, and which cards stay

## Part G: Carried over from the first plan (postponed)

- New unit types: mobile artillery, jeep, half-track (old Step 29)
- Air rules and air sorties per scenario (old Step 30)
- Cards about the opponent's hand and orders: "Mostrar cartas al rival", "Perder cartas" (old Step 33)
- "Importar partida" from an exported JSON (old Step 34)
- Experiments: bigger units, fewer cards with more orders (old Step 32)
- Open decisions: the Écouves and Arracourt reinforcement tables; host the app on HTTPS so installing needs no Chrome flag; check install and airplane mode on the real tablet (old Step 12)

---

## Checks for every step
- `npm run typecheck` reports 0 errors, and `npx vitest run` passes.
- `npm run dev` (port 3000), then check the flow by hand or with Playwright, at 1280×800 and 800×1280 with touch, and on desktop, in at least one look:
  1. Menu → start a game; the initial hand deals in.
  2. Picking a card highlights the right units.
  3. Issue orders, then undo, then commit, then movement (the cards played show above the instructions), then battle.
  4. Fire with a unit: the dice roll once, the unit shows as fired, and a reload doesn't bring the roll back.
  5. Sync a casualty on the map, end the battle, draw a card and start the next turn.
  6. Only the one new card animates in, and the deck and discard counts add up.
  7. Reload in each phase: the game resumes where it was.
