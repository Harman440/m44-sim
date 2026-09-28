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
- [ ] No page scroll on the game screens at 1280×800 and 800×1280: only lists (cards, history, the turn summary) scroll inside their own box
- [ ] Check each phase at both sizes, and the dialogs

### Step 37: Choosing a card
- [ ] Go back after a card is chosen: undo the pick in Órdenes while no order has been given (and give back a combat card played with it)
- [ ] Look at a card as a preview (full size, its rules and art) without playing it
- [ ] "Mostrar al rival" also shows the command card chosen, and the combat card played with it

### Step 38: Battle screen
- [ ] Rework the battle info so combat cards and coins stand out more (what's in hand, what can be played now, what it costs)
- [ ] **Decide:** the layout, from a mock-up first

## Part C: Firing and feel

### Step 39: A better fire questionnaire
- [ ] Start from the firing unit: show its type, terrain and what it may fire with
- [ ] Then pick the range, then only the protections that can apply
- [ ] Protections from the map: the app knows this side's terrain, not where the enemy is. **Decide:** tap the target's hex on the map (so its terrain answers the terrain question, and the range is counted), or keep asking

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
  3. Issue orders, then undo, then commit, then movement (open "Mostrar al rival"), then battle.
  4. Fire with a unit: the dice roll once, the unit shows as fired, and a reload doesn't bring the roll back.
  5. Sync a casualty on the map, end the battle, draw a card and start the next turn.
  6. Only the one new card animates in, and the deck and discard counts add up.
  7. Reload in each phase: the game resumes where it was.
