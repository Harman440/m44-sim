# Squad leaders and Regroup

Every unit has one **squad leader** among its figures. Infantry and tanks can now **regroup**: a weakened unit takes figures from a friendly unit next to it. The source is the player's note in [myNextPlan.md](myNextPlan.md) ("New Rework: Officer") and the answers below.

Work through it one step at a time. Each step is one commit on `feat/regroup` that passes `npm run check`, and you tick items off (`[x]`) when they're done. Items marked **Decide** need the player's answer before they're built.

## Decided (2026-10-26)
- **Squad leader (not new, now shown):** infantry has 5 figures and 1 squad leader; tanks and artillery have their figures and a squad leader too. The leader is the last figure hit, so it's the figure that falls when the unit is destroyed, and that's what gives the enemy a medal. The app already works this way (a unit is destroyed, and scores, when its last figure falls); this plan makes it visible and writes it down.
- **Regroup:** an action for **infantry** (costs 2 energy) and **tanks** (costs 2 fuel). Not artillery. Only pass and play and against the computer; own tablets don't track figures, so it isn't offered there.
- **Who:** the unit given Regroup (the *receiver*, A) picks a friendly unit of the same type in an **adjacent hex** (the *giver*, B). Both must be elite or both regular. The 1-figure infantry crew a destroyed artillery leaves behind can regroup with infantry. Infantry needs morale above 0 (the receiver and the giver).
- **Figures:** B's figures move into A until A is back to full (6 infantry, 3 tanks), B's normal figures first and its squad leader last. If B gives them all, it leaves the board, and the enemy gets **no medal** for it (it wasn't destroyed); its leader becomes a normal figure in A, and A keeps its own leader. If B has figures left over it stays, with its leader, as a weaker unit.
- **Damaged tank figures:** a figure hit but not lost can move and **keeps its damage**. B's healthy figures go first, its damaged one stays with B as long as it can. To make this work the app stores **hits per figure** instead of one count per unit (Step R1), so a tank can have two damaged figures.
- **Cost and turn:** the receiver pays the 2 energy or fuel. **Neither unit moves or fires** this turn: A is busy regrouping, and B can't be given an action of its own.
- **Supplies:** A ends with the **better of each**: for each supply (morale, energy, ammo, fuel, shells) and each piece of equipment, the higher of A's and B's, never past A's full amount. A B that stays keeps its own.
- **Resting:** a B that stays on the board had no action, so it **rested**: infantry gets the resting 2 energy at the end of the turn.
- **When:** the player gives Regroup in Órdenes (pick the receiver, the Regroup action, then tap the giver); the figures move as the orders are revealed, before movement and the battle, as Medic does.
- **Computer:** the computer player uses Regroup.
- **Rule book:** gets the squad leader rule and the Regroup rule.

## Decided (2026-10-26, second round)
- **Damage per figure only for tanks:** infantry and artillery figures fall at the first hit, so they have no damage to keep. Only a tank can have figures hit but not lost, and now it can have more than one.
- **The next hit on a tank** goes to its most damaged figure; the squad leader is still hit last.
- **Mechanic** mends the most damaged figure.
- **Regroup's painting:** Infantry Assault's (`infantry-assault`) for now.
- **Sandbags:** a giver that leaves the board takes its sandbags with it, as a destroyed unit does.
- **Branch:** built on `feat/regroup`, merged into `main` when the steps are done.

---

## Step R1: Hits per figure (no rule change)
Today `GameSession.hits` is one number per unit and `data/figures.ts` works the figures out from it (`figuresLeft`, `figureDamaged`). That can't hold two damaged figures, which Regroup needs.
- [x] `data/figures.ts`: a unit's figures as a list of the hits each living figure has taken, front first and the squad leader last (`readonly number[]`; infantry and artillery figures are always 0, since a hit takes them). Pure helpers with tests: `freshFigures(unitType)`, `takeHits(figures, hits, perFigure)` (the most damaged figure first, then the front ones, the leader last; figures that reach `perFigure` are lost), `healFigure` (Medic: a lost figure back, in front of the leader), `mendFigure` (Mechanic: the most damaged figure), `isDamaged`, and the count and "damaged" the map draws
- [x] `GameSession`: `hits: Map<Unit, number>` becomes `figures: Map<Unit, readonly number[]>` (a unit missing from it is at full strength, as now). `sufferHits`, `carryOut`'s Medic and Mechanic, `woundsOf`, the artillery crew (1 figure) and `UnitStrength` read it. `UnitStrength.damaged` stays a boolean ("a figure is hit"); the badge's text says how many figures are damaged when there are two
- [x] `RollReading`, `RevealView`, `SharedBattleView`, `passAndPlay.ts`, `rollResult.ts` and `ai/selfPlay.ts` move to the helpers instead of reading a hit count (limited damage still counts figures)
- [x] `saveGame.ts`: `SessionState`/`SavedGame` store each unit's list instead of `hits`; bump `SAVE_VERSION`
- [x] Every existing figures test passes unchanged (with one damaged figure at most, the rules give the same results); new tests for a unit with two damaged figures

## Step R2: The squad leader, shown
- [ ] `UnitComponent`: in pass and play the leader is the last sprite spot to go; draw it with a small rank mark (a chevron or star, `--m44-*` colours, works in every look) and a `<title>`: "Jefe de escuadra: cae el último y da la medalla" / "Squad leader: falls last and gives the medal". A damaged leader shows it as the other figures do
- [ ] `UnitList` (Órdenes): the figures line counts the leader apart ("5 + jefe" / "5 + leader") when it helps reading; keep it short
- [ ] `ruleBook.ts`: the squad leader rule in both languages (every unit has one; the last figure hit; the one whose fall gives the medal)
- [ ] Check at 1280×800 landscape in English (desktop and tablet touch)

## Step R3: Regroup, the rules (game-core)
- [ ] `unitAction.ts`: a new `ActionEffect` `"regroup"`. `data/unitActions.ts`: `infantry:regroup` (2 energy) and `tank:regroup` (2 fuel), painting `infantry-assault`, `move: 0`, `fire: null`, `ownTablets: false`, names "Reagrupar" / "Regroup", texts in both languages
- [ ] `Order` gets `partner?: Position`, the giver's hex; `saveGame.ts` stores it (bump `SAVE_VERSION` with R1's if they ship together)
- [ ] `actionRules.ts`: Regroup is offered only when the unit has lost a figure and has at least one possible partner; a new refusal reason (e.g. `"noPartner"`) with its label in `src/labels/`. A pure `regroupPartners(...)`: adjacent, same type (the artillery crew counts as infantry), same elite status, no order of its own, not already a partner of another Regroup, infantry morale above 0
- [ ] A pure `regroup(receiver, giver, perFigure, maxFigures)` in `data/figures.ts` or a new `game-core/regroup.ts`: the figures A takes (B's healthy ones first, its damaged ones next, its leader last), B's figures left, and whether B is emptied; and `betterOf(suppliesA, suppliesB, full)` next to `refill` in `unitSupplies.ts`. Tests for infantry, tanks with damaged figures on either side, elite, the crew, and a B that stays
- [ ] `GameSession.giveRegroup(from, partner)` and `regroupPartners(position)`; `giveAction` and `giveRegroup` refuse to order a unit that's already someone's partner, and taking back the Regroup frees the partner
- [ ] `carryOut`'s `"regroup"`: move the figures and the supplies; an emptied B leaves the board, taking its sandbags, with a new battle edit kind (`"regroup"`, not `"remove"`, so `unitsLost` and the medals don't count it); a B that stays counts as resting for energy. Check that the reveal carries it out **before** `moveSimultaneously`, so the hex B leaves is free for that turn's moves, and that the other side's view (`opponentOf`, fog of war) shows the change only after the reveal
- [ ] The turn log and `HistoryDialog` show "Se reagrupó con … (N figuras)" / "Regrouped with … (N figures)"
- [ ] Tests in `gameSessionEffects.test.ts` and `passAndPlay.test.ts`: costs, both units idle, no medal, supplies, the save round trip

