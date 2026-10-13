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
- [ ] **Decide:** the Pegasus Bridge reinforcement table is a proposal (grenade and star → infantry, flag → none), like Sainte-Mère-Église
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
- **Decided:** a map made in the app is drawn with each hill on its own tile (no ridges: joining hills needs the sharp pipeline, `joined-hills.mjs`). The catalog's painted art has the ridges.
- **Decided:** a map is never edited or deleted during a game. The editor, Borrar and Importar are only in the start menu, which shows only when no game is in progress ("Salir al menú" ends the game and forgets its save).
- **Decided:** a map is sent as a link (Web Share) or a file (Step 54), and by QR code as the very last step (Step 57).

### Step 49: A scenario file
- [ ] `ScenarioFile`: a `Scenario` as plain JSON (no `image`), with a `version`, `board: "standard"` (13×9; room for other sizes later) and `notes` (sources and rulings, which the built-ins keep in comments)
- [ ] `Scenario.name` becomes `Localized`, like the description (the built-ins use `same()`), shown with `tr()`. A map needs a name in at least one language; an empty field shows the other language's text
- [ ] A JSON Schema for the file, kept in step with the type by a test. It documents the format that Claude Code writes maps in (Step 56)
- [ ] `game-core/scenarioFile.ts`: `validateScenario` lists what's wrong as `Localized` messages: a position off the board, a hex with two terrains, a unit on a river or lake (`MovementRule.BLOCK`), two units on one hex, wire on water, sandbags or a badge where no unit starts, a side with no units, a missing hand size or face in the Reinforcements table, a paradrop or extra draws for a side that doesn't exist. `parseScenario` reads unknown JSON into a `Scenario` or throws with those messages
- [ ] `scenarios.test.ts` checks every scenario with `validateScenario` (its checks move there), so the built-ins and the editor's maps pass the same checks
- [ ] The catalog also reads `src/data/scenarios/*.json`, and the art with the same id in `src/assets/scenarios/`, with `import.meta.glob`; the four built-ins stay in `scenarios.ts`

### Step 50: Board art in the browser
- [ ] Share the drawn terrain (`scripts/terrain-tiles.mjs`: rivers, bridges, lakes, hedgerows as SVG, no Node imports) between the script and the app: move it to `src/boardArt/`, and `compose-board.mjs` imports it from there. Same for the seeded tile pick and turn (`pickFor`), so a hex looks the same in both
- [ ] Ship the tile library (`scripts/board-art/tiles/`, 232 KB) and a smaller copy of the empty board (about 1200 px wide; the original is 1.4 MB) as app assets. They're WebP, so the service worker precaches them and drawing works offline
- [ ] `boardArt/drawBoard.ts`: draws a map on a canvas in the box `boardGeometry` lays the image in: the empty board, each hex's tile (each hill on its own), the drawn terrain, the frame put back round the grid. It returns an object URL used as `Scenario.image`, so `Board`, `HexThumbnail`, `ScenarioPreview` and the menu thumbnail work unchanged
- [ ] Redraw only the hex that changed and its neighbours (rivers and lakes join them), so painting in the editor keeps up with the taps
- [ ] Measure on the Android tablet: the whole map drawn when it's opened, kept in memory, should take well under a second. Keep it in IndexedDB only if it's slower
- [ ] Test: a built-in map drawn this way puts its terrain in the same hexes as its painted art

