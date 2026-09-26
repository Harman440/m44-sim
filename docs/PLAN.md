# m44-sim roadmap

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done.

The current loop is **PICK_CARDS** (CardsView) → **ORDER_UNITS** (OrdersView → Board / Hexagon / Unit / Order) → **BATTLE** (placeholder).

---

## Known issues

### Bugs
- [x] **B1. Command cards leak out of the game.** `GameView.handleFinsihTurn` removes the played card from the hand but never calls `deck.discard()`. The 8-card deck runs dry after about 6 turns, and reshuffling then finds nothing to reshuffle.
- [x] **B2. Cards from "Coge 2 Cartas" never show up.** `chooseCard` and `drawCard` in CardsView call `commandCardsPlayer.add()`, but the hand now renders `visibleHand`, which only the mount effect fills. This was introduced by the uncommitted deal animation.
- [x] **B3. The whole hand is dealt again every turn.** CardsView unmounts during ORDER_UNITS, so on remount `visibleHand` and `hasDealtInitialCards` reset and every card animates in again. Only the newly drawn card should animate.
- [x] **B4. You can click "Coge 2 Cartas" repeatedly.** Each click draws 2 more cards, and the previous choice cards are lost from the deck for good.
- [ ] **B5. The order path is computed backwards, after the move.** OrdersView calls `getPathToDestination(hex /*dest*/, unitHexPosition /*start*/)` after `moveUnit`. That is why OrderComponent has the note "points seem to be backwards". It will break once terrain costs become asymmetric. Compute the path from start to destination *before* moving.
- [ ] **B6. Once a unit is selected, it can't be deselected.** Clicking the same hex issues a "stay and fire" order, and clicking anywhere else does nothing.
- [x] **B8. `BoardManager.reset()` didn't rebuild the section groups**, so section cards marked units on the old board. Fixed in Step 1.
- [ ] **B9. `setOrderableUnits` never clears earlier orderable flags.** Playing a second card without committing leaves the first card's units orderable too. Fix it with the reducer in Step 3.
- [ ] **B10. A "hold and fire" order draws a NaN arrow.** Start and end are the same hex, so the direction vector has length 0 and the console fills with SVG `NaN` errors. Draw a marker instead of an arrow. Belongs to Step 4.
- [ ] **B11. The orders screen briefly shows "órdenes restantes: 0"** before its effect sets the real count, so "Confirmar Órdenes" flashes on entry. Initialize the count directly. Belongs to Step 3 or 4.
- [x] **B12. Once the discard pile had a card, its "?" overlay covered the whole page** (`.discard-pile` had no `position: relative`) and blocked "Coge 2 Cartas". Fixed in Step 2.
- [x] **B13. The choice cards overflowed their fixed-size frames** and covered the deck label. Fixed in Step 2.
- [x] **B7. Card ids collide when `count > 1`**, which gives duplicate React keys. The choice-card `<div>` wrapper in CardsView is also missing its `key`.

### Architecture / quality
- [ ] **Q1. Mutable class instances live inside React state.** `Hand.add` and `Deck.draw` mutate in place, and Board re-reads `boardManager` directly. The UI only updates because some other setState happens to fire at the same time. Replace this with a single GameState plus a `useReducer`.
- [ ] **Q2. Every unit uses the infantry sprite.** Showing only your own faction's units is intended: this is a companion tool.
- [ ] **Q3. Code is duplicated:**
  - [ ] the hex-to-pixel math appears in both `Board.getHexCenter` and `renderBoard`
  - [ ] there is a `UnitType` string union in `types/scenario.ts` and a `UnitType` enum in `game-core/unit.ts`
  - [ ] the per-faction initial hand size is hardcoded in `App.tsx`, although `ScenarioSettings` exists for it
- [ ] **Q4. Leftover cruft:**
  - [ ] `console.log` calls everywhere
  - [ ] CSS classes that look like Tailwind but aren't backed by Tailwind
  - [ ] an unused `use` import in OrdersView
  - [ ] an empty `Menu.tsx` and a stray `src/board.html`
  - [ ] a CRA boilerplate README, `<title>My App</title>` and a missing `/vite.svg` favicon
- [ ] **Q5. UI text mixes Spanish and English.** The target is all Spanish.

---

## Steps

