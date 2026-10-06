# m44-sim

A companion web app for playing [Memoir '44](https://www.daysofwonder.com/memoir44/) with **simultaneous turns**, using a loose house variant rather than the official rules. Each player runs the app on their own device, a desktop browser or an Android tablet, next to the physical board.

Each turn:
1. **Carta:** pick a command card from your hand.
2. **Órdenes:** order the units that card activates on a digital copy of the map: move them (with the path drawn as an arrow) or hold and fire. Then confirm.
3. **Batalla:** the map is hidden, because the battle is played on the physical table. The screen shows a summary of this turn's orders and a dice roller:
   - "Disparar" on a unit asks about the situation (distance, the target's terrain) and works out how many dice to roll, or takes the number straight away ("Tirada rápida"). The roll is final; only a confirmed "Anular disparo" takes it back.
   - "Ver mapa" brings the map back to record casualties and retreats so the app matches the table.

"Ajustes" on the start menu picks one of three looks (field map, board-game box or command tent) and turns sound effects on or off.

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
| `npm run build` | Production build to `dist/` (includes the service worker for offline use) |
| `npm run tablet` | Build and serve the production app on your network (port 4173), for testing on the tablet before publishing |
| `npm run icons` | Regenerate the app icon PNGs from `public/icons/icon.svg` |
| `npm run optimize-image -- <file> [maxWidth]` | Convert an image to WebP, scaled down, next to the original |

### Playing on an Android tablet

Every push to `main` publishes the app to **https://harman440.github.io/m44-sim/** (GitHub Pages, `.github/workflows/deploy.yml`: typecheck, tests, then `vite build --base=/m44-sim/`; the run is in the repo's Actions tab). The Pages source in the repo settings must be "GitHub Actions".

To install it, open that address in Chrome on the tablet and use the menu → **Instalar aplicación** (or "Añadir a pantalla de inicio"), then open it once from the icon so it caches everything. From then on it runs fullscreen and works with no connection. When a new version has been published, the app shows "Nueva versión disponible" the next time it's opened online; the game in progress is kept when you update.

Saved games belong to the address they were played on: a game saved on one address (Pages, `npm run tablet`, the dev server) isn't seen on another.

### Testing on the local network

`npm run tablet` serves a production build on your network (port 4173), and `npm run dev -- --host` the dev server (port 3000, without the offline app), at `http://<your computer's IP>:<port>` in Chrome on the tablet. On WSL2 the tablet can only reach them with mirrored networking (`networkingMode=mirrored` under `[wsl2]` in `%UserProfile%\.wslconfig`, Windows 11 22H2 or later) and the port allowed through the Windows firewall, or on older Windows with a `netsh interface portproxy` rule to the WSL IP. Installing from a plain `http://<IP>` address also needs `chrome://flags/#unsafely-treat-insecure-origin-as-secure` enabled for that address on the tablet.

## Project layout

- `src/game-core/`: game logic in plain TypeScript: board and pathfinding, units, cards, `GameSession` (the turn flow), dice and the fire-dice engine
- `src/data/`: scenarios, command cards, and `fireQuestions.ts` (the firing situations and their dice effects, the place to tune house rules)
- `src/components/`: React + MUI UI; the board is an SVG
- `docs/PLAN.md`: roadmap and known issues
- `CLAUDE.md`: conventions for working on the code

## Tech

React 19, TypeScript, Vite, MUI 9, motion, Vitest + Testing Library.

## Credits

- Icons: [game-icons.net](https://game-icons.net), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/): *cog*, *treasure map*, *hourglass*, *bugle call*, *scroll unfurled*, *crossed swords*, *checked shield* and *battle tank* by Lorc; *speaker*, *speaker off*, *crosshair*, *rolling dices*, *anticlockwise rotation*, *check mark*, *exit door*, *save*, *wooden crate*, *falling bomb*, *mortar* and *village* by Delapouite; *field gun* by Quoting; *airplane* and *tank tread* by Skoll; *card draw* by Faithtoken; *cancel* by Sbed. The background of each icon was removed so it takes the text colour.
- Textures: [ambientCG](https://ambientcg.com) (Paper002, Paper003, Fabric045), CC0.
- Sounds: [Kenney](https://kenney.nl) Casino Audio and Impact Sounds, CC0.
- Scenarios: Pegasus Bridge and Sainte-Mère-Église are the maps and units of the official Memoir '44 scenarios (base game, scenarios 1 and 2) by Days of Wonder, for personal use with the physical game.
- Fonts (SIL Open Font License, via Fontsource): Stardos Stencil, Special Elite, Black Ops One, Barlow Condensed, Allerta Stencil, IBM Plex Sans Condensed.
