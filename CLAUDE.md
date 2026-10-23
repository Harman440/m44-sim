# m44-sim

A companion web app for playing Memoir '44 with **simultaneous** turns, using a loose house variant rather than the official rules. Each player runs the app for their own faction next to the physical board. They pick a command card, give orders to their units on a digital copy of the map, and then carry out the result on the table. On own tablets the app does not simulate the opponent; only a pass and play match can have the computer play one side ([docs/PLAY_THE_COMPUTER.md](docs/PLAY_THE_COMPUTER.md)).

**Module details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** Read the part you need before working on a module; don't read it all. Keep this file short: don't add a sentence per feature here. Put details in the code's doc comments, and update ARCHITECTURE.md when a module's role changes.

## Target devices
The app has to work in desktop browsers **and on Android tablets** (Chrome), in landscape and portrait:
- Touch first: every action works with a single tap. Nothing depends on hover, right-click, double-tap or long-press, and no information is shown only on hover.
- Tap targets are at least 48px (the MUI theme sets `minHeight: 48` on buttons).
- The board SVG scales to the available width (`viewBox`); never give it a fixed pixel size. The page must not scroll sideways.
- Check UI changes at a tablet viewport with touch enabled, e.g. 1280×800 landscape and 800×1280 portrait, as well as desktop.

## Commands
- `npm run dev`: Vite dev server on http://localhost:3000 (polling watcher, because the repo lives on WSL)
- `npm run check`: typecheck and every test, what to run before committing (about 1.5 min)
- `npm run typecheck`: `tsc --noEmit` (must report 0 errors)
- `npm run test:core`: only the rules tests (game-core, data, boardArt, i18n, labels) in plain Node (~10 s); use it while working on rules
- `npx vitest run <file>`: one test file; `npm test` is watch mode
- `npm run build`: production build to `dist/`, with the service worker (`vite-plugin-pwa`)
- `npm run tablet`: build and serve the production app on the network (port 4173), to test install and offline locally
- `npm run add-scenario -- <file>`: put a map exported from Mis mapas ("Exportar") into the catalog, with its board art (`--check` only checks it)
- Asset scripts (`card-art`, `mix-paintings`, `optimize-image`, `icons`, `board`, `water-tile`): see ARCHITECTURE.md's "Asset scripts". Card paintings go to `src/assets/cards/<card template id>.webp` and show up with no code change, board art comes from `scripts/boards.json`. A change to `src/boardArt/boardPlan.mjs`, `terrainTiles.mjs`, `joinedHills.mjs`, `joinedTiles.mjs` or `softLines.mjs` must leave `npm run board`'s images byte for byte as they were unless it means to change them (run it and check `git status`)

Tests: `vitest.config.ts` has two projects: `core` (Node) for `src/{game-core,data,boardArt,i18n,labels}/**/*.test.ts`, `ui` (jsdom) for the rest. A test in those folders must not need the DOM. The `ui` project pre-bundles MUI; a new `@mui/material/<path>` import must be added to `BUNDLED` there.

## Deploy
Every push to `main` publishes to GitHub Pages at https://harman440.github.io/m44-sim/ (`.github/workflows/deploy.yml`: typecheck, tests, `vite build --base=/m44-sim/`). The tablet installs the app from there. Keep asset URLs relative to the base (import assets, or use `import.meta.env.BASE_URL`), never a hard-coded `/…` path. Cloud sessions install the packages with `.claude/hooks/session-start.sh`.

