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
- `npm run build`: production build to `dist/`, with the service worker (`vite-plugin-pwa`, config in `vite.config.ts`)
- `npm run tablet`: build and serve the production app on the network (port 4173); the only way to test install and offline, since the service worker doesn't run in `npm run dev`. Service workers need HTTPS or localhost; see the README for the tablet.
- `npm run icons`: regenerate the app icon PNGs from `public/icons/icon.svg`

## Architecture
- `src/game-core/`: plain TypeScript game logic with **no React imports**:
  - `BoardManager`: hex grid, Axis flip, pathfinding (`calculatePossibleMovesWithPaths`), orderable units
  - `Hex`: terrain properties, board section (`_setSide`), neighbors (offset↔axial coordinates)
  - `GameSession`: owns one player's game (board, deck, hand, turn flow) and is the only place game rules run. Actions (`pickCard`, `issueOrder`, `undoLastOrder`, `commitOrders`, `startBattle`, `endTurn`, plus the battle-sync actions `removeUnit`, `relocateUnit` and `undoBattleEdit`, and firing: `fire`, `fireQuick`, `undoShot`) return `false` and change nothing when they aren't allowed. After each change it publishes an immutable `GameSnapshot`.
  - `Unit`, `Order` (whether the unit fires lives on the order; an order's index identifies it for the turn), `Deck`, `CommandCard`
  - `position.ts`: `samePosition`, `positionKey` ("row-col") and `includesPosition`; use them rather than comparing rows and columns by hand
  - `dice.ts` (Memoir '44 battle dice: 2 infantry, tank, grenade, star, flag) and `turnSummary.ts` (what each order means for the battle)
  - `fireRules.ts`: engine for the "how many dice?" questionnaire (next question, adding up the dice)
- `src/data/`: scenarios (terrain, units, board image, starting hand size per side), command-card templates, and `fireQuestions.ts`. **`fireQuestions.ts` is where the firing situations live:** each question has its text, options, when it applies (`appliesTo`), how each answer changes the dice (`effect`), and optionally whether an answer rules the shot out (`blocks`, e.g. no line of sight) or adds a reminder for resolving hits (`note`, e.g. sandbags), plus the base-dice and terrain tables. Add new situations there. The numbers start from the official M44 values and are meant to be tuned to the house rules.
- `src/types/`: shared types and enums (`TurnPhase`, `HexType`, `Side`, `Position`, `Faction`/`GameSetup`, …)
- `src/App.tsx`: creates the `GameSession` and shows `Menu` (scenario and side picker) or `GameView`. It saves the session after every change and resumes it on load, so a reload or the tablet dropping the tab doesn't lose the game; "Salir" forgets the save.
- `src/storage.ts`: everything kept in `localStorage` (the last setup and the game in progress). Reads and writes fail quietly, and an unreadable save is dropped.
- Saving: `GameSession.save()` returns a plain-JSON `SavedGame` (cards by id, units by index so orders and battle edits keep their references) and `GameSession.restore()` rebuilds it, throwing on anything it can't match. **When you add state to `GameSession`, add it to `SavedGame` too**, and bump `SAVE_VERSION` if old saves can no longer be read.
- `src/looks/`: the three visual looks the player picks in "Ajustes" (`looks.ts`: colours, fonts, shape, texture per look) and `theme.ts`, which builds the MUI theme and the `--m44-*` CSS variables from a look. **Style custom CSS with the `--m44-*` variables, never fixed colours**, so it works in every look. Bundled fonts are imported in `looks/fonts.ts`.
- `src/settings.ts`: per-device settings (look, sound) and `SettingsContext`; `src/sound.ts`: `useSound()` plays the short effects only when sound is on
- `src/components/GameIcon.tsx` (game-icons.net icons as a colour-following mask), `Stamp.tsx` (the rubber stamp that slams in), `FactionInsignia.tsx`
- `src/components/`: rendering (SVG board: `Board` → `Hexagon` → `UnitComponent`, plus `OrderComponent` arrows; `CommandCardComponent`)
- `src/components/mainComponents/GameView.tsx`: header (scenario, side, turn and phase steps, sound toggle, and "Menú" with "Ajustes" and "Salir al menú", which asks for confirmation); gets the `GameSession` from `App` and subscribes with `useSyncExternalStore`, then renders one view per phase from `GameViews/`: `CardsView` (PICK_CARDS), `OrdersView` (ORDER_UNITS) and `BattleView` (BATTLE). The battle screen hides the map by default, since the player is looking at the physical board, and shows `TurnSummary` full screen. "Disparar" on a unit opens `FireDialog`, which asks the fire questions (or takes a number of dice straight away, "Tirada rápida"), shows the calculation and has the session roll once; the shot then stands, and only a confirmed "Anular disparo" takes it back. "Ver mapa" opens `BattleMap`, where the player mirrors the physical battle by removing destroyed units and moving retreating ones. The board screens share `PhaseLayout.css`.
- `src/labels.ts`: Spanish labels for game enums (units, terrain, sections, die faces). Use it rather than showing enum values. Views read the snapshot and call session methods; only UI state (selection, animations, messages) lives in React.
- Tests live next to the code as `*.test.ts`. The Vitest setup is in `src/test/setup.ts` (jsdom + jest-dom).

## Conventions
- UI text is in **Spanish**. Code, identifiers and comments are in English.
- UI uses **MUI 9** (`@mui/material`, Emotion) with the theme of the chosen look (`src/looks/`). Use MUI components (`Button`, `Stack`, `Typography`, …) for new UI and style them with `sx`: MUI 9 removed the style-shorthand props on layout components. The SVG board and the card art stay custom.
- Keep rules logic in `game-core/` and cover it with Vitest tests. Components only render and call into game-core.
- Game objects are mutable class instances. Only `GameSession` may change them, and every change must end with it publishing a snapshot; that's what re-renders React. Don't mutate game objects from components. Don't move game logic into a React reducer either: React runs reducers twice in StrictMode, so side effects like `deck.draw()` would happen twice.
- Board: 13×9 offset grid with pointy-top hexes; odd rows have one fewer column and are shifted half a hex. Positions are `{row, col}` and map keys are `"row-col"`. For Axis, positions are flipped and the board image is rotated 180°.
- Sections: left/center/right plus the shared left-center/right-center border hexes (`Hex._setSide`).
- Rules are a loose variant: when a rule is ambiguous, ask instead of assuming official M44.
- The physical table is the source of truth after battle. The app tracks whole units only (no figure counts), and a unit can be moved to any empty hex to mirror a retreat or taking ground.
- Unit sprites live in `src/assets/units/<allies|axis>/<unit type>.webp|svg` and are mapped in `UnitComponent`. Tank and artillery are placeholder SVGs until real art replaces them.
- Remove debug `console.log` calls before committing.
- Images: use WebP, sized to a few times their display size. Convert new art with `npm run optimize-image -- <file> [maxWidth]`.
- New third-party assets (icons, textures, sounds, fonts) need a licence that allows it, and a line under Credits in the README.
- Animations use `motion` (`motion/react`), only inside the game screens: `GameView` wraps them in `MotionConfig reducedMotion="user"`. Keep motion out of `Menu`, `SettingsDialog` and `App` so it stays out of the first download.
- Bundle: `GameView` is lazy-loaded (`LazyGameView`, preloaded from the menu), and `vite.config.ts` splits react, MUI and motion into their own chunks.

## Roadmap
The step-by-step plan is in [docs/PLAN.md](docs/PLAN.md). Work through it one step at a time and tick items off when they're done. The player's house rules, which most of the later steps come from, are in [docs/house-rules.md](docs/house-rules.md): they were written for pen and paper and may change, so confirm a rule with the player before building it.

## MCP servers (`.mcp.json`)
- `playwright`: drive the dev server, click through a turn and take screenshots to check UI changes. It runs headless Chromium (`--browser chromium --headless`); if the browser is missing, run `npx playwright install chromium`.
- `context7`: up-to-date docs for React 19, Vite 7 and Vitest
- `chrome-devtools`: console errors and performance traces of the SVG board

## Workflow
Personal project: commit straight to `main` with conventional-commit messages (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). No PRs or reviews. Before committing, run `npm run typecheck` and `npx vitest run`, and for UI changes check the flow in the browser.
