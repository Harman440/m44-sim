# m44-sim roadmap

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

## Where we are

The full turn loop works and is saved across reloads:
**Menu** → **PICK_CARDS** (CardsView) → **ORDER_UNITS** (OrdersView) → **BATTLE** (BattleView: turn summary, fire questionnaire, free dice, map sync) → next turn.

Health at the time of writing: `npm run typecheck` reports 0 errors, and `npx vitest run` passes 156 tests in 19 files. Steps 0–7 of the previous plan (foundations, MUI, game-core tests, card flow, `GameSession` store, ordering UX, unit sprites, battle helper, fire questionnaire, menu, Spanish UI, save/resume) are done. See the git history for details.

---

## Step 8: Firing is a commitment

A shot works like the table: once the dice are rolled, that unit has fired this turn and the result stands.

- [x] **game-core:** `GameSession.fire(orderIndex, answers)` works out the dice from the questionnaire and rolls them; `fireQuick(orderIndex, dice)` rolls a number the player chose. Both refuse outside BATTLE, for an order that can't fire, for a removed unit, or once the unit has used its shots (`shotsLeft`). The random source is a constructor option (`random`).
- [x] Snapshot: `shots` (order index, calculation steps, dice, faces) and `firesPerUnit`, cleared by `endTurn`
- [x] Saving: shots are in `SavedGame`, and `SAVE_VERSION` is 2. Version 1 saves are read as "nobody has fired yet".
- [x] `FireDialog`:
  - the calculation ends with "Disparar N dados" (or "Registrar disparo sin efecto" for 0 dice) and the line "No se puede repetir la tirada."
  - after rolling it shows the result only; reopening the unit shows the stored shot
- [x] **Decided:** the free roll belongs to the unit. "Tirada rápida" in the fire dialog lets a player who already knows the count pick 1–6 dice; it counts as that unit's shot. The standalone "Tirada libre" panel is gone.
- [x] **Decided:** a shot can be undone, but only deliberately: "Anular disparo" (a small link in the result), then a confirmation screen where "Anular disparo" stays disabled until "Confirmo que fue un error" is ticked (`GameSession.undoShot`)
- [x] **Decided:** a card with `numFireTimes` > 1 lets each unit fire that many times ("Disparar otra vez (queda N)")
- [x] `TurnSummary`: "N por disparar · M dispararon · K no pueden disparar"; a fired unit shows "Disparó: 2 × Infantería · 1 × Granada" and "Ver tirada"
- [x] "Terminar Turno" asks for confirmation and warns "Quedan N unidades sin disparar"
- [x] Tests: `gameSession.test.ts` (firing rules, illegal cases, undo, `numFireTimes`, save/restore, version 1 saves), `FireDialog.test.tsx`, `BattleView.test.tsx`, `turnSummary.test.ts`, `labels.test.ts`
- [ ] Later (Step 10): show "fired" on the map too. The unit's red ready-to-fire glow stays on after it fires.

## Step 9: Refactor and cleanup

Nothing here changes behaviour. Do it before the visual work so the restyle touches less code.

### Shared types and helpers
- [ ] **R1. `Faction` type.** A faction is a bare `string` ("Allies"/"Axis") in `BoardManager`, `GameSession`, `Board`, `UnitComponent` and every view, while `type Faction` lives in `Menu.tsx`. Move it to `src/types/` and use it everywhere. `BoardManager` then no longer needs its runtime check with `console.error`.
- [ ] **R2. Position helpers.** `samePosition` is copied in `gameSession.ts`, `OrdersView.tsx` and `BattleMap.tsx`, and the same comparison is written inline in `Board`, `turnSummary.ts` and `OrderComponent`. `"row-col"` keys are built in `hex.ts`, `BoardManager` and `gameSession.ts`. Put `samePosition`, `positionKey` and `includesPosition` in one module (e.g. `src/game-core/position.ts`).
- [ ] **R3. Labels layering.** `storage.ts` (plain code) imports `GameSetup` from the `Menu` component, and `data/fireQuestions.ts` has its own `UNIT_NAMES`, which copies `UNIT_LABELS`. Move `GameSetup` to `src/types/` and move `labels.ts` out of `components/` (e.g. `src/labels.ts`) so both data and components use it.
- [ ] **R4. Order identity.** `Board` uses the array index as the order's key and colour (`TODO: in the future make order class have an index`), and Step 8 keys shots by order too. Decide on one: an `index`/`id` on `Order`, or document that the index is stable during a turn (orders can't change after commit).
- [ ] **R5. `canFire` is stored twice**: in `Order.canFire` and `Unit.readyToFire` (see the TODO in `order.ts`). Keep one source (the order) and derive the unit's glow from it, or document why both exist.
- [ ] **R6. Board size constants.** Every view passes `boardWidth={13} boardHeight={9} hexSize={50}` to `Board`. Read the size from `BoardManager` (`width`/`height`) and keep `hexSize` as a default.

