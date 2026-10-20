# m44-sim roadmap, part 3

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

Earlier plans are finished and kept in [oldPlans/](oldPlans/): [part 1](oldPlans/PLAN.md) (Steps 0–34), [part 2](oldPlans/PLAN-part2.md) (Steps 35–66) and [pass and play](oldPlans/PASS_AND_PLAY.md) (PP1–PP7). This plan gathers what they left open. Steps that part 2 planned but didn't build keep their numbers (54–57 and 66), so commits and code comments that mention them still match; new steps start at 67. The house rules are in [house-rules.md](house-rules.md), and the player's loose notes for later in [myNextPlan.md](myNextPlan.md).

## Where we are

Two ways to play:
- **Own tablets:** one device per side, next to the physical board. The full turn loop works and survives reloads: Menu → Carta → Órdenes → Movimiento → Batalla → Final → next turn, with the attacker's extra first turn, the house command and combat decks (rebalanced in part 2's Part J), supplies, combat card effects, the long-range die, a rule book, and Spanish and English. Two decisions still hold here: **each device knows only its own side** (anything about the opponent is done at the table), and **no figure counts** (the app tracks whole units).
- **Pass and play:** both sides on one device, with everything played in the app, figures per unit and the hits dealt by the app. What's left of it is in [PASS_AND_PLAY_NEXT.md](PASS_AND_PLAY_NEXT.md).
- **Against the computer:** pass and play with the computer as one side (built, with fog of war and the combat cards it knows); what's left is in [PLAY_THE_COMPUTER.md](PLAY_THE_COMPUTER.md).

Four built-in scenarios, all settled: Forêt d'Écouves, Arracourt, Sainte-Mère-Église and Pegasus Bridge. A map editor whose maps go into "Mis mapas" on the device; a new map's settings (big guns, air sorties, hands…) are decided as it's made, in the editor or from the scenario's PDF (Step 67).

---

## Part A: The card rebalance, checked

