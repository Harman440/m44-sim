# m44-sim

A companion web app for playing [Memoir '44](https://www.daysofwonder.com/memoir44/) with **simultaneous turns**, using a loose house variant rather than the official rules. Each player runs the app on their own device, a desktop browser or an Android tablet, next to the physical board.

Each turn:
1. **Carta:** play one of your side's command cards, paid with supplies, or none. A card played waits a few turns before it can be played again.
2. **Órdenes:** give each unit an action on a digital copy of the map (move, fire, reload, fortify…), paid from its own supplies: morale, energy, ammo and equipment for infantry, fuel and shells for armour and artillery. A unit with no action rests. Then confirm.
3. **Batalla:** the map is hidden, because the battle is played on the physical table. The screen lists the units that fire, in order:
   - Tapping a unit picks its fire option, then its target on the map, and works out how many dice to roll. The roll is final; only a confirmed "Anular disparo" takes it back.
   - "Ver mapa" shows the map; after the battle, "Actualizar mapa" records casualties and retreats so the app matches the table.

"Ajustes" (Settings) on the start menu picks the language, one of three looks (field map, board-game box or command tent) and turns sound effects on or off.

Two other ways to play, with no physical board: **Pasar y jugar** (pass and play), both sides on one device, and **Contra el ordenador** (against the computer), pass and play with the computer as the other side (it plays the command cards, picks each unit's action and each shot's fire option).

The UI is in Spanish and English. It starts in the browser's language (Spanish for any Spanish locale, English otherwise), and the choice in Settings is remembered per device. Each player picks their own, so two players can play in different languages.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run check` | Typecheck and every test, before committing |
| `npm test` | Vitest in watch mode (`npx vitest run` for a single run) |
| `npm run test:core` | Only the rules tests, in plain Node (about 10 s) |
| `npm run build` | Production build to `dist/` (includes the service worker for offline use) |
| `npm run tablet` | Build and serve the production app on your network (port 4173), for testing on the tablet before publishing |
| `npm run icons` | Regenerate the app icon PNGs from `public/icons/icon.svg` |
| `npm run optimize-image -- <file> [maxWidth]` | Convert an image to WebP, scaled down, next to the original |
| `npm run add-scenario -- <file>` | Add a map exported from "Mis mapas" to the app's catalog, with its board art |

### Maps from the editor on every device

The map editor keeps its maps in "Mis mapas", in that browser on that device only. To give one to every device, put it in the catalog:
1. In the menu, pick the map in "Mis mapas" and press **Exportar**: it downloads `<id>.m44map.json` (to Descargas on Android).
2. Bring the file to the computer and run `npm run add-scenario -- <file>` (`--check` only checks it; `--replace` updates a map already in the catalog). It checks the map, writes `src/data/catalog/<id>.json` and paints its board art (`src/assets/scenarios/<id>.webp`).
3. Add the description in both languages if it has none, and sources or rulings in `notes`, then `npm run check` and push to `main`.

Every device gets the map when the app updates. A device that still has its own copy shows the catalog's, and a game in progress on it carries on; the menu offers "Borrar mi copia".

### Playing on an Android tablet

Every push to `main` publishes the app to **https://harman440.github.io/m44-sim/** (GitHub Pages, `.github/workflows/deploy.yml`: typecheck, tests, then `vite build --base=/m44-sim/`; the run is in the repo's Actions tab). The Pages source in the repo settings must be "GitHub Actions".

To install it, open that address in Chrome on the tablet and use the menu → **Instalar aplicación** (or "Añadir a pantalla de inicio"), then open it once from the icon so it caches everything. From then on it runs fullscreen and works with no connection. When a new version has been published, the app shows "Nueva versión disponible" the next time it's opened online; the game in progress is kept when you update.

It needs Safari 16.2 or later (iPadOS and macOS), Chrome 111, Firefox 113 or a recent Edge; an older browser gets a page saying so and what to update (`src/browserSupport.ts`). Every browser on an iPad uses Safari's engine, so there it's the iPadOS version that counts.

Saved games belong to the address they were played on: a game saved on one address (Pages, `npm run tablet`, the dev server) isn't seen on another.

### Testing on the local network

`npm run tablet` serves a production build on your network (port 4173), and `npm run dev -- --host` the dev server (port 3000, without the offline app), at `http://<your computer's IP>:<port>` in Chrome on the tablet. On WSL2 the tablet can only reach them with mirrored networking (`networkingMode=mirrored` under `[wsl2]` in `%UserProfile%\.wslconfig`, Windows 11 22H2 or later) and the port allowed through the Windows firewall, or on older Windows with a `netsh interface portproxy` rule to the WSL IP. Installing from a plain `http://<IP>` address also needs `chrome://flags/#unsafely-treat-insecure-origin-as-secure` enabled for that address on the tablet.

## Project layout

- `src/game-core/`: game logic in plain TypeScript: board and pathfinding, units and their actions and supplies, command cards, `GameSession` (the turn flow), dice and the fire-dice engine
- `src/data/`: scenarios, the units' actions and supplies, command cards, and `fireQuestions.ts` (the firing situations and their dice effects, the place to tune house rules)
- `src/components/`: React + MUI UI; the board is an SVG
- `src/i18n/` and `src/labels/`: the two languages: the language setting and hooks, and the names of game things (units, terrain, supplies…) in each language
- `docs/PLAN.md`: roadmap and known issues
- `docs/PASS_AND_PLAY_NEXT.md`: what's left of pass and play
- `docs/PLAY_THE_COMPUTER.md`: playing against the computer
- `docs/ACTIONS_PLAN.md`: the actions game, which replaced the card game
- `docs/oldPlans/`: the finished plans
- `CLAUDE.md`: conventions for working on the code, and a map of it
- `docs/ARCHITECTURE.md`: what each module does, in detail

## Tech

React 19, TypeScript, Vite, MUI 9, motion, Vitest + Testing Library.

## Credits

- Icons: [game-icons.net](https://game-icons.net), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/): *cog*, *treasure map*, *hourglass*, *bugle call*, *scroll unfurled*, *crossed swords*, *checked shield*, *battle tank*, *open book*, *back forth*, *medal*, *rally the troops*, *bullets*, *clover* and *fishing net* by Lorc; *speaker*, *speaker off*, *crosshair*, *rolling dices*, *anticlockwise rotation*, *check mark*, *exit door*, *save*, *wooden crate*, *falling bomb*, *mortar*, *village*, *running shoe*, *jerrycan*, *heavy bullets*, *dynamite* and *first aid kit* by Delapouite; *field gun* by Quoting; *airplane* and *tank tread* by Skoll; *card draw* by Faithtoken; *cancel* by Sbed. The background of each icon was removed so it takes the text colour.
- Textures: [ambientCG](https://ambientcg.com) (Paper002, Paper003, Fabric045), CC0.
- Sounds: [Kenney](https://kenney.nl) Casino Audio and Impact Sounds, CC0.
- Scenarios: Pegasus Bridge and Sainte-Mère-Église are the maps and units of the official Memoir '44 scenarios (base game, scenarios 1 and 2) by Days of Wonder, for personal use with the physical game.
- Board art: built on Days of Wonder's Memoir '44 board art (the empty countryside board, the terrain tiles, the expansions' town tiles, the beach, swamp, river and lake hexes of the digital edition's board, the ocean and surf hexes, and the bridge, barbed wire and sandbags pieces), for personal use with the physical game.
- Fonts (SIL Open Font License, via Fontsource): Stardos Stencil, Special Elite, Black Ops One, Barlow Condensed, Allerta Stencil, IBM Plex Sans Condensed.
