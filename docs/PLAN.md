# m44-sim roadmap

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done.

The current loop is **PICK_CARDS** (CardsView) → **ORDER_UNITS** (OrdersView → Board / Hexagon / Unit / Order) → **BATTLE** (placeholder).

---

## Known issues

### Bugs
- [ ] **B1. Command cards leak out of the game.** `GameView.handleFinsihTurn` removes the played card from the hand but never calls `deck.discard()`. The 9-card deck runs dry after about 6 turns, and reshuffling then finds nothing to reshuffle.
- [ ] **B2. Cards from "Coge 2 Cartas" never show up.** `chooseCard` and `drawCard` in CardsView call `commandCardsPlayer.add()`, but the hand now renders `visibleHand`, which only the mount effect fills. This was introduced by the uncommitted deal animation.
- [ ] **B3. The whole hand is dealt again every turn.** CardsView unmounts during ORDER_UNITS, so on remount `visibleHand` and `hasDealtInitialCards` reset and every card animates in again. Only the newly drawn card should animate.
- [ ] **B4. You can click "Coge 2 Cartas" repeatedly.** Each click draws 2 more cards, and the previous choice cards are lost from the deck for good.
- [ ] **B5. The order path is computed backwards, after the move.** OrdersView calls `getPathToDestination(hex /*dest*/, unitHexPosition /*start*/)` after `moveUnit`. That is why OrderComponent has the note "points seem to be backwards". It will break once terrain costs become asymmetric. Compute the path from start to destination *before* moving.
- [ ] **B6. Once a unit is selected, it can't be deselected.** Clicking the same hex issues a "stay and fire" order, and clicking anywhere else does nothing.
- [ ] **B7. Card ids collide when `count > 1`**, which gives duplicate React keys. The choice-card `<div>` wrapper in CardsView is also missing its `key`.

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

### Step 1: Tests for game-core, before refactoring
- [ ] `Hand`: add, remove, getCards
- [ ] `Hex`: neighbors on even and odd rows, section assignment, terrain rules (forest and town stop movement and block move-and-fire)
- [ ] `BoardManager`: Axis flip, `setOrderableUnits` for each card type (including the cap when fewer units are available), pathfinding around units and stop terrain, `moveUnit`

### Step 2: Finish the card-selection work (B1–B4, B7)
- [ ] Deal only newly added cards (keep track of which card ids have already been dealt at GameView level, so it survives a remount)
- [ ] Make choose and draw add to what's rendered
- [ ] Disable the choice button while a choice is pending
- [ ] Discard played cards at end of turn
- [ ] Make card ids unique and fix the missing keys
- [ ] Remove the debug logs in CardsView, GameView and Deck

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
