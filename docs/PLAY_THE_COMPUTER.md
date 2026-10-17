# Playing against the computer

Pass and play, but the computer plays one side. It's on the list in [PASS_AND_PLAY_NEXT.md](PASS_AND_PLAY_NEXT.md) ("Later") and the player's notes ([myNextPlan.md](myNextPlan.md): "Make the game playable against AI"). Work through it one step at a time (AI1, AI2, …), tick items off when they're done, and ask about items marked **Decide** before building them.

This changes one line of CLAUDE.md: "The app does not simulate the opponent or play as an AI". That stays true on own tablets; against the computer, the app plays one side of a pass and play match.

## The idea

A pass and play match already has everything the computer needs: both armies are in the app, the hits are dealt by the app, and each side is its own `GameSession` whose actions return `false` when they aren't allowed. So the computer is **a player that calls the same actions** a person's taps do, on its side's session and on the match. No rule runs anywhere new, and the rules don't know who is playing.

```
PassAndPlayMatch (ai: "Axis")
 ├─ sessions.Allies  ← the person's taps (GameView, RevealView, SharedBattleView)
 └─ sessions.Axis    ← aiStep(match, "Axis", brain): one action at a time
```

- **Game-core, no React:** `src/game-core/ai/`. `aiStep(match, side, brain)` looks at what the computer's side has to do now and does **one** action (a card, an order, a shot, a retreat…), returning `false` when it has nothing to do. The *brain* picks among the options (`Brain`: `pickCard`, `orderFor`, `targetFor`, `retreatTo`, `takeGround`, `keepCard`, `reward`…), so a smarter computer later is a new brain, not a new driver.
- **Fair play:** the brain only sees what a person on that side sees: its own session, and the other army through `match.opponentOf(side)` (units where they started, orders hidden until the reveal). It never reads the other session.
- **One step at a time** so the screen can show each thing the computer does (a shot's dice, a retreat) at a pace the person can follow, and tests can run `while (aiStep(...))` with a cap.
- **The pace is the UI's:** a hook in `MatchView` (`useComputerPlayer`) calls `aiStep` after each snapshot, at once for what the person doesn't see (cards, orders, the final phase) and after a short pause in the shared battle. Game-core has no timers.
- **Seeded:** the brain gets a `random` like the sessions' dice do, so tests are repeatable.

## What the computer decides, phase by phase

| Phase | Actions | Very basic brain (AI2) |
|---|---|---|
| PARADROP | `dropUnit` ×N, `finishParadrop` | Random free hexes the scenario allows |
| AWAIT_ATTACKER | none (`follow()` starts the defender) | — |
| PICK_CARDS | `pickCard(card, section?)` | The card that orders the most of its units (`orderablePositions`); a "chosen" section: the one with most units. No combat cards |
| ORDER_UNITS | `issueOrder(from, to, slot?)` ×N, `commitOrders` | Each orderable unit: stay if it already has a target, else move to the reachable hex nearest the closest enemy (`getMoveOptions`, `hexDistance`), preferring one it can still fire from. No coins spent, no extra orders |
| Reveal / movement | `moveUnits`, `rollCollision`, `finishReveal` | The person taps them, as now (they're shared screens) |
| BATTLE | `rollAttacks`, `fire(order, target)`, `holdFire`, `retreat(to)`, `decideGround` | Fire the fireable unit with the most dice at its best target (most dice; tie: fewest figures); no target: hold fire. Retreat: the option farthest from the enemy. Always take ground |
| END_OF_TURN | `keepCard`, `chooseReward`, `discardCombatCard`, `placeReinforcement`, `reposition`, `endTurn` | Keep the first card offered, never "Descartar y robar otra", take 2 supplies, place a reinforcement on the first free hex, then end the turn |

## Steps

### AI1: A match with a computer side (game-core)
- [x] `PassAndPlayMatch` takes `computer?: Faction` (the other side is the person's; `mainSide` is the person's side). With one: no cover screen, `active` is always the person's side, locking orders never hands the device over, `canPass` is false, and `finishBattle` leaves the person's final phase uncovered
- [x] Saved in `SavedMatch` (`computer`), `MATCH_SAVE_VERSION` bumped
- [x] Tests in `passAndPlay.test.ts`: a turn where the computer's session is driven by hand calls — no cover screen, no hand over, the reveal comes once both have locked; save and restore keep the computer side

### AI2: The very basic computer
- [x] `src/game-core/ai/aiStep.ts`: the driver (what the side must do now, one action) and `Brain`, the interface it asks
- [x] `src/game-core/ai/basicBrain.ts`: the very basic brain in the table above. It must never stall: when no option it likes is allowed, it takes any allowed one (the first card, standing still, holding fire)
- [x] Tests: each decision on a small board (`basicBrain.test.ts`); and a soak test, computer against computer, on every built-in scenario with seeded dice, for 20 turns or until one side has no units: no exception, every turn ends, `aiStep` never loops without changing the snapshot
- [x] The soak test is a check on the rules engine too: anything it turns up goes in [PASS_AND_PLAY_NEXT.md](PASS_AND_PLAY_NEXT.md) section 1. Its first run, 3 seeds on each built-in scenario, turned up nothing: every game played its 20 turns (Pegasus Bridge once ended at turn 19 with the Axis wiped out)

### AI3: Playing it
- [ ] Menu: "Contra el ordenador" / "Against the computer" beside "Pasar y jugar": the person picks a scenario and their side; the computer gets the other
- [ ] `useComputerPlayer(match)` in `MatchView`: drives the computer's side; a quiet "El ordenador está pensando…" / "The computer is thinking…" while it has something left to do (it usually finishes its orders before the person picks a card)
- [ ] Shared battle: the computer's shots land on the map with their dice and the side column says which unit fired at what; **Decide:** after each of its shots the person taps "Seguir", or it goes on by itself after a pause
- [ ] Its retreats and taking ground show as moves (the tokens already glide)
- [ ] Reload mid-turn: the match resumes and the computer carries on where it was
- [ ] The rule book (`data/ruleBook.ts`), README and CLAUDE.md describe it
- [ ] Checked at 1280×800 and 800×1280 with touch, in Spanish and English: a whole match against the computer, as each side, on a scenario with an extra first turn and one with a paradrop

### AI4: A better computer (later, once the basic one is played)
Ideas to try, each one a brain change with a test, measured by playing the new brain against the old one in the soak test:
- [ ] Cover: prefer to end a move in a forest, town, hedgerow or on a hill, and not in the open next to several enemies
- [ ] Focus fire: shoot the units already hit (fewest figures) and the ones that can hit back hardest
- [ ] Cards: score a card by what its orders would achieve, not just how many units it orders; keep the right cards for later
- [ ] Combat cards: start with the ones the app applies by itself (dice bonuses, Fuego concentrado, Fuego de supresión), then the marker cards (Barrage, Air Power: mark the hex with the most enemies)
- [ ] Supplies: buy extra orders (`extraOrderable`), pick a combat card instead of supplies when it has a use for one
- [ ] Objectives once there are medals and objective hexes (PP5, [PASS_AND_PLAY_NEXT.md](PASS_AND_PLAY_NEXT.md) section 3)
- [ ] **Decide:** levels to pick in the menu (Fácil, Normal…)

## Decisions
- **Decided** (2026-10-17): the computer sees only its own side and the other army as a person would: no peeking at the person's orders, even though they're in the app
- **Decided:** no combat cards for the very basic computer: it takes supplies every turn and doesn't spend them (in the soak test it ends 20 turns with about 50)
- **Decided:** collisions and the reveal stay the person's taps, as both sides' units roll there at once
- [ ] **Decide:** its shots in the battle: "Seguir" after each one, or a pause (see AI3)
