# m44-sim

A companion web app for playing Memoir '44 with **simultaneous** turns, using a loose house variant rather than the official rules. Each player runs the app for their own faction next to the physical board. They pick a command card, give orders to their units on a digital copy of the map, and then carry out the result on the table. The app does not simulate the opponent or play as an AI.

## Target devices
The app has to work in desktop browsers **and on Android tablets** (Chrome), in landscape and portrait:
- Touch first: every action works with a single tap. Nothing depends on hover, right-click, double-tap or long-press, and no information is shown only on hover.
- Tap targets are at least 48px (the MUI theme sets `minHeight: 48` on buttons).
- The board SVG scales to the available width (`viewBox`); never give it a fixed pixel size. The page must not scroll sideways.
- Check UI changes at a tablet viewport with touch enabled, e.g. 1280×800 landscape and 800×1280 portrait, as well as desktop.

## Commands
- `npm run dev`: Vite dev server on http://localhost:3000 (polling watcher, because the repo lives on WSL)
- `npm run typecheck`: `tsc --noEmit` (must report 0 errors)
- `npm test`: Vitest in watch mode; use `npx vitest run` for a single run
- `npm run build`: production build to `dist/`

## Architecture
- `src/game-core/`: plain TypeScript game logic with **no React imports**:
  - `BoardManager`: hex grid, Axis flip, pathfinding (`calculatePossibleMovesWithPaths`), orderable units
  - `Hex`: terrain properties, board section (`_setSide`), neighbors (offset↔axial coordinates)
  - `GameSession`: owns one player's game (board, deck, hand, turn flow) and is the only place game rules run. Actions (`pickCard`, `issueOrder`, `undoLastOrder`, `commitOrders`, `startBattle`, `endTurn`, plus the battle-sync actions `removeUnit`, `relocateUnit` and `undoBattleEdit`, and firing: `fire`, `fireQuick`, `undoShot`) return `false` and change nothing when they aren't allowed. After each change it publishes an immutable `GameSnapshot`.
  - `Unit`, `Order`, `Deck`, `Hand`, `CommandCard`
  - `dice.ts` (Memoir '44 battle dice: 2 infantry, tank, grenade, star, flag) and `turnSummary.ts` (what each order means for the battle)
  - `fireRules.ts`: engine for the "how many dice?" questionnaire (next question, adding up the dice)
- `src/data/`: scenarios (terrain, units, board image, starting hand size per side), command-card templates, and `fireQuestions.ts`. **`fireQuestions.ts` is where the firing situations live:** each question has its text, options, when it applies (`appliesTo`) and how each answer changes the dice (`effect`), plus the base-dice and terrain tables. Add new situations there. The numbers start from the official M44 values and are meant to be tuned to the house rules.
- `src/types/`: shared types and enums (`TurnPhase`, `HexType`, `Side`, `Position`, …)
- `src/App.tsx`: creates the `GameSession` and shows `Menu` (scenario and side picker) or `GameView`. It saves the session after every change and resumes it on load, so a reload or the tablet dropping the tab doesn't lose the game; "Salir" forgets the save.
- `src/storage.ts`: everything kept in `localStorage` (the last setup and the game in progress). Reads and writes fail quietly, and an unreadable save is dropped.
- Saving: `GameSession.save()` returns a plain-JSON `SavedGame` (cards by id, units by index so orders and battle edits keep their references) and `GameSession.restore()` rebuilds it, throwing on anything it can't match. **When you add state to `GameSession`, add it to `SavedGame` too**, and bump `SAVE_VERSION` if old saves can no longer be read.
- `src/theme.ts`: MUI theme (dark, orange primary)
- `src/components/`: rendering (SVG board: `Board` → `Hexagon` → `UnitComponent`, plus `OrderComponent` arrows; `CommandCardComponent`)
- `src/components/mainComponents/GameView.tsx`: header (scenario, side, turn and phase steps, "Menú" with an exit confirmation); gets the `GameSession` from `App` and subscribes with `useSyncExternalStore`, then renders one view per phase from `GameViews/`: `CardsView` (PICK_CARDS), `OrdersView` (ORDER_UNITS) and `BattleView` (BATTLE). The battle screen hides the map by default, since the player is looking at the physical board, and shows `TurnSummary` full screen. "Disparar" on a unit opens `FireDialog`, which asks the fire questions (or takes a number of dice straight away, "Tirada rápida"), shows the calculation and has the session roll once; the shot then stands, and only a confirmed "Anular disparo" takes it back. "Ver mapa" opens `BattleMap`, where the player mirrors the physical battle by removing destroyed units and moving retreating ones. The board screens share `PhaseLayout.css`.
- `src/components/labels.ts`: Spanish labels for game enums (units, terrain, sections, die faces). Use it rather than showing enum values or the English names in `Hex`. Views read the snapshot and call session methods; only UI state (selection, animations, messages) lives in React.
- Tests live next to the code as `*.test.ts`. The Vitest setup is in `src/test/setup.ts` (jsdom + jest-dom).

## Conventions
- UI text is in **Spanish**. Code, identifiers and comments are in English.
- UI uses **MUI 9** (`@mui/material`, Emotion) with the dark theme in `src/theme.ts`. Use MUI components (`Button`, `Stack`, `Typography`, …) for new UI and style them with `sx`: MUI 9 removed the style-shorthand props on layout components. The SVG board and the card art stay custom.
- Keep rules logic in `game-core/` and cover it with Vitest tests. Components only render and call into game-core.
- Game objects are mutable class instances. Only `GameSession` may change them, and every change must end with it publishing a snapshot; that's what re-renders React. Don't mutate game objects from components. Don't move game logic into a React reducer either: React runs reducers twice in StrictMode, so side effects like `deck.draw()` would happen twice.
- Board: 13×9 offset grid with pointy-top hexes; odd rows have one fewer column and are shifted half a hex. Positions are `{row, col}` and map keys are `"row-col"`. For Axis, positions are flipped and the board image is rotated 180°.
- Sections: left/center/right plus the shared left-center/right-center border hexes (`Hex._setSide`).
- Rules are a loose variant: when a rule is ambiguous, ask instead of assuming official M44.
- The physical table is the source of truth after battle. The app tracks whole units only (no figure counts), and a unit can be moved to any empty hex to mirror a retreat or taking ground.
- Unit sprites live in `src/assets/units/<allies|axis>/<unit type>.webp|svg` and are mapped in `UnitComponent`. Tank and artillery are placeholder SVGs until real art replaces them.
- Remove debug `console.log` calls before committing.
- Images: use WebP, sized to a few times their display size. Convert new art with `npm run optimize-image -- <file> [maxWidth]`.

## Roadmap
The step-by-step plan and the list of known issues are in [docs/PLAN.md](docs/PLAN.md). Work through it one step at a time and tick items off when they're done.

## MCP servers (`.mcp.json`)
- `playwright`: drive the dev server, click through a turn and take screenshots to check UI changes. It runs headless Chromium (`--browser chromium --headless`); if the browser is missing, run `npx playwright install chromium`.
- `context7`: up-to-date docs for React 19, Vite 7 and Vitest
- `chrome-devtools`: console errors and performance traces of the SVG board

## Workflow
Personal project: commit straight to `main` with conventional-commit messages (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). No PRs or reviews. Before committing, run `npm run typecheck` and `npx vitest run`, and for UI changes check the flow in the browser.