### Step 0: Foundations
- [x] Add `CLAUDE.md`, `docs/PLAN.md` and `.mcp.json` (playwright, context7, chrome-devtools)
- [x] Delete the `aiCardgame/` prototype, which caused all 15 `tsc` errors
- [x] Add the `typecheck` and `test` scripts; add Vitest + jsdom; move testing-library to devDependencies
- [x] Add a first smoke test (`src/game-core/deck.test.ts`)
- [x] Remove the dead `cli` script and add `/dist` to `.gitignore`
- [ ] Rewrite the README, fix `index.html` (title, favicon) and delete `src/board.html` (Q4)

### Step 0.5: MUI
- [x] Install MUI 9 + Emotion; add the dark theme (`src/theme.ts`) with `ThemeProvider` and `CssBaseline`
- [x] Convert the GameView and OrdersView buttons and text to MUI (Spanish text)
- [x] Remove the dead `GameView.css`
- [x] Convert the CardsView controls ("Coge 2 Cartas", header, pile labels) to MUI during Step 2

### Step 1: Tests for game-core, before refactoring
- [x] `Hand`: add, remove, getCards (`hand.test.ts`)
- [x] `Hex`: neighbors on even and odd rows (plus symmetry across the whole board), section assignment, terrain rules (`hex.test.ts`)
- [x] `BoardManager`: Axis flip (a one-to-one mapping of the board onto itself), `setOrderableUnits` for each card type with the cap, pathfinding around units and stop terrain, move-and-fire destinations, `moveUnit`, `reset` (`BoardManager.test.ts`)
- [x] Scenario data: every position is on the board and every unit gets its own hex (`src/data/scenarios.test.ts`)
- [x] Fixed B8, found by these tests

### Step 2: Finish the card-selection work (B1–B4, B7)
- [x] Deal only newly added cards (GameView keeps `dealtCardIds`, so it survives a remount)
- [x] Make choose and draw add to what's rendered (drawing at end of turn now animates too)
- [x] Disable the choice button while a choice is pending; block playing a card until you've chosen
- [x] Discard played cards at end of turn (a full 8-turn run in the browser keeps hand + deck + discard = 8 and reshuffles correctly)
- [x] Make card ids unique and fix the missing keys
- [x] Remove the debug logs in CardsView, GameView, Deck and commandCards
- [x] Tests: `CardsView.test.tsx` (dealing, choice flow) and `commandCards.test.ts` (unique ids)
- [x] Fixed B12 and B13, found in the browser
- [ ] **Decide:** can "Coge 2 Cartas" be used any number of times per turn? Right now it can, so the hand keeps growing

### Step 3: Game state refactor (Q1)
- [ ] `game-core/gameState.ts` with a pure reducer: `PICK_CARD`, `ISSUE_ORDER`, `UNDO_ORDER`, `COMMIT`, `START_BATTLE`, `END_TURN`
- [ ] GameView uses `useReducer`; views get state plus dispatch
- [ ] Delete `game-core/deprecated/`
- [ ] Reducer tests

### Step 4: Ordering UX (B5, B6, Q3)
- [ ] Compute the path before moving and remove the "backwards" workarounds in OrderComponent
- [ ] Deselect/cancel a selected unit, with a separate "hold and fire" action
- [ ] Flash a hex on an invalid click
- [ ] Lock the board after orders are committed, with a visible indicator
- [ ] Merge the duplicated hex-to-pixel math into one helper

### Step 5: Units and board (Q2, Q3)
- [ ] Sprites for each unit type (infantry, tank, artillery)
- [ ] Move initial hand sizes and the scenario image into scenario data
- [ ] Sync the board back to the physical table: tap to remove a unit when it's killed, and tap to move a unit after a retreat

### Step 6: Battle-phase helper
- [ ] Decide the scope together first
- [ ] Show a summary of this turn's orders (who fires, and whether after a move) to carry out on the table
- [ ] Dice roller (optional)

### Step 7: Menu and polish (Q5)
- [ ] Scenario and faction picker (`Menu.tsx`)
- [ ] All UI text in Spanish
- [ ] Visual polish, with the layout sized for a phone or tablet next to the board
- [ ] Shrink or convert the large PNG assets (1.8–2.7 MB each) to WebP

---

## Checks for every step
- `npm run typecheck` reports 0 errors, and `npx vitest run` passes.
- `npm run dev` (port 3000), then check the flow by hand or with Playwright MCP:
  1. The initial hand deals in.
  2. Picking a card highlights the right units.
  3. Issue orders, then undo, then commit, then battle, then end turn.
  4. Only the one new card animates in.
  5. The deck and discard counts add up to the total number of cards minus the hand.
