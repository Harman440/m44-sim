# m44-sim

A companion web app for playing [Memoir '44](https://www.daysofwonder.com/memoir44/) with **simultaneous turns**, using a loose house variant rather than the official rules. Each player runs the app on their own device, a desktop browser or an Android tablet, next to the physical board.

Each turn:
1. **Carta:** pick a command card from your hand.
2. **Órdenes:** order the units that card activates on a digital copy of the map: move them (with the path drawn as an arrow) or hold and fire. Then confirm.
3. **Batalla:** the map is hidden, because the battle is played on the physical table. The screen shows a summary of this turn's orders and a dice roller:
   - "Disparar" on a unit asks about the situation (distance, the target's terrain) and works out how many dice to roll.
   - "Tirada libre" rolls any number of dice.
   - "Ver mapa" brings the map back to record casualties and retreats so the app matches the table.

The UI is in Spanish.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Vitest in watch mode (`npx vitest run` for a single run) |
| `npm run build` | Production build to `dist/` |
| `npm run optimize-image -- <file> [maxWidth]` | Convert an image to WebP, scaled down, next to the original |

### Playing on an Android tablet

Run `npm run dev -- --host` and open `http://<your computer's IP>:3000` in Chrome on the tablet (both on the same network). On WSL2, enable mirrored networking (`networkingMode=mirrored` under `[wsl2]` in `%UserProfile%\.wslconfig`) and allow port 3000 through the Windows firewall.

## Project layout

- `src/game-core/`: game logic in plain TypeScript: board and pathfinding, units, cards, `GameSession` (the turn flow), dice and the fire-dice engine
- `src/data/`: scenarios, command cards, and `fireQuestions.ts` (the firing situations and their dice effects, the place to tune house rules)
- `src/components/`: React + MUI UI; the board is an SVG
- `docs/PLAN.md`: roadmap and known issues
- `CLAUDE.md`: conventions for working on the code

## Tech

React 19, TypeScript, Vite, MUI 9, Vitest + Testing Library.
