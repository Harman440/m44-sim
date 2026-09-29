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
| `npm run tablet` | Build and serve the production app on your network (port 4173), for installing on the tablet |
| `npm run icons` | Regenerate the app icon PNGs from `public/icons/icon.svg` |
| `npm run optimize-image -- <file> [maxWidth]` | Convert an image to WebP, scaled down, next to the original |

### Playing on an Android tablet

Run `npm run tablet` (a production build served on your network) and open `http://<your computer's IP>:4173` in Chrome on the tablet (both on the same network). On WSL2, enable mirrored networking (`networkingMode=mirrored` under `[wsl2]` in `%UserProfile%\.wslconfig`) and allow port 4173 through the Windows firewall. `npm run dev -- --host` (port 3000) also works for trying out changes, but without the offline app.

### Installing it as an app (works offline)

The app can be installed on the tablet's home screen and then works with no connection (fullscreen, no browser bar). Chrome only allows that on HTTPS or `localhost`, so a plain `http://<IP>` address needs one extra step on the tablet:

1. In Chrome on the tablet, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
2. Enable it and add `http://<your computer's IP>:4173`, then restart Chrome.
3. Open that address, then use Chrome's menu → **Instalar aplicación** (or "Añadir a pantalla de inicio").

Once installed it runs from the tablet's cache, so the computer only needs to be on to install or update it. When a new version is available the app shows "Nueva versión disponible"; the game in progress is kept when you update.

Hosting the app on an HTTPS site (for example GitHub Pages) removes steps 1 and 2.

## Project layout

- `src/game-core/`: game logic in plain TypeScript: board and pathfinding, units, cards, `GameSession` (the turn flow), dice and the fire-dice engine
- `src/data/`: scenarios, command cards, and `fireQuestions.ts` (the firing situations and their dice effects, the place to tune house rules)
- `src/components/`: React + MUI UI; the board is an SVG
- `docs/PLAN.md`: roadmap and known issues
- `CLAUDE.md`: conventions for working on the code

## Tech

React 19, TypeScript, Vite, MUI 9, motion, Vitest + Testing Library.

## Credits

- Icons: [game-icons.net](https://game-icons.net), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/): *cog*, *treasure map*, *hourglass*, *bugle call* and *scroll unfurled* by Lorc; *speaker*, *speaker off*, *crosshair*, *rolling dices*, *anticlockwise rotation*, *check mark*, *exit door*, *save* and *wooden crate* by Delapouite; *card draw* by Faithtoken; *cancel* by Sbed. The background of each icon was removed so it takes the text colour.
- Textures: [ambientCG](https://ambientcg.com) (Paper002, Paper003, Fabric045), CC0.
- Sounds: [Kenney](https://kenney.nl) Casino Audio and Impact Sounds, CC0.
- Scenarios: Sainte-Mère-Église is the map and units of the official Memoir '44 scenario (base game, scenario 2) by Days of Wonder, for personal use with the physical game.
- Fonts (SIL Open Font License, via Fontsource): Stardos Stencil, Special Elite, Black Ops One, Barlow Condensed, Allerta Stencil, IBM Plex Sans Condensed.