### Step 51: The editor screen
- [ ] "Editor de mapas" in the menu, beside "Ajustes" and "Reglamento": a new map (the empty board), or a copy of a built-in one to start from. Lazy-loaded (`LazyMapEditor`), like `GameView`
- [ ] The editing in `game-core/scenarioDraft.ts` (no React, tested): `paintTerrain`, `placeUnit`, `removeUnit`, `toggleElite`, `toggleSandbags`, `toggleWire`, `clearHex`. Each returns the new draft, or `false` when it isn't allowed (a unit on water, sandbags or a badge with no unit); painting water under a unit takes the unit off. They're pure functions with no side effects, so a React reducer can call them safely in StrictMode; undo and redo walk the list of drafts
- [ ] Laid out like the board screens (`PhaseLayout.css`): the map at full width, seen from the Allies' side, and the side column (216 px in landscape, under the map in portrait) with the tools: Terreno (plains to clear, forest, hill, town, hedgerow, river, bridge, lake, each showing its hex art), Unidades (Aliados or Eje, then infantry, tank or artillery, with the unit art), Élite, Sacos terreros, Alambrada, Borrar, and Deshacer / Rehacer
- [ ] One tap applies the tool chosen; tapping the same thing again takes it off. Dragging to paint terrain is only a shortcut, never needed
- [ ] Under the tools: each side's units by type, and the town hexes (Rattenkrieg is dealt above 8)
- [ ] The draft is kept in localStorage as it's edited, so a reload or the tablet dropping the tab doesn't lose it
- [ ] Checked at 1280×800 and 800×1280 with touch, and on desktop, in Spanish and English

### Step 52: The scenario's settings
- [ ] "Datos del escenario", a dialog from the editor: name and description (each in Español and English), attacker, command cards to start for each side, the Reinforcements table (a unit or none per die face; starting from the one the built-ins share), air sorties per side (`airPower`), big guns (`bigGuns`), and the optional rules: extra draws (`extraDraws`) and paradrop (`paradrop`)
- [ ] Each setting explained behind an "i", as in `ScenarioDetails`
- [ ] What's still wrong (`validateScenario`), as a list; tapping a line flashes its hex on the map. A draft saves at any time, but it can only be played when the list is empty
- [ ] The two sides as the menu shows them (`ScenarioDetails`: role, starting cards, the combat decks built from the map)

### Step 53: Mis mapas
- [ ] `storage.ts` keeps the device's maps (`m44-sim:custom-maps`, a few KB each), failing quietly like the rest
- [ ] A map's id is a slug of its name and a short random part (`bocage-3f9k`). It stays the same when the map is edited, sent or added to the catalog, so both tablets and the catalog know it's the same map
- [ ] Menu: the built-in scenarios, then "Mis mapas". A map opens the same panel (preview, `ScenarioDetails`, pick a side, play) with Editar, Duplicar, Compartir and Borrar (Borrar asks for confirmation)
- [ ] `App` passes the built-ins and the device's maps to `Menu` and to `loadSavedGame`
- [ ] No editing during a game: Editar, Duplicar, Borrar and Importar are in the start menu only, never in the game's "Menú", and `App` doesn't open the editor while a game is in progress. So a saved game finds its map by id in Mis mapas, unchanged; if the map is gone (the browser's data cleared), the save is dropped, as today
- [ ] Test: a game on a map made with `scenarioDraft` plays a turn, saves and restores; with a game in progress, the editor and Borrar can't be reached

### Step 54: Sending a map to the other tablet
- [ ] "Compartir": a link to the app with the map in the hash (`#map=…`: the JSON compressed with `CompressionStream` in base64url, uncompressed where the browser lacks it), sent with the Web Share API on the tablets or copied on desktop
- [ ] Opening the link asks "¿Añadir «…» a Mis mapas?" after `parseScenario` has checked it, then clears the hash. If a map with the same id and other content is already there, it asks before replacing it. A link opened during a game waits: it's asked about once the player is back in the menu
- [ ] "Exportar" downloads `<id>.m44map.json` (`downloadJson`), and "Importar" in Mis mapas reads one with the file picker. The iPad needs it: an app added to the home screen keeps its own storage, apart from Safari, so a link opened in Safari would land in Safari's maps (check on the iPad)
- [ ] Test the round trip (link and file give back the same scenario); a broken link or file shows a message and changes nothing

### Step 55: Adding a map to the catalog
- [ ] `npm run add-scenario -- <file>`: checks the exported file (`parseScenario`), writes `src/data/scenarios/<id>.json`, adds its board to `scripts/boards.json` (`compose-board.mjs` reads the terrain from the scenario file), and runs `npm run board -- <id>` for the painted art, with ridges
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
