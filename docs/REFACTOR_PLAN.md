# Refactor, size and tooling plan

Measured on 2026-10-19 (commit 2b3c15a). Nothing here changes a rule; each item can be done on its own.

## 1. App size

`npm run build` makes 8.7 MB, and the service worker precaches **8.2 MB** (119 files) on the tablet:

| What | Size | Note |
|---|---|---|
| Scenario board art (4 × `assets/scenarios/*.webp`) | 3.2 MB | 2435×1514, ~800 KB each |
| Card paintings (29 × `assets/cards/*.webp`) | 1.9 MB | 480×720; the largest card on screen is 196 CSS px wide |
| Other images (empty board, tiles, units, icons…) | 0.5 MB | |
| JavaScript | 2.1 MB | three.js alone is 0.92 MB (250 KB gzip), MUI 0.32 MB, game screen 0.14 MB |
| Fonts (woff2) | 0.34 MB | 6 families × latin + latin-ext |

What to do, biggest first:

- [x] **Scenario art at the app's size.** Maps from Mis mapas are drawn at 1621×1008 (`APP_ART_HEIGHT`). Saving the painted boards at that width too: one board goes from 819 KB to ~240 KB (1600 px, quality 78, tried with sharp). **About −2.2 MB.** `npm run board` writes the full size, so add an app-size output (or resize in the script) and keep the 2435 px one only as a source. Check the FireAim crop on the tablet before deciding: it zooms in the most.
- [x] **Card paintings at 400 px wide** (`card-art` takes `maxWidth`): ~−30%, **about −0.5 MB**. 196 CSS px × 2 device px is 392 px.
- [x] **Latin subset only for fonts**: import `@fontsource/<font>/latin-400.css` instead of `400.css` in `looks/fonts.ts`. Spanish needs only the latin subset (á, é, ñ, ¿, ¡ are in it). **About −170 KB** precached.
- [ ] Optional: three.js is 11% of the download and draws the 3D dice and the card flight. Both already have fallbacks (2D dice, no flight). Keep it unless the size matters more than the look.

Result: about **8.2 MB → 5.3 MB**, nothing visible lost if the art passes the check.