### Dead code (delete, or wire up if a later step needs it)
- [ ] `BoardManager`: `getStats`, `getHexesByType`, `getPathToDestination`, `calculatePossibleMoves` (only a wrapper), `reset` (sessions are rebuilt instead) and the priority-queue TODO (117 hexes don't need one)
- [ ] `Hex`:
  - the unused static factories (`createPlains` …) and their TODO
  - `getDescription`, `getCoordinates` and `toString`
  - the English `name` and the `color` that `Hexagon` sets but the transparent tile class hides
  - the unused `unit` parameter of `getMovementCost`
- [ ] `types/`: `GamePhase`, `TurnPhase.END_TURN`, `MovementRule.DIFFICULT`, `types/GameSettings.ts` and `game-core/combatCard.ts` (combat cards aren't planned; add them back when they are)
- [ ] `Unit`: `disableFire`, `getOrderable` (duplicates `isOrderable`), the static counter controls and `id` if nothing reads it
- [ ] `Hand`: `pickCard` (with its `console.warn`), `addMultiple`, `printHand`, `add`, `remove`. `GameSession` builds new `Hand`s, so a `readonly CommandCard[]` may be enough and `Hand` can go.
- [ ] `Deck`: `printDeck`, `reset` and `originalCards` (and its TODO). `Order`: `printOrder`.
- [ ] `CommandCard`: fields no card or rule uses (`numOntheMove`, `extraMovement`, `unitCosts`, `receiveCombatCoins`). Keep `numFireTimes`, `extraPickUpCards` and the dice bonuses if Step 8 or the special-card idea uses them.
- [ ] `CommandCardComponent`: the unused `variant` prop, `diagram = null`, the 📊 and ⚔️ placeholders, and the `.diagram-text` TODO in `CommandCard.css`. These go away in the card redesign in Step 10.
- [ ] `utils.shuffle(array: any[])` → generic `shuffle<T>(array: readonly T[]): T[]`
- [ ] `src/assets/scenarios/defualt.png` (1.9 MB, unused): delete it, or convert it to WebP under a correct name when a second scenario uses it
- [ ] Hover-only affordances on non-clickable elements: `.deck-pile:hover` scales and has `cursor: pointer`, but it does nothing

### Other quality
- [ ] **Q6. The "Coge 2 Cartas" debug button** is visible to players. Hide it behind a dev flag (`import.meta.env.DEV`) until the special cards exist.
- [ ] **Q7. `storage.ts` has no tests.** Cover a corrupt save being dropped, an unknown scenario, storage throwing, and the last-setup round trip.
- [ ] **Q8.** `TARGET_TERRAIN_MODIFIERS` is keyed by free strings (`open`, `forest` …). Key it by `HexType` (plus `open` for plains) so terrain lists can't drift apart.
- [ ] Check after the cleanup: typecheck, tests, and one full turn in the browser, including a reload in each phase.

## Step 10: War-room look (new)

The app currently looks like a generic dark MUI dashboard. It should feel like part of the board game: a WWII field-HQ / command-post look with more character. Keep it readable on a tablet next to a real table, keep 48px tap targets, and keep enough contrast (check text against textured backgrounds).

- [ ] **Art direction first.** Make a one-page mock of 2–3 directions and pick one before restyling everything. For example:
  - (a) *Field map & dossier*: olive and khaki, parchment panels, typewriter text, rubber stamps
  - (b) *Board-game box*: the Memoir '44 look, with bold sand and red, card-like panels and chunky dice
  - (c) *Command-tent night*: dark canvas, lamp-lit amber accents, stencil type
- [ ] **Theme (`src/theme.ts`):**
  - palette: olive drab, khaki or sand, rust red, brass, off-white paper
  - Allied and Axis accent colours used consistently: the header, unit bases and the dice faces
  - square-ish corners, and a subtle paper or canvas texture on `body` and panels (CSS gradients or a small tiled WebP)
- [ ] **Typography.** A stencil or military display font for headings (e.g. *Black Ops One*, *Stardos Stencil* or *Allerta Stencil*) and a typewriter font for briefing text (*Special Elite*). Keep a plain sans font for dense text. Self-host the fonts with `@fontsource/*`, so they work offline and in a future PWA.
- [ ] **Header**: a mission-briefing strip with the scenario name, the faction insignia or flag, "TURNO 3", and phase steps styled like stamped tabs.
- [ ] **Menu**: a mission-briefing screen. The scenario cards look like dossiers, and the side picker shows Allied and Axis insignia.
- [ ] **Command cards**: redesign `CommandCardComponent` to look like real M44 command cards:
  - a section diagram (which flanks) drawn in SVG from `card.type`, instead of the 📊 placeholder
  - the order count in large type, and a colour band by card kind (section, tactic)
  - deck and discard piles drawn as card backs, not a "?"
- [ ] **Board**:
  - faint hex outlines on top of the art, so the grid reads clearly
  - unit tokens with a faction-coloured base disc. Replace the flat red and blue `circle` glows with a ring or badge for "orderable" and a crosshair badge for "ready to fire" (the red and blue glows clash with the art today).
  - order arrows styled like grease-pencil map arrows (thicker, rough ends)
  - "Órdenes confirmadas" as a stamp over the locked board
- [ ] **Battle screen**: the turn summary styled as a combat report. A fired unit gets a "DISPARÓ" stamp (ties in with Step 8).
- [ ] **Dice**: chunkier ivory or wood dice with a short tumble animation. Respect `prefers-reduced-motion`, which is already handled for the current animation.
- [ ] **Optional sound**: dice rattle, stamp thud and card deal, off by default, with a mute toggle in the header. Tablets are often used in quiet rooms.
- [ ] **Real art**: replace the placeholder tank and artillery SVGs (`npm run optimize-image -- <file> 192`) and the generic card image.
- [ ] Check at 1280×800 and 800×1280 with touch, and on desktop. Screenshot every screen before and after with Playwright.

## Step 11: Rules and firing situations

- [ ] **Decide:** the dice numbers are the official M44 values for now (infantry 3/2/1, tank 3, artillery 3/3/2/2/1/1; forest and town −1 infantry and −2 tank, hill −1; artillery ignores terrain). Adjust them to the house rules.
- [ ] More situations in `src/data/fireQuestions.ts`:
  - the target is in a bunker or behind sandbags
  - the firing unit is on a hill
  - line of sight is blocked
  - the unit moved before firing (if the house rules give a penalty)
- [ ] Pre-answer what the app already knows. The firing unit's own terrain and whether it moved are in the order, so skip those questions (`appliesTo` plus a richer `FireContext`).
- [ ] **Decide:** `Hex.getMovementCost` and `canEnter` have "unit-specific movement" TODOs. Are there any, e.g. tanks can't enter towns, or forest costs more for tanks? If not, delete the TODOs.
- [ ] **Decide:** "Infantry Assault"-style cards (a TODO in `commandCard.ts`: choose the section on play). Do we want them?

## Ideas for later
- [ ] Special cards that let you draw 2 and keep 1 at the end of the turn (these replace the "Coge 2 Cartas" debug button)
- [ ] More scenarios, with a scenario data check for each
- [ ] Install to the tablet's home screen as a PWA (manifest, icons, offline cache), for full screen with no browser bar. Do this after Step 10 so the icons match the new look.
- [ ] Turn log: a short history of past turns (card played, units that fired, casualties), useful when the two players compare notes

---

## Checks for every step
- `npm run typecheck` reports 0 errors, and `npx vitest run` passes.
- `npm run dev` (port 3000), then check the flow by hand or with Playwright MCP, at 1280×800 and 800×1280 with touch, and on desktop:
  1. Menu → start a game; the initial hand deals in.
  2. Picking a card highlights the right units.
  3. Issue orders, then undo, then commit, then battle.
  4. Fire with a unit: the dice roll once, the unit shows as fired, and a reload doesn't bring the roll back.
  5. Sync a casualty on the map, then end the turn.
  6. Only the one new card animates in, and the deck and discard counts add up.
  7. Reload in each phase: the game resumes where it was.