## Step R4: Regroup, the screen
- [ ] `ActionPopup`: Regroup appears with the other actions (greyed with its reason when it can't be given). Picking it highlights the possible partners on the map, as moves are highlighted; tapping one gives the order (one tap; 48px targets)
- [ ] `ActionPanel` shows the Regroup card and which unit joins; `UnitList` marks the partner "Se une a …" / "Joining …" and doesn't offer it actions; the map draws a short arrow from B to A (`OrderToken`)
- [ ] `RevealView` shows the regroup; a B that left the board disappears with the reveal
- [ ] Every new string in both languages (`defineMessages`, labels)
- [ ] Check at 1280×800 landscape in English, desktop and tablet touch

## Step R5: The computer regroups
- [ ] `ai/actionChoice.ts`: a weak unit (lost 2 or more figures) with a weak partner next to it and no good shot where it stands regroups, into the unit on the better ground or further from the enemy; never when the receiver has a good shot. A weight in `scoring.ts`
- [ ] `aiStep.ts` gives the order through `giveRegroup`
- [ ] Tests: `actionChoice.test.ts` picks Regroup in the plain case and not with a good shot; a `selfPlay` run where regroups happen and every one is legal

## Step R6: Write it down
- [ ] `ruleBook.ts`: the Regroup rule in both languages, numbers from the data files (the costs from `unitActions.ts`, the full figures from `figures.ts`)
- [ ] `docs/house-rules.md`: the squad leader and Regroup
- [ ] `docs/ARCHITECTURE.md`: per-figure hits (`data/figures.ts`, `GameSession`), the Regroup action and its battle edit
- [ ] Tick off "New Rework: Officer" in `myNextPlan.md`