## Code map
- `src/game-core/`: plain TypeScript game logic, **no React imports**.
  - `GameSession` (`gameSession.ts`): one player's game and the **only place game rules run**. Actions return `false` and change nothing when not allowed; each change publishes an immutable `GameSnapshot`.
  - `PassAndPlayMatch` (`passAndPlay.ts`): both sides on one device, one `GameSession` per side; simultaneous movement in `simultaneousMove.ts`, winning in `victory.ts`.
  - `ai/`: the computer player for pass and play (`aiStep`, `Brain`, `standardBrain`; `selfPlay.ts` for tests).
  - Rules as pure functions: `orderRules.ts` (orderable units, move limits), `actionRules.ts` (which action a unit can be given, fire options), `unitSupplies.ts`, `luck.ts`, `markerRules.ts`, `turnSummary.ts` (firing order), `fireRules.ts` (the dice questionnaire), `fireTargets.ts` (range, line of sight), `rollResult.ts`, `coins.ts`, `dice.ts`.
  - Board: `BoardManager` (grid, pathfinding), `Hex`, `Unit`, `Order`, `position.ts` (`samePosition`, `positionKey`, `includesPosition`: use them rather than comparing rows and columns by hand).
  - Actions and cards: `unitAction.ts` (the action and fire option types), `actionCard.ts` (the command cards, cooldown, a side's cards and costs).
  - Files: `saveGame.ts` (saves), `turnLog.ts`, `scenarioFile.ts` (scenario JSON, `validateScenario`, `parseScenario`, `scenarioFile.schema.json`), `scenarioDraft.ts` (the map editor's edits).
- `src/data/`: scenarios (`scenarios.ts` built-ins, then `data/catalog/<id>.json` with art in `assets/scenarios/<id>.webp`), the actions and fire options (`unitActions.ts`), the supplies (`unitSupplies.ts`), the command cards (`actionCards.ts`), `ruleBook.ts`, `figures.ts`, `coinRules.ts`. Where each rule lives:
  - **`fireQuestions.ts`: the firing situations** (questions, dice effects, terrain dice tables, collision dice). Add new situations there.
  - **`hitRules.ts`: what each die face does to a target.**
  - **`terrain.ts`: what each terrain does** (`TERRAIN`); a new terrain also needs its labels and its art in `scripts/compose-board.mjs`.
- `src/boardArt/`: board art shared by the app and `npm run board`.
- `src/components/`: rendering. `mainComponents/GameView.tsx` shows one view per phase from `GameViews/`; pass and play is `MatchView`; the map editor is `mapEditor/`; the SVG board is `Board` → `Hexagon` → `UnitComponent`; command cards are `ActionCardComponent`; the orders screen's `UnitList`, `ActionPopup` and `ActionPanel`.
- `src/App.tsx`: the menu, starting and resuming games, Mis mapas. `src/storage.ts`: everything kept in `localStorage`.
- `src/labels/` (enum and object names per language), `src/i18n/` (languages, `Localized`), `src/looks/` (the three looks and the MUI theme), `src/settings.ts`, `src/sound.ts`, `src/types/`.

## Rules that must hold
- **When you add state to `GameSession`, add it to `SessionState` and `SavedGame` in `saveGame.ts` too**, and bump `SAVE_VERSION` when the shape changes: older saves are dropped, not migrated.
- **When a rule changes, change its text in `data/ruleBook.ts` too** (the numbers come from the data files).
- Game objects are mutable class instances that only `GameSession` changes, always ending with a published snapshot. Components only render and call session methods; only UI state (selection, animations, messages) lives in React. Don't move game logic into a React reducer (StrictMode runs reducers twice).
- Keep rules logic in `game-core/` and cover it with Vitest tests next to the code (`*.test.ts`).
- Every scenario, built-in or from the catalog, passes `validateScenario` (`scenarios.test.ts`).

## Conventions
- UI text is in **Spanish and English**; code, identifiers and comments are in English. Every visible string needs both:
  - A component's own text goes in one `TEXT = defineMessages({ es: {…}, en: {…} })` at the top of its file, read with `const t = useMessages(TEXT)`; `defineMessages` makes `en` match `es` key for key. Use functions for texts with numbers, names or plurals. Aria labels, titles and alt texts count.
  - Text that game-core or the data files make (card names and texts, scenario descriptions, fire questions, dice steps, notes, reminders) is a `Localized` (`{ es, en }`), shown with `const tr = useTr(); tr(card.name)`. Write both when you add a card, a question or a scenario.
  - Card names follow the official editions: the Spanish one in `es`, the English one in `en`.
  - Enum and object names come from `useLabels()` (or `LABELS[lang]` outside React), never raw enum values.
  - Tests render in Spanish by default; wrap a render in `SettingsContext.Provider` with `language: "en"` to check English.
- Coins are called **suministros** / **supplies** in the UI (`GameIcon name="coins"`); the code keeps "coins".
- UI uses **MUI 9** with the theme of the chosen look. Use MUI components for new UI and style them with `sx` (MUI 9 removed the style-shorthand props). The SVG board and the card art stay custom.
- **Style custom CSS with the `--m44-*` variables, never fixed colours**, so it works in every look.
- Board: 13×9 offset grid (a map from the editor can be bigger: `game-core/boardSize.ts`, `Scenario.board`; always pass the size to `turnedRound`) with pointy-top hexes; odd rows have one fewer column and are shifted half a hex. Positions are `{row, col}`, map keys `"row-col"`. For Axis, positions are flipped and the board image is rotated 180°. Sections: left/center/right plus the shared left-center/right-center border hexes.
- Rules are a loose variant: when a rule is ambiguous, ask instead of assuming official M44.
- The physical table is the source of truth after battle on own tablets: the app tracks whole units only. Pass and play is the exception: everything is in the app, and units have figures.
- Unit sprites live in `src/assets/units/<allies|axis>/<unit type>.webp|svg`, mapped in `UnitComponent`.
- Images: WebP, sized to a few times their display size (`npm run optimize-image -- <file> [maxWidth]`).
- New third-party assets (icons, textures, sounds, fonts) need a licence that allows it, and a line under Credits in the README.
- Animations use `motion` (`motion/react`), only inside the game screens (`GameView` wraps them in `MotionConfig reducedMotion="user"`). Keep motion out of `Menu`, `SettingsDialog` and `App`, so it stays out of the first download.
- Bundle: `GameView`, the map editor, the rule book and the 3D code are lazy-loaded; `vite.config.ts` splits react, MUI, motion and three.js into their own chunks.
- Remove debug `console.log` calls before committing.

## Roadmap
The step-by-step plan is in [docs/PLAN.md](docs/PLAN.md): work through it one step at a time and tick items off when they're done. Size, refactor and tooling ideas are in [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md). The finished plans are in `docs/oldPlans/`. What's left of pass and play is in [docs/PASS_AND_PLAY_NEXT.md](docs/PASS_AND_PLAY_NEXT.md). The actions mode (a rework that replaces the card game) is planned in [docs/ACTIONS_PLAN.md](docs/ACTIONS_PLAN.md). The player's house rules are in [docs/house-rules.md](docs/house-rules.md): they were written for pen and paper and may change, so confirm a rule with the player before building it.

## MCP servers (`.mcp.json`)
- `playwright`: drive the dev server, click through a turn and take screenshots to check UI changes (headless Chromium).
- `context7`: up-to-date docs for React 19, Vite 7 and Vitest
- `chrome-devtools`: console errors and performance traces of the SVG board

## Workflow
Personal project: commit straight to `main` with conventional-commit messages (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). No PRs or reviews. Before committing, run `npm run check`, and for UI changes check the flow in the browser.
