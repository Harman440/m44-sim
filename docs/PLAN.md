# m44-sim roadmap, part 2

We work through this one step at a time. Each step is its own commit on `main`. Tick items off (`[x]`) when they're done. Items marked **Decide** need an answer from the player before they are built: the rules are a house variant, so don't assume official M44.

The first plan (Steps 0–34) is finished and kept in [oldPlans/PLAN.md](oldPlans/PLAN.md); commits and code comments that mention a step number up to 34 refer to it. This plan carries on from Step 35. The house rules are in [house-rules.md](house-rules.md).

## Where we are

The full turn loop works on each player's device and survives reloads: Menu → Carta → Órdenes → Movimiento → Batalla → Final → next turn, with the attacker's extra first turn, the house command and combat decks, coins, combat card effects and the long-range die. Four scenarios: Forêt d'Écouves, Arracourt, Sainte-Mère-Église (official map, with hedgerows, a hill and the paratrooper drop) and Pegasus Bridge (official map, with rivers, bridges and a pond).

The two decisions from the first plan still hold:
- **Each tablet stays independent** and knows only its own side. Anything about the opponent is done at the table, and the app reminds the player when.
- **No figure counts.** The app tracks whole units.

---

## Part A: Bugs

### Step 35: Known bugs
- [x] Tactician can still be played with a card that orders several sections (like General Advance): it's paid for but does nothing, and the app doesn't warn. The session refuses it (`combatCardFits`), and the cards screen warns and offers to play the command card alone
- [x] A dice combat card isn't offered on a "Tirada rápida" shot, because there the player enters the dice. The quick roll now asks whether to use it and adds its dice to the number entered
- [x] Reinforcements and Sniper can't add their unit to the map: the cross marks where it goes, but nothing appears
  - [x] **Decided:** Sniper is taken out of the game (the player doesn't want snipers)
  - [x] **Decided:** Reinforcements: in the final phase the app rolls the die, reads the scenario's table and puts the unit on the cross (`rollReinforcements`). If the cross was taken by then, the player taps an empty hex (`placeReinforcement`). The new unit is a battle edit, so "Deshacer" takes it off again

## Part B: Screens

### Step 36: Everything fits on the screen
- [x] No page scroll on the game screens in landscape: the game screen is one screen high (`GameView.css`), and only lists (the hand, combat cards, the turn summary, a crowded controls column) scroll inside their own box. Cards: title and small piles in one row, hand on the left, combat cards in a column. Battle: turn summary on the left, who fires first and the combat cards on the right. Final phase: the three steps side by side
- [x] Checked each phase and the dialogs at 1280×800, 1024×768, 1366×768 and 1920×1080
- [ ] **Later:** portrait (800×1280) still scrolls the page; the player asked to leave it for now. The menu also still scrolls at 800px high

### Step 37: Choosing a card
- [x] Go back after a card is chosen: "Cambiar carta" in Órdenes while no order has been given (`unpickCard`; a combat card played with it goes back to the hand, and its coins come back)
- [x] Look at a card as a preview without playing it: tapping a card in the hand puts it on the table with its full text (`CardDetails`); a command card is played from there ("Jugar esta carta"), an order combat card is picked there ("Jugarla con la carta de mando"). The final phase shows the drawn cards the same way
- [x] "Mostrar al rival" also shows the command card chosen, and the combat card played with it
- [x] Also: playing-card shaped cards (5:7, sized from `--card-width`) held in a fanned hand (`CardHand`) that scrolls sideways, with the combat cards on the right
- [x] Movement phase redesign: "Mostrar al rival" is gone; the command card and order combat card played sit above the instructions, and tapping one shows its full text
- [x] No UI text refers to physical cards: the app replaces them (no "boca abajo en la mesa", "Descubre tu carta", "cartas que juegues en la mesa")

### Step 38: Battle screen
- [x] Rework the battle info so combat cards and coins stand out more (what's in hand, what can be played now, what it costs)
- [x] **Decided** (mock-up option A): the fire order as a tight list on the left, the reserve (coins and battle combat cards) filling the rest of the screen. The reserve's coin count replaces the header counter in the battle
- [x] Fire order as numbered steps: 1 collisions, 2 an attack combat card (Barrera…) as rows per marked hex, 3 units that didn't move, 4 moved units. Each row shows the unit, its hex (a thumbnail of the board art) and its section as icons, not how far it moved; tapping the row opens the fire dialog (no "Disparar" button)
- [x] Instructions and long warnings go into an "Instrucciones" dialog; only a short "who fires first" chip stays on screen
- [x] No command card summary; "Ver mapa" looks like Movimiento, with the cards played (command card and order combat card) above, tappable for their full text

## Part C: Firing and feel

### Step 39: A better fire questionnaire
- [x] Taking ground: armour that wins a close assault can take ground and fire again; infantry can too only with Fragor del combate. **Decided:** the extra shot is close assault only (from the hex taken), once per unit per turn. Offered in the fire dialog after a close assault ("Tomar terreno"), and said in the battle's "Instrucciones"
- [x] Start from the firing unit: its hex, range and dice at each distance in the fire dialog's title
- [x] **Decided:** tap the target's hex on the map. The dialog shows the part of the board in range, with the hexes it can fire at (in range, in sight, dice > 0) and their dice; the tap answers the distance and terrain, then the unit type (with the unit art) and sandbags (a toggle) in the same dialog, and the dice add up as they're answered
- [x] Follow-up: shorter title and range ("Alcance: 3 / 2 / 1"), smaller unit-type buttons, sandbags as a one-line switch with an icon, and in the open they take a die, except from artillery, which never loses dice to cover (house rule, `SANDBAGS_IN_THE_OPEN`); the target ignores 1 flag whoever fires. No more quick roll. Official hill rule: from a hill at a hill, fire as in the open and see over the hills between. Taking ground is offered only after a hit or a flag, and moves the unit on the map
- [x] **Decided:** line of sight from the terrain (forest, town, hill, hedgerow) and this side's units in between; enemy units in between can't be known, so the player still checks the table.

### Step 40: Dice and coin animations
- [x] Better dice roll animations, and different dice (the 8-sided long-range die looks like its own die): a fresh roll throws the dice in, spinning through faces until they land, then each die is marked (impacto / retirada / moneda) and the totals show. Opening an old shot again doesn't replay it. The 8-sided die is an octagon in its own colour with an 8 in the corner
- [x] Coins animate when earned or spent (the counter, and in the ledger): the number pops and the change floats up (`CoinCount`); new ledger lines slide in
- [x] Respect reduced motion; keep sounds optional
- [x] Also: the shot result is compact. The calculation is a row of icons (`ShotSteps`: the unit and its base dice, the target's hex, sandbags, cards ➜ the target and asalto/distancia), no "N dados" line, the hits, retreats and coins as one row of small tallies, and "Tomar terreno" as one line with an info button for the explanation

## Part D: Rules

### Step 41: Coins on the attacker's extra turn
- [x] The attacker earns coins on the extra first turn but can't spend them (no extra orders, combat cards or changes by hand there); they carry over to turn 2
- [x] **Decided:** stars rolled count in the extra turn; the final-phase reward (2 coins or a combat card, and Preparations' reward) is skipped
- [x] **Decided:** the defender gets nothing in return

### Step 41b: Final phase and card faces
- [x] Final phase: each step is one line, its explanation behind an info button; step 1 is the title with "Actualizar mapa" beside it; "Empezar turno N" is always in sight (disabled, with what's missing, until it can be pressed)
- [x] The command card drawn is kept at once: no "Quedármela" (only "Descartar y robar otra", or "Elegir" among Recon's 3)
- [x] The final-phase reward defaults to 2 suministros; the combat card can still be picked instead
- [x] "Actualizar mapa" in Órdenes, before any order and after a confirmation, to fix a map that doesn't match the table (a roll changed at the table). Those fixes can't be undone after the orders
- [x] Card faces: no text; the art fills the card, with a token per ordered unit and a row of pictograms per special rule. Tapping a card anywhere shows its full text

## Part E: Maps and scenarios

### Step 42: More terrain
- [x] Card art: command and combat cards drawn from their rules (commit `d2b7015`)
- [x] Hills drawn by `npm run board` (`scripts/terrain-tiles.mjs`)
- [x] Hedgerows: `HexType.HEDGEROW` with the official rules (enter only from an adjacent hex and stop, no firing that turn, leave 1 hex; infantry −1, tanks −2) and their art
- [x] Sainte-Mère-Église, the official base-game scenario, with its paradrop (`Scenario.paradrop`, the PARADROP phase)
- [x] Rivers, bridges and lakes: `HexType.RIVER`, `BRIDGE` and `LAKE`, drawn by `npm run board` (a river flows through the edges it shares with the next river or bridge hexes; a lake joins the lake hexes next to it)
- [x] **Decided:** a river or a lake is impassable (as official) and doesn't block line of sight; a bridge plays exactly like plains (moving, firing, cover)
- [x] Pegasus Bridge, the official base-game scenario 1 (Allies 6 cards, Axis 2; Allies attack). The sandbags by the bridge are only on the table, and medals stay on the table (**Decided:** the app doesn't count them)
- [x] Barbed wire (`Scenario.wire`, drawn on the board over the hex art since it can be removed): any unit that enters it stops. **Decided:** in the battle, infantry on wire is asked whether to remove it (instead of firing) or fire with a die less; armour and artillery fire as usual. Wire the opponent removes is taken off in "Actualizar mapa"
- [x] The Axis' surprise in Pegasus Bridge (`Scenario.extraDraws`): 2 cards to start, and 2 drawn instead of 1 after each of its first two turns, so 4 in hand from then on
- [x] Sandbags on this side's units (`Scenario.sandbags`, `Hex.sandbags`): Pegasus Bridge's two German units by the canal bridge start with them (shown in the Axis app). They go when the unit moves off (Órdenes warns first) or retreats or is destroyed; Fortificar puts them on one infantry or artillery in «Actualizar mapa». **Decided:** the enemy's sandbags aren't tracked (whether its unit moved, lost them or got new ones can't be known), so the fire dialog still asks; a crew left by the `artilleryCrew` rule keeps them
- [x] Forêt d'Écouves is the official scenario 7045 by jdrommel (Days of Wonder archives, 12 August 1944): its units, sandbags and hands (Allies 6, Axis 5, Allies first) from the archive's `.m44` data; the terrain already matched. Its special rule, elite units (`Scenario.elite`, `Unit.elite`, a star badge on the token): every French infantry unit and the German units with a badge move their whole move and still fire (elite infantry moves 2 and fires); the elite tank plays as any tank (its 4th figure is only on the table). Écouché, the Allies' temporary medal objective, stays on the table
- [x] ~~**Decide:** the Pegasus Bridge reinforcement table is a proposal (grenade and star → infantry, flag → none), like Sainte-Mère-Église~~ No tables any more: Reinforcements always brings infantry (Step 60)
- [x] **Decide:** the Sainte-Mère-Église reinforcement table is a proposal (grenade and star → infantry, flag → none), like the other two

## Part F: The deck

### Step 43: Deck visualizer
- [x] A view of the command deck: every card, how many copies, and how likely each kind is to be drawn (the probability notes in house-rules.md)

### Step 44: A smaller deck
- [x] Fewer cards, so each card turns up more often and the game is less random: each side gets its own 25-card deck (`commandDeckFor`), 21 shared cards plus 4 that depend on the unit types it has in the scenario
- [x] **Decided:** shared: Assault and Attack 1 per section, Probe 2 per section, Recon in Force 1, General Advance 2, Pincer 1, Preparations 1, Finest Hour 1, Infantry Assault 1, Close Assault 1, Firefight 1. Only infantry: Move Out 4; infantry and armour: Move Out 1, Armor Assault 1, Direct from HQ 2; infantry and artillery: Move Out 1, Artillery Bombardment 1, Direct from HQ 2; all three: 1 of each. No Recon: Probe now draws 2 cards in the final phase and keeps 1, instead of the gamble

### Step 44b: Combat decks by scenario
- [x] 1 copy of each card, the deck built per side from the scenario (`combatDeckFor`). Both sides: Tras las líneas enemigas, Emboscada, Médico, Sin munición, Refuerzos, Lucha callejera, Táctico, Blindaje personal, Explosivos, ¡Fusiles arriba!. Defender: Fortificar, Ni un paso atrás, Camuflaje, Repliegue. Attacker: Motorizado (was Terreno helado), Fragor del combate and 2 Sin tregua (Forest and House to House in one: any unit enters a forest, town or hedgerow and can still fire). With armour: Mecánico, Blindados adelante; artillery: Observador, Reposicionamiento; enemy armour: Sin combustible, Escasez de proyectiles; more than 8 town hexes on the map: Rattenkrieg (none of the current maps)
- [x] Cortina de Fuego only for the sides with big guns (`Scenario.bigGuns`, both when omitted); Poder aéreo and Bombardeo aéreo by `Scenario.airPower` (1 each when omitted, 0 against air superiority, more with more air sorties)
- [x] Vuelta al servicio is out of the deck (Médico stays)
- [x] Test mode ("Modo prueba" in the menu, not remembered): one of every combat card in hand, no hand limit, played cards come back to the hand, at least 99 suministros each turn; a "Modo prueba" chip in the header
- [x] The menu shows the chosen scenario's details per side: role, command cards to start, units, big guns and air (not the combat deck)
- [ ] **Decide:** big guns and air per scenario are historical guesses: Écouves and Arracourt Allies only (guns and air), Sainte-Mère-Église big guns Axis only and air for both. **Decided:** Pegasus Bridge has neither for either side
- [ ] Read `.m44` files to set air superiority and air sorties from the scenario (Step 45)

### Step 45: Scenario tools
- [ ] A map editor in the app: paint terrain and place units on the board, save as a scenario. Planned in Part I (Steps 49–57)
- [ ] Import a scenario from a PDF or a map image. Sainte-Mère-Église was read by hand from the map image with a hex grid laid over it; **Decide:** how much of that to automate, and whether a scenario file format (e.g. the official editor's `.m44` JSON, `docs/Empty.m44`) is worth reading. Once the editor exists, an import opens the map there to check and fix before saving

## Part H: Languages

### Step 46: English and Spanish
- [x] A per-device language setting (`Settings.language`), a Español/English picker at the top of "Ajustes", starting from the browser's language; `<html lang>` and the page title follow it
- [x] `src/i18n/` (`Localized`, `byLang`, `same`, `defineMessages`, `useMessages`, `useLabels`, `useTr`) and `src/labels/` (one label set per language, replacing `src/labels.ts`)
- [x] Game text stored in both languages: command and combat cards (official English names), scenario descriptions, fire questions, dice steps, shot notes, card reminders, looks. `SAVE_VERSION` 26 → 27
- [x] Every component's text in a `TEXT = defineMessages({ es, en })` block; Spanish left exactly as it was
- [x] English tests: labels, settings, App (switch to English and play), and one per component group
- [x] CLAUDE.md and README describe the two languages
- [x] Reviewed the English: names are consistent ("Update map", "Cancel shot", "Hold and fire"); a few lines reworded (the attack die, "Mirror the casualties…", "See Infantry's roll", "You're 1 supply short")
- [x] `DiceStep.card` carries a card step's name, so `ShotSteps` no longer trims "Carta " / " card" off the label
- [x] `DeckVisualizerDialog` groups copies by `templateId` (command and combat cards), not by Spanish name
- [x] Checked in the browser, English and Spanish, at 1280×800 and 800×1280 with touch and 1920×1080 without: a whole turn, the deck, nothing clipped or scrolling sideways. Fixed: titles with one long word ("Preparations", "Reinforcements", "Tras las líneas enemigas") broke mid-word on the card faces; they now get the smaller size
- [x] Switching language mid-game changes the rolled shots, steps and cards
- [x] **Decided:** keep the English house names (Recon in Force, Preparations, Not One Step Back, Shell Shortage, Reposition, Personal Armor, No Respite)
- [x] **Decided:** the installed app is called "Memoir '44 Sim" (manifest and `index.html`); the description stays Spanish
- [x] Deployed with `SAVE_VERSION` 27; the later fixes add only optional fields, so saves keep working

### Step 47: Small battle rules
- [x] "Bloqueado por el rival" / "Blocked by the enemy" in the Fire dialog: the opponent's card (Out of Ammo, Shell Shortage, Out of Fuel) stops the unit: no roll, no more shots this turn (`GameSession.blockShot`, `Shot.blocked`); "Anular disparo" takes it back
- [x] Spotter and Reposition can only be played with an ordered artillery unit (`CombatCard.needsOrdered`, `GameSession.hasOrderedUnitFor`)

### Step 48: Rule book
- [x] "Reglamento" in the menu and in the game's "Menú" (`RuleBookDialog`, text in `data/ruleBook.ts`): a tutorial (before you start, the simultaneous turn, a page per phase, tips) and the house rules beside the official ones, grouped: simultaneous turns, dice, terrain, command cards, supplies and combat cards, optional rules
- [x] Compared with the official rules (Days of Wonder's 2004 rulebook and the base game's cards)
- [x] Official rules the app didn't apply, found while comparing:
  - [x] **Decided:** armour on a town hex fires with 2 fewer dice, at any range (`FROM_TOWN_FIRE_DICE`, a "Desde un pueblo" step), as official
  - [x] **Decided:** armour that enters barbed wire removes it, as official (`WIRE_CLEARING_UNIT_TYPES`, `Order.clearedWire`), when it moves there and when it takes ground there; undoing the order or the taking ground puts the wire back, and Movimiento reminds the player to take it off the table
- [x] **Decided:** the air rules (planes on the map) won't be built; taken out of house-rules.md. The air combat cards stay
- [x] Also: the Preparations card has its painting (`npm run card-art` takes a JPEG too)
- [x] **Decided:** infantry with one figure firing at most 2 dice is dropped (taken out of house-rules.md). The rule in play is limited damage: all the dice are rolled, and the unit applies as many results as it has figures left
- [x] Combat cards can have a painting in place of their piece of board (`COMBAT_PAINTINGS` in `CardArt.tsx`); everything else on the card stays. Rattenkrieg, Sin tregua, Blindados adelante, Médico, Mecánico, Tras las líneas enemigas, Motorizado, Refuerzos, Fragor del combate, Bombardeo aéreo, Cortina de Fuego and Poder aéreo so far; the cards without a painting keep their board. `npm run card-art` reads the checkerboard's darker grey off the image's border, as some originals draw it darker or unevenly (or lighter, about 242: an enclosed patch counts it as the darker tone), and clears the light grey JPEG noise on the image's outer 2 pixels; an original on a white background (its border all white) has the white faded out instead, from the edges and from larger enclosed patches
- [ ] **Later:** the changed units (mobile artillery, Tigers, jeeps, half-tracks) go in the rule book when a scenario has them

## Part I: Map editor

A button in the menu opens a map editor: make a map in the app (terrain, units and the scenario's settings), play it at once from "Mis mapas" on both tablets, and add the good ones to the built-in catalog so every device gets them. Claude Code makes maps of real battles, history first (Step 56), and a QR code sends a map last of all (Step 57).

How it fits in today's code:
- A scenario is already plain data (`Scenario`: `tiles`, `units`, `wire`, `sandbags`, `elite`, hands, attacker, reinforcements, air, big guns), and the decks are built from it (`commandDeckFor`, `combatDeckFor`), so a new map plays without any change to `GameSession`.
- The terrain is seen only in the board art: the hex layer is transparent (`Hexagon`), and `HexThumbnail` and the menu thumbnail cut from the same image. That art is made offline by `npm run board` with sharp, which can't run in the browser. So a map made in the app gets its art drawn in the browser (Step 50), and a map added to the catalog gets the painted art like the official ones (Step 55).
- Each tablet is independent, so a map made on one has to be sent to the other (Step 54).
- Medals and objectives stay on the table (Step 42), so the editor doesn't place them; the description says what they are.

Decided:
- **Decided:** "Editor de mapas" is a button in the menu. A map made there goes into "Mis mapas" on that device, playable and shareable straight away. Into the built-in catalog (in the repo, deployed to every device) only by exporting it and running a script (Step 55).
- **Decided:** a field per language for the name and the description.
- **Decided** (changed: first each hill was to stand on its own): hills next to each other are joined into ridges in the app too, as on the painted boards.
- **Decided:** a map is never edited or deleted during a game. The editor, Borrar and Importar are only in the start menu, which shows only when no game is in progress ("Salir al menú" ends the game and forgets its save).
- **Decided:** a map is sent as a link (Web Share) or a file (Step 54), and by QR code as the very last step (Step 57).

### Step 49: A scenario file
- [x] `ScenarioFile` (`game-core/scenarioFile.ts`): a `Scenario` as plain JSON (no `image`), with a `version`, `board: "standard"` (13×9; room for other sizes later) and `notes` (`Scenario.notes`: sources and rulings, which the built-ins keep in comments). `toScenarioFile` writes one
- [x] `Scenario.name` is `Localized`, like the description (the built-ins use `same()`), shown with `tr()`. A map needs a name in at least one language; an empty text shows the other language's (`textIn`, which `useTr` uses)
- [x] A JSON Schema for the file, `game-core/scenarioFile.schema.json`, kept in step by a test (with `ajv`, a dev dependency): its fields, terrains, unit types, sides and die faces are the app's, the built-ins pass it, and it refuses what `parseScenario` refuses. It documents the format that Claude Code writes maps in (Step 56); a file can point an editor at it with `$schema`
- [x] `validateScenario` lists what's wrong as `ScenarioProblem`s, a `Localized` message and the hexes it's about: a bad id, no name, a hand under 1 card, a position off the board (odd rows have one hex less), a hex with two terrains, two units on one hex, a unit or wire on a river or lake (`MovementRule.BLOCK`), sandbags or a badge where no unit starts, a side with no units (unless it drops them by parachute), no full Reinforcements table, and the paradrop's, extra draws' and air sorties' numbers. `parseScenario` reads unknown JSON into a `Scenario`, or throws a `ScenarioFileError` listing every field of the wrong shape (unknown fields too), then the rules
- [x] `scenarios.test.ts` checks every scenario with `validateScenario` (its own checks moved there), so the built-ins and the editor's maps pass the same checks, and each built-in round-trips through a file
- [x] The catalog also reads `src/data/catalog/<id>.json` (named after its id) and its art, `src/assets/scenarios/<id>.webp`, with `import.meta.glob` (`data/catalog.ts`). A broken file fails the tests, so it can't deploy. The four built-ins stay in `scenarios.ts`

### Step 50: Board art in the browser
- [x] The drawn terrain moved to `src/boardArt/terrainTiles.mjs`, and which art each hex gets (tile, turn, river and lake edges, ridges, the bridge piece, `pickFor`) is planned once, in `src/boardArt/boardPlan.mjs` (JavaScript typed with JSDoc, so the Node scripts import it). `compose-board.mjs` uses it, and the four boards it rebuilt came out byte for byte as before
- [x] The tile library and the bridge piece are imported straight from `scripts/board-art/` (no copies to keep in step); `npm run board` also writes the empty board for the app, cropped to its grid, at 1621×1008 (`APP_ART_HEIGHT`, where the library's 129 px tiles are at their size: 290 KB). Vite emits them, and the service worker precaches them, once the editor imports `drawBoard.ts`
- [x] `boardArt/drawBoard.ts`: `drawBoardArt(tiles)` draws a map on a canvas in the painted art's box: the empty board, each hex's tile, hills next to each other joined into ridges, rivers painted when a river tile fits every bend (`canPaintRivers`) and drawn otherwise, lakes drawn, the bridge piece with its shadow, the frame put back round the grid. It returns a blob URL (JPEG) for `Scenario.image`, so `Board`, `HexThumbnail`, `ScenarioPreview` and the menu thumbnail work unchanged. A river that forks (a map half made) keeps two of its branches instead of failing
- [x] Instead of redrawing only the hexes that changed: each hex's image is made once and kept (a drawn hex as a bitmap at the board's size), so redrawing the whole board after a tap only pastes images, and is always right
- [x] Ridges in the browser too (the player changed the decision): the ridge's pixel work moved from `scripts/joined-hills.mjs` to `src/boardArt/joinedHills.mjs`, which the script reads and writes with sharp and the app with a canvas. The app builds a ridge at the board's size (the script at twice, so it blurs less). The nearest point of the plateau's outline is found from the points sorted by x, only within reach of the outline (further away a pixel is the plateau's or the grass's texture alone), giving exactly the same pixels: the four painted boards rebuilt byte for byte, and `npm run board` takes 12 s instead of 23
- [ ] Measure on the Android tablet. In desktop Chromium: a built-in map's first draw takes 26–61 ms and a redraw about 25 ms; with the processor slowed 4 times, 90–210 ms and 80 ms, and 810 ms for the first draw of a map with a long winding drawn river. With ridges, Arracourt's first draw takes 247 ms (832 ms slowed 4 times; each new ridge hex is about 26 ms), its redraws 22 ms. Check on the tablet with the editor (Step 51)
- [x] Tests: the plan for every built-in board covers exactly its terrain hexes, the tile picks are pinned (changing them would repaint every board), ridges, bridges, lakes, river ends, forks and bends; the app paints the built-ins' terrain on the same hexes. Checked by eye in Chromium: the four built-ins drawn in the browser match their painted art hex for hex (same tiles, same turns), with no seams

### Step 51: The editor screen
- [x] "Editor de mapas" in the menu, beside "Reglamento" and "Ajustes" (only there, so never during a game). "Nuevo mapa" in the editor starts an empty map or a copy of a scenario (`copyDraft`), warning when the map being made would be lost. Lazy-loaded (`LazyMapEditor`, its own 34 KB chunk)
- [x] The editing in `game-core/scenarioDraft.ts` (no React, tested): `paintTerrain`, `placeUnit`, `removeUnit`, `toggleElite`, `toggleSandbags`, `setWire`/`toggleWire`, `clearHex`, `terrainAt`, `unitAt`, `draftCounts`. Each returns a new map, the same one when nothing changes, or `false` when it isn't allowed (a unit or wire on water, a badge or sandbags with no unit); painting water takes the unit and wire there off, and swapping a unit drops its badge and sandbags. Undo and redo walk the list of maps (`recordStep`, `undoStep`, `redoStep`, up to 200 steps)
- [x] Laid out like the board screens (`PhaseLayout.css`): the map at full width, seen from the Allies' side with both sides' units in their colours (`BoardManager`'s `bothSides`, `Board`'s `unitFactionAt`), the board art drawn in the browser (Step 50), and the side column (216 px in landscape, under the map in portrait) with the tools: Terreno (each terrain's hex as it's drawn on the board, `terrainSwatch`), Unidades (both sides' infantry, tanks and artillery), Marcas (De élite, Sacos terreros, Alambrada, Borrar), the tool's name, Deshacer / Rehacer, and the instructions behind "Instrucciones"
- [x] One tap applies the tool; on a hex that already has what the tool puts, it takes it off. A stroke of the finger (`strokeOf`) decides that on its first hex and carries on over the hexes it slides across for terrain, wire and Borrar, and is undone in one go. A tap that can't be done flashes the hex and says why
- [x] Under the tools: each side's units by type, and the town hexes (with a note above 8: Rattenkrieg is dealt)
- [x] The map is kept in localStorage as it's edited (`storage.ts`: `saveMapDraft`, `loadMapDraft`, read with `parseScenario`'s `rules: false`, which checks only the shape), so a reload or the tablet dropping the tab doesn't lose it
- [x] Checked in Chromium at 1280×800 and 800×1280 with touch (Spanish) and 1920×1080 with a mouse (English): painting, a stroke, units of both sides, badges, sandbags, wire, a refused unit on a lake, undo, a reload, a copy of Pegasus Bridge; nothing scrolls sideways

### Step 52: The scenario's settings
- [x] "Datos del escenario", a dialog from the editor's side column (`ScenarioSettingsDialog`): name and description (each in Español and English), each side's role (Ataca / Defiende), command cards to start, air sorties (`airPower`) and heavy guns (`bigGuns`) side by side, the Reinforcements table (a unit or none per die face, each face drawn as on the die; a new map starts from the one most built-ins share), and the special rules: extra draws (`extraDraws`: side and first turns, starting with the defender for 2) and paradrop (`paradrop`: side, unit and number, starting with 4 of the attacker's infantry). The edits are pure functions in `scenarioDraft.ts` (`setText`, `setAttacker`, `setHandSize`, `setReinforcement`, `setAirSorties`, `setBigGuns`, `setExtraDraws`, `setParadrop`, within `SETTING_LIMITS`), and air sorties and heavy guns stay out of the file while both sides have the usual ones
- [x] Each setting explained behind an "i", as in `ScenarioDetails`
- [x] Changes apply as they're made and go into the editor's undo: typing in one box, or tapping one counter several times, is one step
- [x] What's still wrong (`validateScenario`), as a list under "Datos del escenario" in the side column and at the foot of the dialog (`ScenarioProblems`), or "Se puede jugar"; tapping a line about some hexes flashes them on the map a few times (`useHexFlash`'s `flashHexes`; from the dialog, once it has closed). A draft saves at any time; playing it only when the list is empty comes with Mis mapas (Step 53)
- [x] The two sides as the menu shows them (`ScenarioDetails` with no side to pick: role, starting cards, the combat decks built from the map), under "Así lo verá el menú"
- [x] Also: `DieFaceIcon` moved out of `DiceResult`, so the editor shows the die faces without loading the 3D dice
- [x] Checked in Chromium at 1280×800 and 800×1280 with touch (Spanish) and 1920×1080 with a mouse (English): the settings, undo, the problem lines flashing their hexes; nothing scrolls sideways

### Step 53: Mis mapas
- [x] `storage.ts` keeps the device's maps (`m44-sim:custom-maps`, a list of scenario files, a few KB each), failing quietly like the rest: `loadCustomMaps` (only the shape is checked, so a half-made map is kept; one that can't be read is left out), `saveCustomMap`, `deleteCustomMap`. The editor's one map from Step 51 (`m44-sim:map-draft`) becomes the first of them
- [x] Chosen while building it, to confirm with the player (the plan didn't say): the editor keeps its map in Mis mapas as it's edited, with no save step, once it isn't blank (a terrain, a unit, wire, a name or a description). Leaving the editor or starting another map never loses anything; undo works while the editor is open
- [x] A map's id is a slug of its name and a short random part (`bocage-3f9k`; `slugOf`, `mapIdFor` in `scenarioDraft.ts`, the English name first, as the catalog's ids are). A new map is `map-` and the random part until it leaves the editor with a name (`settleMapIds`, when the menu reads Mis mapas), so the id isn't made from a name half typed; from then on it stays the same, even when the map is renamed. Duplicar gives the copy its id straight away
- [x] Menu: the built-in scenarios, then "Mis mapas" (each with its thumbnail drawn, "Sin terminar" under one that can't be played yet) and "Nuevo mapa". A map opens the same panel (preview, `ScenarioDetails`, pick a side, play) with Editar, Duplicar and Borrar (Borrar asks for confirmation); while `validateScenario` finds something wrong, the list is shown and "Empezar" is off. Back from the editor, the menu shows the map just edited. Compartir comes with Step 54
- [x] A map from Mis mapas has its board art drawn in the browser (`boardArt/mapArt.ts`: once per terrain, shared by the menu's thumbnail, its preview and the game; `drawBoard.ts` is fetched only then). A game on one starts, or is picked back up after a reload, once its art is drawn (a spinner meanwhile; after 15 s without it, it goes on without the art rather than wait for ever)
- [x] `App` passes the built-ins and the device's maps to `Menu` and to `loadSavedGame`
- [x] No editing during a game: Editar, Duplicar and Borrar are in the start menu only, never in the game's "Menú", and `App` opens the editor only from the menu. So a saved game finds its map by id in Mis mapas, unchanged; if the map is gone (the browser's data cleared), the save is dropped, as today. Importar comes with Step 54
- [x] Tests: a game on a map made with `scenarioDraft` plays a turn, saves and restores (`storage.test.ts`); in `App`, a map from Mis mapas is played and picked back up after a reload, a half-made one can't be started, Editar, Duplicar and Borrar (only once confirmed), and with a game in progress nothing reaches the editor or Borrar
- [x] Checked in Chromium at 1280×800 (a map made in the editor, played as the Axis with its drawn art, and picked back up after a reload) and 800×1280 with touch (Duplicar, Borrar, Editar and back); nothing scrolls sideways

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
- [ ] **Decided:** the historical background comes first: a real battle keeps its historical forces, ground and situation, even when one side is weaker. How fair a map is comes later
- [ ] A project skill, `.claude/skills/new-scenario/`, so every session makes them the same way: the sources (the official scenario if there is one, orders of battle, maps of the ground), the ground laid on the 13×9 board and its sections, the units, elite units, wire and sandbags, hands and attacker, air and big guns (the rules the built-ins follow), the Reinforcements table, the texts in both languages, and every source and guess in `notes`
- [ ] `Scenario.history` (optional, `Localized`): the historical background (the date, the units, what happened and how it ended), a few paragraphs in the menu's scenario panel under the description. The built-ins get theirs, and "Datos del escenario" a field per language
- [ ] A made-up map says so in its description, and is still set in a real theatre and year
- [ ] Checked with `parseScenario` before the player sees it (`npm run add-scenario -- --check <file>`)
- [ ] **Later:** fairness, analysed with the player first: a score comparing the two sides (units by type, elite units, cover, starting cards, the attacker's extra turn, the combat decks, how far apart the armies start), shown in the editor. Then fair made-up maps, and perhaps the model in the app

### Step 57: Sharing with a QR code (the last step)
- [ ] "Compartir" also shows the link as a QR code, for two tablets side by side: the other tablet's camera reads it and opens the link (Step 54)
- [ ] A small QR library with a licence that allows it, credited in the README, loaded only when the code is shown
- [ ] The link short enough for a code a camera reads at a glance from a screen: measure it on the busiest built-in map, and write positions more compactly if it's too long
- [ ] Check on the iPad: its camera opens links in Safari, not in the app on the home screen (Step 54). If the map lands in Safari, add "Escanear" to Mis mapas (the camera and a QR reader in the app)

## Part J: Card rebalance

The player's rebalance (October 2026). Armour is too easy to play, and no card is played as a reaction in the battle any more: every combat card is played with the command card, in the Command Zone, and a card that acts on one unit is given to that unit while ordering. The changes apply to both ways of playing:
- **Own tablets** (each side on its own device): what a card does to the enemy's rolls (retreats or hits ignored) is resolved at the table. The app shows the card on the unit and reminds the player.
- **Pass and play**: the app applies everything (`passAndPlay.ts`, figures).

The steps go from data-only changes to new mechanics, each its own commit. Each step also updates the rule book (`data/ruleBook.ts`), `docs/house-rules.md` and CLAUDE.md wherever they describe what it changes. A step that changes the save's shape bumps `SAVE_VERSION` (and `MATCH_SAVE_VERSION`), which drops a game in progress on the tablets: finish games before pushing those steps, or push the part in one go.

The player answered every **Decide** before Step 59 was built; each is marked **Decided** below.

### Step 58: Command deck and costs (data)
- [x] Probe (Batida): 1 per section instead of 2, and no more "draw 2, keep 1" (`drawChoice` 1). It still orders 2 units in its section and 1 on the move
- [x] Preparations (Preparativos) takes Probe's old draw: in the final phase, draw 2 and keep 1 (`drawChoice: 2`), on top of its 3 supplies and combat card. `EndOfTurnView` handles a card with both a `drawChoice` and an `endOfTurnReward` (tested)
- [x] One more Move Out (En marcha) and one more General Advance (Avance General) in every deck: General Advance 3, and Move Out +1 in each `unitTemplates` set (2 in the mixed sets, 5 with infantry only). Each deck has 19 shared cards + 5 by unit type = 24 (it was 25): update "25" in `commandCards.ts`, CLAUDE.md and the deck tests. The deck visualizer's chances follow on their own
- [x] Motorized (Motorizado): infantry only (`unitTypes: [INFANTRY]` on its move effect), costs 2 instead of 3. It stays an attacker's card
- [x] An extra order costs by unit type: infantry 3, armour and artillery 4. `EXTRA_ORDER_COST` becomes a `Record<UnitType, number>` (`slotCost`, `canBuyExtraOrder` with the unit's cost, `coins.ts`'s ledger, OrdersView's texts, the rule book)
- [x] Pass and play: infantry units have 6 figures instead of 7 (`FIGURES`). Medic, limited damage and the artillery crew already read it from there. A saved match with an infantry unit on 6 hits would load it destroyed but still on the board, so bump `MATCH_SAVE_VERSION`

### Step 59: Refuel, the only way to get Armor Assault
- [x] A new tactic command card, Repostaje / Refuel (house name): order 1 unit. In the final phase, 3 supplies and a combat card (as Preparations), and instead of a command card drawn from the deck, the side gets Armor Assault
- [x] Armor Assault leaves the deck, and Refuel takes its place in the decks of sides with armour (tanks and artillery: Move Out 2, Refuel 1, Artillery Bombardment 1, Direct from HQ 1; tanks: Move Out 2, Refuel 1, Direct from HQ 2)
- [x] `GameSession` keeps Armor Assault outside the piles (one copy, saved). Once played, it goes back there and never into the discard pile, so a reshuffle never brings it into the deck. The command card says what its final phase gives (`CommandCard.rewardCard`), and that replaces `deck.draw`. Which cards are out of the deck isn't saved: it's every `reserve` card not in the hand, being played or drawn. No "Descartar y robar otra" for it
- [x] **Decided:** "if there are no tanks in your army, get another Direct from HQ": a Refuel played when the side has no armour left on the board gives a Direct from HQ instead of Armor Assault. It also comes from outside the deck and goes back out once played, so the deck keeps its size
- [x] **Decided:** a second Refuel while Armor Assault is still in the hand (possible after a reshuffle): the side draws from the deck as usual
- [x] Final phase: Armor Assault flies into the hand from the step with Refuel's reward, marked "Nueva" ("Repostaje te da Asalto de Blindados"). The deck visualizer shows it apart ("Solo con Repostaje"), with no chance of drawing it. Refuel's card face is its summary under the generals' painting until it has its own (`TACTIC_PAINTINGS`, now looked up by template)
- [x] The same per side in pass and play. Bump `SAVE_VERSION` and `MATCH_SAVE_VERSION`

### Step 60: Reinforcements without a roll
- [x] Reinforcements: in the final phase an infantry unit arrives on the cross, with no die. **Decided:** a whole infantry unit (in pass and play it arrives with its 6 figures); the cost stays at 6
- [x] The roll goes: `rollReinforcements`, `ReinforcementRoll`, `reinforcementFace`, `reinforcementDue`, the "Tirar dado de refuerzos" button and its result in `EndOfTurnView`, the line in `HistoryDialog`, the table in Órdenes (`describeReinforcements`), and the die in the card's pictograms (cross → infantry). The unit arrives on the cross as the final phase starts (`endBattle`); `placeReinforcement` stays, for a cross that's been taken. The card's effect names the unit (`{ kind: "reinforcements", unitType }`)
- [x] The scenario's table goes: `Scenario.reinforcements`, its check in `validateScenario`, `DEFAULT_REINFORCEMENTS` and `setReinforcement`, its section in "Datos del escenario", the tables in the four built-ins, and the open **Decide** in Step 42. Files that still have the field (Mis mapas on the tablets, exported maps) must keep loading: `parseScenario` accepts the field and drops it (today it refuses unknown fields, so a map would be lost), and the schema marks it as no longer used
- [x] Bump `SAVE_VERSION` and `MATCH_SAVE_VERSION`

### Step 61: The reaction cards go
- [x] Out of Ammo (Sin munición), Ambush (Emboscada), Pull Back (Repliegue), Out of Fuel (Sin combustible) and Shell Shortage (Escasez de proyectiles) leave `combatCards.ts`
- [x] Their code goes:
  - Ambush: `AmbushDialog`, `ambushAt`, `ambushTargets`, `ambushUnits`, `undoAmbush`, `keepAmbushResults`, `AmbushShot`, the `ambush` effect, its line in the coins ledger, the save and the turn log, and pass and play's `ambush` and `pending.ambush`
  - The blocking cards: pass and play's `BLOCKING_CARDS`, `cardInPlay`, `blockable`, `block`, `relocate` and `MatchBattle.relocate`; `GameSession.blockShot`, `blockUnit` and `baselineHexes` (`moveUnitTo` stays for Reposition in pass and play, Step 64); `Shot.blocked` and "Bloqueado por el rival" in the Fire dialog
  - Their glyphs in `CardArt`
- [x] The `enemyTanks` deck reason goes, since only Out of Fuel and Shell Shortage had it: `DeckReason`, the labels, its icon and `REASON_ORDER`
- [x] The combat deck sizes in `ScenarioDetails` follow on their own; the rule book's and house rules' card lists don't. Bump `SAVE_VERSION` and `MATCH_SAVE_VERSION`

### Step 62: Combat cards are played with the orders
- [x] **Decided:** combat cards aren't told apart any more: up to two per turn, any two different cards (not two copies of one card), both played with the command card. Two cards that mark hexes each mark their own; two that change movement each go on their own units. The "Con las órdenes" label at the foot of a combat card goes
- [x] No more combat cards in the battle: `CombatPhase` goes (every card is played with the orders), and `playBattleCombatCard`, `undoBattleCombatCard`, `battleCombatCard` and `orderCombatCard` become the list of cards played (`pickCard` takes them). Also gone: the cards in `BattleReserve` (the coins stay), the shared battle's battle cards, `handOrder`'s battle group, CardsView's "se juega en la batalla", and `CombatCardComponent`'s fire icon and accent. `unpickCard` gives back every combat card played with the command card
- [x] Cards given to a unit while ordering: `CombatCard.assign` (how many units, which types, ordered or any). An ordered unit takes the card with the "Usar …" toggle that the move cards already have (`Order.boosted` generalised to name the card it uses, so two cards can each be on a unit). A unit without an order (Personal Armor) is tapped on the orders map, like a marker. The orders can't be confirmed until the card is on its unit, as with markers
- [x] The unit carries the card as a badge on every map (Órdenes, Movimiento, `BattleMap`, pass and play's reveal and shared battle; left of the token, as its corners hold the other badges) and the card's name in its `FireOrderList` row. The badge isn't tappable (a tap on the map is for the unit): the played cards beside each map (`PlayedCards`, `BattleReserve`) open the card and say which unit has it
- [x] The first cards on it, the dice cards (`DiceBonusEffect` says whether it's for the card's unit or for every unit of its types, and it's no longer used up by the first shot):
  - Street Fight becomes **Street Equipment** (Equipo urbano): given to 1 ordered infantry unit, +1 die when it fires from a town hex or a hex next to one. The app checks the hex, so the Fire dialog stops asking. **Decided:** checked on the hex it fires from
  - Street Equipment's painting is ready: `npm run card-art -- images/street-equipment.png` makes `src/assets/cards/street-equipment.webp`, which goes into `COMBAT_PAINTINGS` in `CardArt.tsx` under the new id (`street-equipment`). And Camouflage is ready too.
  - Explosives (Explosivos): given to 1 ordered infantry unit, +1 die on each of its close assaults this turn
  - Spotter (Observador): every ordered artillery unit fires with +1 die this turn, on each shot (Artillery Bombardment's two included). The cost stays at 1. Confirming the orders warns when no artillery has an order (`needsOrdered`, checked then instead of in the battle)
- [x] The other former battle cards are played with the orders from this step on, and keep their table reminder until Steps 63–64 rework them
- [x] The turn log and History say which unit had which card. Test mode still has one of every card in hand. Bump `SAVE_VERSION` and `MATCH_SAVE_VERSION`

### Step 63: Rifles Up! and Heat of Battle
- [x] Rifles Up! (¡Fusiles arriba!) costs 2: this turn, the side's infantry that moved fires with the units that didn't move (in `summarizeOrders`, and pass and play's groups in `battleTurn`). Its dice don't change: only when it fires does. The `firesFirst` effect kind goes; Behind Enemy Lines' `MoveEffect.firesFirst` stays
- [x] Heat of Battle (Fragor del combate): this turn, each close assault by the side's infantry rolls one more die, which is always a flag. It's a face added to the roll, not thrown: `DiceResult` shows that die already showing its flag, and `ShotSteps` shows the card's step. For limited damage it counts as a card's extra die (one more result kept). Cost 1, an attacker's card, as now
- [x] Infantry never overruns any more: the `takeGround` effect kind and the card branch of `canOverrun` go; armour still overruns. The rule book's taking ground and the battle's "Instrucciones" follow
- [x] **Decided:** pass and play's infantry push-back (`PUSH_BACK_UNIT_TYPES`: it moves into the hex its close assault made the enemy leave, but doesn't fire again) stays
- [x] **Decided:** Heat of Battle's flag goes on a collision roll by infantry too, since a collision counts as the unit's shot

### Step 64: The defensive cards
- [x] Not One Step Back's painting is ready: `npm run card-art -- images/not-a-step-back.png`, into `COMBAT_PAINTINGS`
- [x] Not One Step Back (Ni un paso atrás) costs 2: this turn all the side's infantry ignores every flag (shots, attack cards, collisions). On own tablets: a reminder in the battle's "Instrucciones" and in the final phase, since the opponent's flags are resolved at the table. In pass and play, `sufferHits` drops the flags on that side's infantry. A collision's bounce back isn't a flag, so it stays
- [x] Personal Armor (Blindaje personal): given to 1 infantry unit, ordered or not, at the start of the turn. This turn it ignores the first 2 infantry-symbol hits in total; grenades still hit. On own tablets: the badge and a reminder. In pass and play, `sufferHits` is told which hits are infantry symbols and grenades, and the unit's hits ignored so far this turn are saved
- [x] Camouflage (Camuflaje): given to 1 ordered infantry unit at the start of the turn, and it gets the camouflage token after the battle. **Decided:** the official camouflage badge: the unit can only be fired at in close assault, and loses it when it moves or fires. On own tablets the enemy's camouflage can't be known, so the Fire dialog asks, as with sandbags
- [x] Fortify (Fortificar), played with the orders: in the battle, each of the side's ordered infantry units that could still fire may fortify instead, putting sandbags on its hex and not firing. It's a 0-dice shot, like removing wire (`Shot.fortified`), and "Anular disparo" takes it back. Infantry only now (it was infantry or artillery). The final-phase placement (`fortifyDue`, `fortifiable`, the reminder) goes. On own tablets, a reminder to put the sandbags on the table. **Decided:** the sandbags count straight away, against the enemy's later shots in the battle
- [x] Reposition (Reposicionamiento): given to 1 ordered artillery unit at the start of the turn (it used to be all ordered artillery). After the battle it moves up to 2 hexes: on own tablets with the reminder and "Actualizar mapa" as now; in pass and play, check how the final phase lets it move, since `MapPreview` replaces "Actualizar mapa" there. **Decided:** ordered artillery only
- [x] Bump `SAVE_VERSION` and `MATCH_SAVE_VERSION` if the shape changes (Personal Armor's hits, Fortify's shot)

### Step 65: Two new combat cards
- [x] **Decided** names: Fuego concentrado / Concentrated Fire, and Fuego de supresión / Suppressive Fire. Both cost 1, in every side's deck (`always`), each with its own glyph in `CardArt`
- [x] **Concentrated Fire:** this turn, units that didn't move and fire at the same enemy unit may roll together, one roll with all their dice
  - In the Fire dialog (and the shared battle's side column), after the target, "Sumar unidad" adds another ordered unit that didn't move, has a shot left and can fire at that hex. Each unit adds the dice it would roll there (its own distance, terrain and cards), the dice are rolled once, and each unit has used its shot (the lead shot lists the others, whose shots point to it). "Anular disparo" takes back the whole roll
  - The roll is read once against the target, so sandbags ignore 1 flag for the whole roll. In pass and play, limited damage adds up the units' limits, and the units fire in one go before the enemy answers
  - Each unit rolls its own die (the battle die adjacent, the long-range die further away when it's on), all in the same roll
  - **Decided:** any number of groups this turn
- [x] **Suppressive Fire:** this turn the side's dice have one infantry side changed to a flag. The battle die becomes 1 infantry, tank, grenade, supply, 2 flags; the long-range die becomes 2 infantry, 2 tanks, 2 flags, 2 supplies
  - New die kinds in `dice.ts` (`SIDES_OF`, `ShotTarget.die`), drawn in 3D and 2D: the faces already exist, only how many of each changes. `DicePool` and `DiceResult` show them
  - **Decided:** the player picks per shot, with a switch in the Fire dialog (and the shared battle's side column), for the side's ordered shots this turn; not collisions or attack cards

### Step 66: Check and tidy
**Skipped** (the player's call, 2026-10-16): the rest of Part J is built; these stay open for later.
- [ ] With "Modo prueba": a whole game on own tablets and a pass and play match using every changed card, at 1280×800 and 800×1280 with touch, in Spanish and English
- [ ] Read through the rule book, `docs/house-rules.md` (no "battle combat cards" lists left, the new deck counts) and CLAUDE.md (no Ambush, blocking cards or battle cards; the cards given to a unit). Tick off the note on reaction cards in `docs/myNextPlan.md`
- [ ] Card art: Refuel's painting (the player's image, through `npm run card-art`), and the pictograms of the reworked cards (Spotter on all artillery, Personal Armor's 2, Not One Step Back on all infantry). Street Equipment already has its painting from Step 62

## Part G: Carried over from the first plan (postponed)

- New unit types: mobile artillery, jeep, half-track (old Step 29)
- ~~Air rules (old Step 30)~~ **Decided:** not built. Air sorties per scenario only set the air combat cards (`Scenario.airPower`)
- Cards about the opponent's hand and orders: "Mostrar cartas al rival", "Perder cartas" (old Step 33)
- "Importar partida" from an exported JSON (old Step 34)
- Experiments: More figures per unit

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
- New UI text is in both languages, and the screens changed are checked in English as well as Spanish.
