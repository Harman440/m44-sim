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

Nothing here changes how the game plays. It was done before the visual work so the restyle touches less code.

### Shared types and helpers
- [x] **R1.** `Faction` and `GameSetup` live in `src/types/faction.ts`, with `FACTIONS` and `isFaction`. The faction is typed everywhere, and the views' `boardSide` prop is now `faction`. `BoardManager` still throws on an unknown faction, since saves come from storage, but no longer logs. The menu ignores a remembered side that isn't valid.
- [x] **R2.** `samePosition`, `positionKey` and `includesPosition` live in `src/game-core/position.ts` and replace the copies and inline comparisons in game-core and the board components
- [x] **R3.** `labels.ts` moved to `src/labels.ts` (with `FACTION_LABELS`), and `fireQuestions.ts` uses `UNIT_LABELS` instead of its own copy. `storage.ts` no longer imports from `Menu`.
- [x] **R4.** Decided: an order's index is its identity for the turn (orders are append-only and frozen on commit), documented on `Order`
- [x] **R5.** Whether a unit fires is only stored in `Order.canFire`. `Unit.readyToFire` is gone; `Board` derives the red glow from the orders. Old saves still load (the extra field is ignored).
- [x] **R6.** `Board` reads its size from `BoardManager`; `hexSize` defaults to 50. `Hexagon` takes a single `highlight` prop (`selected` / `move-and-fire` / `move`).

### Dead code removed
- [x] `BoardManager`: `getStats`, `getHexesByType`, `getPathToDestination`, `calculatePossibleMoves`, `reset` and the priority-queue TODO. `setUnitsNotOrdable` is now spelled `setUnitsNotOrderable`.
- [x] `Hex`: the static factories, `getDescription`, `getCoordinates`, `toString`, the English `name` and `color`, and the unused constructor/`getMovementCost` parameters
- [x] `types/`: `GamePhase`, `TurnPhase.END_TURN`, `MovementRule.DIFFICULT`, `GameSettings.ts`; `game-core/combatCard.ts`
- [x] `Unit`: `id`, the counter controls, `disableFire`, `getOrderable` and `readyToFire`
- [x] `Hand` is gone: the session keeps the hand as a card list
- [x] `Deck`: `printDeck`, `reset`, `originalCards`. `Order`: `printOrder`.
- [x] `CommandCard`: `numOntheMove`, `extraMovement`, `unitCosts`, `receiveCombatCoins` (kept `numFireTimes`, `extraPickUpCards` and the dice bonuses)
- [x] `CommandCardComponent`: the `variant` prop, the placeholders (📊, ⚔️, `diagram`) and the `.diagram-text` TODO
- [x] `shuffle<T>` is generic
- [x] `src/assets/scenarios/defualt.png` (1.9 MB, unused), deleted; it is still in git history
- [x] `.deck-pile` no longer pretends to be tappable (hover scale, pointer cursor)
- [x] The last `console` calls in app code

### Other quality
- [x] **Q6.** "Coge 2 Cartas" only shows in development (`import.meta.env.DEV`, `CardsView.showDrawChoice`)
- [x] **Q7.** `storage.test.ts`: round trips, unreadable and outdated saves, unknown scenario, storage throwing
- [x] **Q8.** `TARGET_TERRAIN_MODIFIERS` is keyed by `HexType` (the answer for open ground is now `plains`)
- [x] Checks: typecheck with no unused locals, 175 tests, and a full turn for each side in Chromium at 1280×800 and 800×1280 with touch, with a reload in every phase. No console errors or warnings, and no sideways scroll.

## Step 10: War-room look (new)

The app currently looks like a generic dark MUI dashboard. It should feel like part of the board game: a WWII field-HQ / command-post look with more character. Keep it readable on a tablet next to a real table, keep 48px tap targets, and keep enough contrast (check text against textured backgrounds).

- [ ] **Decide: where the art comes from.** Nothing has to be downloaded except what you pick here:
  - **Fonts:**
    - (recommended) the `@fontsource/black-ops-one`, `@fontsource/stardos-stencil` and `@fontsource/special-elite` npm packages. They are bundled into the app, work offline and are ~20–60 KB each.
    - or a Google Fonts `<link>`, which needs internet on the tablet
  - **Paper / canvas texture:**
    - generated in code (SVG `feTurbulence` noise or CSS gradients), with no download
    - or one free-licence (CC0) photo texture (ambientCG, Poly Haven), converted to WebP with `npm run optimize-image`
  - **Insignia, card flank diagrams, dice and stamps:** hand-drawn inline SVG in the repo, with no download. Claude can draw these.
  - **Icons:**
    - none
    - `@mui/icons-material` (generic)
    - a few SVGs from game-icons.net (free, but the site must be credited in the README)
  - **Animation:**
    - CSS keyframes, as today
    - or the `motion` library (~35 KB) for smoother card dealing and dice tumbling. It isn't needed.
  - **Sound (optional):** plain browser audio plus a few CC0 clips from freesound
  - **Real unit and card art:** painted or photographic art can't be generated in code. You supply it or pick free-licence sources, or we stay with the SVG placeholders.
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
- [ ] **Decide:** is there any unit-specific movement, e.g. tanks can't enter towns, or forest costs more for tanks? Today every unit moves the same (`Hex.getMovementCost`, `canEnter`).
- [ ] **Decide:** "Infantry Assault"-style cards (a TODO in `commandCard.ts`: choose the section on play). Do we want them?

## Ideas for later
- [ ] Special cards that let you draw 2 and keep 1 at the end of the turn (these replace the "Coge 2 Cartas" debug button)
- [ ] More scenarios, with a scenario data check for each (the old unused `defualt.png` board art is in git history before Step 9)
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