Done: the precache went from 8.2 MB to **5.6 MB**. The boards are saved at 1621×1008 (quality 85, 3.2 → 1.6 MB; side by side at the fire view's zoom the difference is barely visible). The card paintings are at 480 px rather than 400: the card dialog shows a card at 220 CSS px, 440 px on a 2× tablet; only the 24 landscape ones were larger (640 px), 1.9 → 1.2 MB. Fonts are latin only (344 → 220 KB).

## 2. Storage and Mis mapas

- **No cap in the code.** Maps are kept in `localStorage` (`m44-sim:custom-maps`), about **2 KB per map** (the four scenarios as files: 1.6–2.0 KB). Chrome gives a site about 5 MB, so room for **over 2,000 maps**. A saved match is ~5 KB per turn (60 KB at turn 12). No server or database is needed.
- Risks, and what to build:
  - [ ] **Silent loss when storage is full**: `saveCustomMap` swallows the error, so the editor would go on while nothing is kept. Return `false` and show a warning in the editor.
  - [ ] **Maps live only in that browser on that device.** Clearing site data, uninstalling the app on Android or changing tablet loses them; maps made on the PC never reach the tablet. Add **export / import of a map as a JSON file** (export is built: "Exportar" in Mis mapas; the format already exists: `toScenarioFile` / `parseScenario`), and "export all" as a backup.
  - [ ] Ask for persistent storage once: `navigator.storage.persist()` (an installed app usually gets it), so Chrome doesn't evict the data under disk pressure.
  - Note: `localStorage` is per origin, and the origin is `harman440.github.io`, shared with any other GitHub Pages project on that account. The `m44-sim:` key prefix keeps them apart; they share the 5 MB.
  - An exported map dropped into `src/data/catalog/<id>.json` already becomes a built-in scenario (with its art from `npm run board`).

## 3. Refactors

Copy-paste is low: jscpd finds 0.66% duplicated lines. The cost is in a few very large files.

- [ ] **`GameSession` (2,704 lines, ~80 actions).** Its state is listed five times: the fields, `SessionState`, `SavedGame`, `save()` and `restore()` (35 lines of `session.x = state.x`). Keep the mutable state in one `state: SessionState` object, so `restore()` is one assignment and a new piece of state is added in two places (the type and its save format), not five. Then move groups of actions into pure modules over that state, as `orderRules.ts` already does: firing and shots (~600 lines), combat cards (marks, assignments, attacks), map edits (`removeUnit`, `relocateUnit`, `undoBattleEdit`…), the final phase (draws, rewards). `GameSession` stays the only public entry point and keeps publishing snapshots.
- [ ] **The big views**: `OrdersView` (819), `SharedBattleView` (790), `EndOfTurnView` (729), `FireDialog` (594). Move their state handling into hooks (`useOrdering`, `useBattleTurn`…) and their side columns into components, like `FireOrderList`.
- [ ] **Two battle screens.** Own tablets (`BattleView` + `FireDialog` + `FireAim`) and pass and play (`SharedBattleView`) aim, show dice and resolve shots in two ways. Worth sharing the aim/dice/result panel; decide first whether own-tablet play stays as it is.
- [ ] Small duplicates (jscpd): `HistoryDialog` repeats one block three times; `FireAim` repeats a block twice; `Dice3D` and `DicePool3D` share the die geometry and lights; `BattleMap` and `MovementView` share their layout; `ScenarioDetails` and `ScenarioSettingsDialog` share a 30-line table; `DeckVisualizerDialog` and `CombatDeckDialog` share the card grid.
- [x] **`CardArt.tsx` imports its 29 paintings one by one** and maps them in `TACTIC_PAINTINGS` / `COMBAT_PAINTINGS`. Use `import.meta.glob("../assets/cards/*.webp")` keyed by file name = card template id (`drawBoard.ts` already does this for tiles). Adding a painting is then only `npm run card-art`, with no code change.

## 4. Speed

The app is fine. The slow part is the tests:

- [x] **`npx vitest run` takes ~104 s**, and ~40% of it is setting up jsdom, even for the 31 game-core and data test files that never touch the DOM. Split `vitest.config.ts` into two projects: `node` for `src/game-core` and `src/data` (no `setup.ts`), `jsdom` for the rest. Also leave the PWA plugin out of the test config.
- [x] Add `npm run check` (typecheck + tests in one command), and `npm run test:core` for game-core only, for quick runs during rules work.

Done: the rules tests run in Node and the UI tests pre-bundle MUI. The whole run went from ~104 s to ~73 s on 4 cores, and `npm run test:core` takes ~10 s.

## 5. Tooling to save time and tokens

- [x] **Shorten `CLAUDE.md`** (50 KB, about 12,000 tokens read at the start of every session, and edited in 128 of 268 commits). Keep the map: folders, main classes, conventions, commands, under ~10 KB. The per-feature details (which card does what, each view's buttons) are already in the code's doc comments; move what isn't into `docs/ARCHITECTURE.md`, read only when needed. Stop adding a sentence per feature. Done: CLAUDE.md is 10.5 KB, and the module details are in `docs/ARCHITECTURE.md`.
- [x] **A session start hook** that runs `npm ci` in cloud sessions (each new session installs the packages by hand now).
- [ ] **A screenshot script** (`npm run shots`): Playwright plays a scripted turn and saves a screenshot of each phase at 1280×800 and 800×1280 with touch. Checking UI through the browser tool one click at a time is the most expensive part of UI work.
- [ ] **Project skills** in `.claude/skills/` for the recurring jobs, loaded only when needed: "add a combat card" (data, labels, rule book, deck rule, art, tests), "add a scenario" (catalog file, `boards.json`, `npm run board`), "new state in GameSession" (until item 3's refactor makes it short), "finish a step" (typecheck, tests, tick PLAN.md, commit).
- [x] Card art without code (item 3's glob).