### Step 66: A test game
Skipped in part 2 (the player's call, 2026-10-16); the rest of Part J is built.
- [ ] With "Modo prueba": a whole game on own tablets and a pass and play match using every changed card, at 1280×800 and 800×1280 with touch, in Spanish and English

## Part B: Map editor, the rest

Steps 49–53 are built (the scenario file, board art in the browser, the editor, the scenario's settings, Mis mapas).

### Step 54: Sending a map to the other tablet
- [ ] "Compartir": a link to the app with the map in the hash (`#map=…`: the JSON compressed with `CompressionStream` in base64url, uncompressed where the browser lacks it), sent with the Web Share API on the tablets or copied on desktop
- [ ] Opening the link asks "¿Añadir «…» a Mis mapas?" after `parseScenario` has checked it, then clears the hash. If a map with the same id and other content is already there, it asks before replacing it. A link opened during a game waits: it's asked about once the player is back in the menu
- [ ] "Exportar" downloads `<id>.m44map.json` (also asked for in [REFACTOR_PLAN.md](REFACTOR_PLAN.md), with "export all" as a backup) (`downloadJson`; built with Step 55), and "Importar" in Mis mapas reads one with the file picker. The iPad needs it: an app added to the home screen keeps its own storage, apart from Safari, so a link opened in Safari would land in Safari's maps (check on the iPad)
- [ ] Test the round trip (link and file give back the same scenario); a broken link or file shows a message and changes nothing

### Step 55: Adding a map to the catalog
- [x] `npm run add-scenario -- <file>`: checks the exported file (`parseScenario`), writes `src/data/catalog/<id>.json`, adds its board to `scripts/boards.json` (`compose-board.mjs` reads the terrain from the scenario file), and runs `npm run board -- <id>` for the painted art, with ridges (rivers drawn when no tile fits a bend; a bigger board, or a river fork no tile fits, isn't painted: the app draws its art)
- [x] Then by hand: the description in both languages, the sources and rulings in `notes`, `drawn` or `separateHills` in `boards.json` if the art needs them, and tests for any special rule. Pushing to `main` deploys it to every device
- [x] The script keeps the map's id, terrain and units as exported (it only adds texts and notes), so a game in progress on the device's copy goes on with the catalog's after an update
- [x] A map that's both in the catalog and on the device shows once, the catalog's version, and the menu offers to delete the device's copy
- [x] The rule book's tutorial (`ruleBook.ts`), the README and CLAUDE.md describe the editor, the scenario file and `npm run add-scenario`

### Step 56: Maps made by Claude Code
- [ ] **Decided:** for now Claude Code makes the maps, not the app (no API key or network in the app). The player asks for a battle, or for a made-up map; Claude Code writes the scenario file, the player looks at it on the tablet (Importar, Step 54), and it goes into the catalog (Step 55)
- [ ] **Decided:** the historical background comes first: a real battle keeps its historical forces, ground and situation, even when one side is weaker. No fairness score
- [ ] A project skill, `.claude/skills/new-scenario/`, so every session makes them the same way: the sources (the official scenario if there is one, orders of battle, maps of the ground), the ground laid on the 13×9 board and its sections, the units, elite units, wire and sandbags, hands and attacker, air and big guns (the rules the built-ins follow), the texts in both languages, and every source and guess in `notes`
- [ ] `Scenario.history` (optional, `Localized`): the historical background (the date, the units, what happened and how it ended), a few paragraphs in the menu's scenario panel under the description. The built-ins get theirs, and "Datos del escenario" a field per language
- [ ] A made-up map says so in its description, and is still set in a real theatre and year
- [ ] Checked with `parseScenario` before the player sees it (`npm run add-scenario -- --check <file>`)

### Step 57: Sharing with a QR code
- [ ] "Compartir" also shows the link as a QR code, for two tablets side by side: the other tablet's camera reads it and opens the link (Step 54)
- [ ] A small QR library with a licence that allows it, credited in the README, loaded only when the code is shown
- [ ] The link short enough for a code a camera reads at a glance from a screen: measure it on the busiest built-in map, and write positions more compactly if it's too long
- [ ] Check on the iPad: its camera opens links in Safari, not in the app on the home screen (Step 54). If the map lands in Safari, add "Escanear" to Mis mapas (the camera and a QR reader in the app)

## Part C: Scenarios from PDFs

### Step 67: Reading a scenario's PDF
**Decided:** Claude Code reads the PDF (an official scenario sheet, or another source the player gives), not the app. Sainte-Mère-Église was read this way by hand, with a hex grid laid over the map image.
- [ ] Step 56's skill covers a PDF too: the map read hex by hex onto the 13×9 board (terrain, units, wire, sandbags, elite badges), the hands and the attacker, the scenario's air and artillery rules into `airPower` and `bigGuns`, and the special rules and medals into the description and `notes`
- [ ] The player checks the map on the tablet (Importar, Step 54, then the editor to fix it) before it goes into the catalog (Step 55)
- [ ] **Decide** per scenario: which special rules the app applies and which stay at the table

### Step 68: New unit types
Postponed from the first plan (old Step 29). No Tigers (decided then). **Decided:** built once a scenario read from a PDF (Step 67) has them, so the rules come from that scenario.
- [ ] Mobile artillery: 3 figures, hit like tanks, fires 3-3-2-2
- [ ] Jeep: 2 figures, fires 3-2, only grenades hit it
- [ ] Half-track: fires 3-2, moves 3 hexes
- [ ] For each: `UnitType`, movement, fire table, hit rules (`data/hitRules.ts`), figures for pass and play (`data/figures.ts`), sprites, the map editor's units and scenario data
- [ ] **Decide:** what the notes leave open (how far mobile artillery and jeeps move, whether half-tracks carry infantry)
- [ ] The new units go in the rule book (`data/ruleBook.ts`)

## Part D: Games

### Step 69: Import a game
Postponed from the first plan (old Step 34).
- [ ] "Importar partida" on the start menu: load a JSON file exported from "Historial", check it with `GameSession.restore` and carry on from it. One-side games only, not pass and play

## Part E: Bigger boards and boards of any shape

The player's notes: "more hexes, more map sizes".

### Step 70: Bigger rectangular boards
Built on 2026-10-19 (`63ed482`), before the any-shape plan below was written into this file.
- [x] **Decided:** any size, grown in the map editor by adding hexes of any terrain at the edges (a column on the left or right, two rows at the top or bottom), from 13×9 up to 21×17; the left and right sections are each about a third of the board, as on the official big boards; played in pass and play and against the computer first
- [x] `Scenario.board` and the file's `board` (`"standard"` or `{ cols, rows }`), the board, its sections and `turnedRound` at any size (`game-core/boardSize.ts`)
- [x] "Tamaño del mapa" in the editor (`BoardSizeDialog`, `resizeBoard`), and the board art drawn at any size
- [ ] Own tablets on a bigger map: the menu offers no own-tablet game for one yet

### Any shape: what's left
**Decided (2026-10-16):** a map can have any shape. The editor adds an empty countryside hex next to the outline, or removes an empty one anywhere, holes included. Sections are worked out from the width, in thirds. Only the hexes are drawn, with no frame. It's for Mis mapas first: the built-ins and `npm run board` stay 13×9, and painted art for other shapes comes later.

- [ ] **Decide** first: this doesn't match Step 70 as built. Step 70 grows a map by whole columns and pairs of rows of any terrain, keeps the rows odd and stops at 21 across; this plan adds and removes single countryside hexes, allows an even number of rows and needs 26 across for Overlord. Either Steps 71–75 go ahead on top of `boardSize.ts`, or Part E stops at rectangles and only the limits change (26×17?)

Step 70 already did the rectangle part of what the 13×9 grid assumed. What still assumes a full rectangle:
- `BoardManager` builds every hex of the rectangle (`isValidPosition`)
- `turnedRound` takes the size (no default any more), but only works with an odd number of rows (`isBoardSize` keeps them odd)
- `Hex._setSide`: from `sectionLines(cols)`
- `isOnBoard` in `boardSize.ts` (now the only one) and the schema (`board`: `"standard"` or `{ cols, rows }` within `BOARD_LIMITS`)
- `boardGeometry`: still the tuned `ORIGIN_X`/`ORIGIN_Y`, with the width from `cols`
- `Board.renderBoard`: loops over the rectangle and throws on a missing hex
- the board art: `boardKeys(cols, rows)`; a bigger board's art is the empty board's hexes with its frame filled in

### Step 71: The board's shape in game-core
- [ ] `game-core/boardShape.ts` (or `boardSize.ts` grown into it): `BoardShape`, the set of hexes, with its box (rows, and columns counted in half hexes so odd rows line up), `has`, `turnedRound` and `sectionOf`. `standardShape` is 13×9, and a `BoardSize` is a full rectangle shape. A scenario's shape comes from `Scenario.hexes`, or from `Scenario.board` when it has none
- [x] ~~`turnedRound` with no default size~~: done in Step 70 (it takes a `BoardSize`)
- [ ] `turnedRound` on a shape: it turns the board about the box's centre, with the box widened half a hex when that's needed to land on whole hexes, and it works with an even number of rows too
  - Tests: turning twice gives the position back; the standard board and Step 70's sizes give what they give today; and a hex's centre turned is its centre reflected through the middle of the box, for any shape
- [x] Sections in thirds for rectangles: done in Step 70 (`sectionLines`, the standard board unchanged)
- [ ] Sections on a shape's box, symmetric when turned, so pass and play's mirrored sections still hold. Tests on 26×9 and a board with an even number of rows
- [ ] `BoardManager` builds only the shape's hexes: `isValidPosition` is `shape.has`
- [ ] **Decide** with the player: a missing hex behind a unit counts as the board's edge (a hex it can't retreat is a hit). That's what `retreatOptions` does today without a change, so a hole or a notch blocks retreats
- [x] Moving every position when the board grows up or left: done for whole rows and columns in Step 70 (`resizeBoard`)
- [ ] The same for a single hex added above or to the left (`moveMap`, through axial coordinates, so the top row stays row 0)
- [ ] No change to what the player sees: every existing test passes as it is

### Step 72: The shape in the scenario file and the editor's draft
- [ ] `ScenarioFile.board` is `"standard"`, `{ cols, rows }` (Step 70) or the list of the board's hexes, and the scenario gets `hexes`. `toScenarioFile` writes the shortest form that fits, so the files that exist don't change. Update the schema and keep its test in step
- [x] `validateScenario` checks positions against the size (`offBoard`) and the size against `BOARD_LIMITS` (`boardSize`): done in Step 70
- [ ] New `ScenarioProblem`s for a shape, in both languages:
  - no hexes
  - the board is in more than one piece
  - its box bigger than `BOARD_LIMITS` (**Decide** the limits: today 21×17; Overlord needs 26×9)
- [ ] `scenarioDraft`: `addHex` and `removeHex`. Only an empty countryside hex can be removed (no terrain, unit, wire or sandbags), and adding a hex above or to the left of the board goes through `moveMap`. `strokeOf` covers a stroke of either. Each is one undo step. Tests
- [ ] Saves: the shape travels with the scenario. Check that a saved game and a saved match on a map from Mis mapas come back with their shape, and bump `SAVE_VERSION` / `MATCH_SAVE_VERSION` if the saves' shape changes

### Step 73: Drawing any shape
- [ ] `boardGeometry` from the shape's box instead of the tuned `ORIGIN_X`/`ORIGIN_Y`. `Board` draws the shape's hexes. The image is laid in the box and turned for the Axis about the box's centre. This covers the `focus` crop, `HexThumbnail`, `MapPreview` and the menu's thumbnail (check how each sizes a bigger board now)
- [ ] Board art:
  - a countryside tile in the library (`scripts/board-art/tiles/plains/`: a few plain hexes cut from the empty board, so the look stays the same). Step 70 already makes a bigger board's art from the empty board's hexes; reuse that
  - `boardPlan` takes its hex keys from the shape, not `boardKeys(cols, rows)`
  - `drawBoard` for any other shape gives each hex its tile and leaves outside the shape transparent (the app's background), with a soft edge round the outline (`softLines.mjs`)
- [ ] The standard shape keeps the empty-board base, so the built-ins and the maps already in Mis mapas look as they do now, and `npm run board`'s images stay byte for byte as they were (run it and check `git status`)
- [x] `mapArt`'s cache key includes the size: done in Step 70
- [ ] …and the shape

### Step 74: The editor's "Tablero" tool
- [ ] A tool that draws a ring of ghost hexes round the outline, each with a "+". Tapping one adds a countryside hex; tapping an empty countryside hex removes it; a stroke adds or removes along the finger. Tapping a hex that has something on it says why it can't go. The tap targets are 48px on the tablet. Decide whether it replaces "Tamaño del mapa" (`BoardSizeDialog`) or sits beside it
- [ ] `NewMapDialog` offers a starting board: Estándar (13×9), Breakthrough (13×17), Overlord (26×9), or a copy of a scenario
- [ ] The board's size is shown in "Datos del escenario" and the menu's panel (the menu says it today only for a bigger map, as a note that it's played in pass and play)
- [ ] The rule book's tutorial, the README and CLAUDE.md describe it (the rule book and CLAUDE.md mention Step 70's bigger maps already)

### Step 75: Playing on a big board
- [ ] A whole game on own tablets (after Step 70's last item) and a pass and play match on a 26×9 map and a 13×17 map, at 1280×800 and 800×1280 with touch. Check:
  - the sections
  - retreats on a ragged edge
  - FireAim's crop
  - the Axis turned round
  - the reveal and the shared battle
- [ ] **Decide** after seeing it: in portrait a 26-wide board's hexes are about 30px, under the 48px tap target (21 wide, today's limit, is already about 37px). Possible answers are "+"/"−" zoom buttons with dragging the map, or showing one section at a time while giving orders

## Later

### Painted art for bigger boards and any shape
- [ ] `npm run board` and `compose-board.mjs` for any size and shape, so a big map can go into the catalog with painted art (with Step 55)

---

## Checks for every step
- `npm run typecheck` reports 0 errors, and `npx vitest run` passes.
- `npm run dev` (port 3000), then check the flow by hand or with Playwright, at 1280×800 and 800×1280 with touch, and on desktop, in at least one look:
  1. Menu → start a game; the initial hand deals in.
  2. Picking a card highlights the right units.
  3. Issue orders, then undo, then commit, then movement (the cards played show above the instructions), then battle.
  4. Fire with a unit: the dice roll once, the unit shows as fired, and a reload doesn't bring the roll back.
  5. Sync a casualty on the map, end the battle, draw a card and start the next turn.
  6. Only the one new card animates in, and the deck and discard counts add up.
  7. Reload in each phase: the game resumes where it was.
- For changes that touch pass and play, play a turn in "Pasar y jugar" as well: cover screen, reveal, movement, shared battle, final phase.
- New UI text is in both languages, and the screens changed are checked in English as well as Spanish.
