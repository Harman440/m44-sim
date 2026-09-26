# m44-sim

A companion web app for playing Memoir '44 with **simultaneous** turns, using a loose house variant rather than the official rules. Each player runs the app for their own faction next to the physical board. They pick a command card, give orders to their units on a digital copy of the map, and then carry out the result on the table. The app does not simulate the opponent or play as an AI.

## Commands
- `npm run dev`: Vite dev server on http://localhost:3000 (polling watcher, because the repo lives on WSL)
- `npm run typecheck`: `tsc --noEmit` (must report 0 errors)
- `npm test`: Vitest in watch mode; use `npx vitest run` for a single run
- `npm run build`: production build to `dist/`

## Architecture
- `src/game-core/`: plain TypeScript game logic with **no React imports**:
  - `BoardManager`: hex grid, Axis flip, pathfinding (`calculatePossibleMovesWithPaths`), orderable units
  - `Hex`: terrain properties, board section (`_setSide`), neighbors (offset↔axial coordinates)
  - `GameSession`: owns one player's game (board, deck, hand, turn flow) and is the only place game rules run. Actions (`pickCard`, `issueOrder`, `undoLastOrder`, `commitOrders`, `startBattle`, `endTurn`) return `false` and change nothing when they aren't allowed. After each change it publishes an immutable `GameSnapshot`.
  - `Unit`, `Order`, `Deck`, `Hand`, `CommandCard`
- `src/data/`: scenarios and command-card templates (data only)
- `src/types/`: shared types and enums (`TurnPhase`, `HexType`, `Side`, `Position`, …)
- `src/theme.ts`: MUI theme (dark, orange primary)
- `src/components/`: rendering (SVG board: `Board` → `Hexagon` → `UnitComponent`, plus `OrderComponent` arrows; `CommandCardComponent`)
- `src/components/mainComponents/GameView.tsx`: creates the `GameSession` and subscribes with `useSyncExternalStore`, then renders one view per phase (PICK_CARDS → ORDER_UNITS → BATTLE) from `GameViews/`. Views read the snapshot and call session methods; only UI state (selection, animations, messages) lives in React.
- Tests live next to the code as `*.test.ts`. The Vitest setup is in `src/test/setup.ts` (jsdom + jest-dom).

## Conventions
- UI text is in **Spanish**. Code, identifiers and comments are in English.
- UI uses **MUI 9** (`@mui/material`, Emotion) with the dark theme in `src/theme.ts`. Use MUI components (`Button`, `Stack`, `Typography`, …) for new UI and style them with `sx`: MUI 9 removed the style-shorthand props on layout components. The SVG board and the card art stay custom.
- Keep rules logic in `game-core/` and cover it with Vitest tests. Components only render and call into game-core.
- Game objects are mutable class instances. Only `GameSession` may change them, and every change must end with it publishing a snapshot; that's what re-renders React. Don't mutate game objects from components. Don't move game logic into a React reducer either: React runs reducers twice in StrictMode, so side effects like `deck.draw()` would happen twice.
- Board: 13×9 offset grid with pointy-top hexes; odd rows have one fewer column and are shifted half a hex. Positions are `{row, col}` and map keys are `"row-col"`. For Axis, positions are flipped and the board image is rotated 180°.
- Sections: left/center/right plus the shared left-center/right-center border hexes (`Hex._setSide`).
- Rules are a loose variant: when a rule is ambiguous, ask instead of assuming official M44.
- Remove debug `console.log` calls before committing.

## Roadmap
The step-by-step plan and the list of known issues are in [docs/PLAN.md](docs/PLAN.md). Work through it one step at a time and tick items off when they're done.

## MCP servers (`.mcp.json`)
- `playwright`: drive the dev server, click through a turn and take screenshots to check UI changes. It runs headless Chromium (`--browser chromium --headless`); if the browser is missing, run `npx playwright install chromium`.
- `context7`: up-to-date docs for React 19, Vite 7 and Vitest
- `chrome-devtools`: console errors and performance traces of the SVG board

## Workflow
Personal project: commit straight to `main` with conventional-commit messages (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). No PRs or reviews. Before committing, run `npm run typecheck` and `npx vitest run`, and for UI changes check the flow in the browser.
