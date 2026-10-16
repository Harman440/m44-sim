# m44-sim roadmap, part 3

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

Earlier plans are finished and kept in [oldPlans/](oldPlans/): [part 1](oldPlans/PLAN.md) (Steps 0–34), [part 2](oldPlans/PLAN-part2.md) (Steps 35–66) and [pass and play](oldPlans/PASS_AND_PLAY.md) (PP1–PP7). This plan gathers what they left open. Steps that part 2 planned but didn't build keep their numbers (54–57 and 66), so commits and code comments that mention them still match; new steps start at 67. The house rules are in [house-rules.md](house-rules.md), and the player's loose notes for later in [myNextPlan.md](myNextPlan.md).

## Where we are

Two ways to play:
- **Own tablets:** one device per side, next to the physical board. The full turn loop works and survives reloads: Menu → Carta → Órdenes → Movimiento → Batalla → Final → next turn, with the attacker's extra first turn, the house command and combat decks (rebalanced in part 2's Part J), supplies, combat card effects, the long-range die, a rule book, and Spanish and English. Two decisions still hold here: **each device knows only its own side** (anything about the opponent is done at the table), and **no figure counts** (the app tracks whole units).
- **Pass and play:** both sides on one device, with everything played in the app, figures per unit and the hits dealt by the app. What's left of it is in [PASS_AND_PLAY_NEXT.md](PASS_AND_PLAY_NEXT.md).

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
- [ ] "Exportar" downloads `<id>.m44map.json` (`downloadJson`), and "Importar" in Mis mapas reads one with the file picker. The iPad needs it: an app added to the home screen keeps its own storage, apart from Safari, so a link opened in Safari would land in Safari's maps (check on the iPad)
- [ ] Test the round trip (link and file give back the same scenario); a broken link or file shows a message and changes nothing

### Step 55: Adding a map to the catalog
- [ ] `npm run add-scenario -- <file>`: checks the exported file (`parseScenario`), writes `src/data/catalog/<id>.json`, adds its board to `scripts/boards.json` (`compose-board.mjs` reads the terrain from the scenario file), and runs `npm run board -- <id>` for the painted art, with ridges
- [ ] Then by hand: the description in both languages, the sources and rulings in `notes`, `drawn` or `separateHills` in `boards.json` if the art needs them, and tests for any special rule. Pushing to `main` deploys it to every device
- [ ] The script keeps the map's id, terrain and units as exported (it only adds texts and notes), so a game in progress on the device's copy goes on with the catalog's after an update
- [ ] A map that's both in the catalog and on the device shows once, the catalog's version, and the menu offers to delete the device's copy
- [ ] The rule book's tutorial (`ruleBook.ts`), the README and CLAUDE.md describe the editor, the scenario file and `npm run add-scenario`

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

## Later

### Step 70: Other board sizes
- [ ] **Decide:** which sizes (the player's notes: "more hexes, more map sizes"). `ScenarioFile.board` is only `"standard"` (13×9) for now, and the board, its sections, the board art and the editor all assume it

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
