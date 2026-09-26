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

## Step 10: War-room look

The app should feel like part of the board game rather than a generic dark dashboard. It must stay readable on a tablet next to a real table, with 48px tap targets and enough contrast over the textures.

- [x] **Decided: art directions.** Three were mocked up side by side (design canvas "m44-sim art directions"). All three were kept: the player picks one in **Ajustes** on the start menu, and it is remembered on the device.
  - *Mapa de campaña* (`field`): parchment, olive and rust, Stardos Stencil and Special Elite
  - *Caja del juego* (`box`): sand, red and navy, chunky borders, Black Ops One and Barlow Condensed
  - *Tienda de mando* (`tent`, the default): dark canvas, lamp amber and olive, Allerta Stencil and IBM Plex Sans Condensed
- [x] **Decided: art sources.**
  - fonts: bundled `@fontsource/*` packages (work offline)
  - textures: CC0 photos from ambientCG (Paper003, Paper002, Fabric045) as 512px grayscale WebP tiles, 55 KB in total
  - icons: game-icons.net (CC BY 3.0, credited in the README)
  - animation: the `motion` library
  - sound: Kenney's CC0 Casino Audio and Impact Sounds
- [x] **Looks:** each look is plain data in `src/looks/looks.ts`. `looks/theme.ts` turns it into the MUI theme plus `--m44-*` CSS variables that the custom CSS (board, cards, dice, stamps) uses. Settings (`look`, `sound`) live in `src/settings.ts`, are stored by `storage.ts`, and reach components through `SettingsContext`.
- [x] **Header:** a briefing strip with the faction insignia (Allied star / Balkenkreuz), the turn, the phase steps as stamped tabs, a sound toggle and "Menú"
- [x] **Menu:** a briefing title, "Ajustes" (look and sound, with a live sample of each look), and the insignia on the side picker
- [x] **Command cards:** a coloured title band (primary for section cards, accent for tactic cards), the sections drawn in SVG from `card.type`, the order count in large type, and "Solo tanques" on tactic cards. The deck and discard are card backs. The card is a real `<button>`. The old generic card images are gone.
- [x] **Board:**
  - units are round tokens ringed in their side's colour
  - a dashed gold ring for "can be ordered", a crosshair badge for "will fire" and a check badge for "has fired" (the check also appears on the battle map, closing the Step 8 leftover)
  - order arrows look like grease pencil: thicker, dark underline, displacement filter
  - an "Órdenes confirmadas" stamp slams onto the locked board
  - **decided:** no extra hex outlines, since the scenario art already draws the grid
- [x] **Battle screen:** "Parte de combate", each row shows the unit's token ringed in its arrow colour, and a fired unit gets a "Disparó" stamp
- [x] **Dice:** chunkier, coloured by the look, tumbling in one after another. `MotionConfig reducedMotion="user"` respects "reduce motion".
- [x] **Sound** (off by default; toggle in the header or in Ajustes): card dealt, card played, orders confirmed (stamp), dice rolled (or the stamp for a 0-dice shot)
- [x] Icons on the main action buttons (fire, dice, map, undo, confirm, end turn, battle, cancel, exit)
- [x] Tests: `settings.test.ts`, settings in `storage.test.ts`, unit badges in `UnitComponent.test.tsx`, look and sound in `App.test.tsx`
- [x] Checked every screen in all three looks at 1280×800 and 800×1280 with touch: no console errors, no sideways scroll
- [ ] **Real art:** the tank and artillery sprites are still placeholder SVGs (`npm run optimize-image -- <file> 192`)
- [ ] Ideas: a card-back emblem per look, and changing the look from inside a game (today it's only on the start menu)

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
- [ ] Install to the tablet's home screen as a PWA (manifest, icons, offline cache), for full screen with no browser bar. The fonts are already bundled, so the app can work fully offline.
- [ ] Split the JS bundle (610 KB, 195 KB gzipped after Step 10) if load time on the tablet becomes a problem
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
