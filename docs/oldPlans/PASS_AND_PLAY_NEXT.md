# Pass and play: next steps

What's left of [PASS_AND_PLAY.md](oldPlans/PASS_AND_PLAY.md) (PP1–PP7 are built) and of the changes after it: the card rebalance ([PLAN-part2.md](oldPlans/PLAN-part2.md), Part J), pinned units, limited damage dropped by the app, units of one side passing through each other, Medic and Mechanic healing. Work through it in order and tick items off when they're done. Items marked **Decide** need an answer from the player first.

**Decided:** a retreat goes to any free, passable hex among the two behind the unit, toward its own edge, as now.

## 1. Fixes from the playtest
The player played a match after the latest changes: everything else worked. The bugs from [myNextPlan.md](myNextPlan.md) are still there:
- [ ] Collisions: reaching a hex first must give no priority. Today the order units arrive in decides things (of two units of one side ending on one hex, the later arrival goes back along its path; check where else the step or order counts). **Decide** with the player what happens instead, then cover it with tests in `simultaneousMove.test.ts` and `passAndPlay.test.ts` and fix it
- [x] Concentrated Fire's dice: **Decided:** a unit in close assault rolls the battle die, and a unit firing at range that joins it adds its dice as 8-sided long-range dice (when the long-range die is on), all in the one roll. The roll already did so (tested both ways in `passAndPlayCards.test.ts`); the bug was the dice shown before the roll, all of the leading unit's kind. `DicePool` now draws each joined unit's dice on its own die (`JoinOption.eightSided`), in 2D and 3D, with a mixed total ("3 dados y 2 dados de 8 caras")
- [ ] (Add what the next games turn up)

## 2. Checks for the next game
The risky parts, to watch in a match with "Modo prueba" (every combat card in the hand):
- [ ] Collisions: same hex, swapping hexes, stepping into a standing enemy; the bounce back with no flag; a unit that collided has no shot left
- [ ] Units of one side passing through each other, and two ending on one hex (with no priority for the first there, once fixed)
- [ ] Pinned and retreats: the first flag pins, each flag after it is a hex to retreat at once; a hex it can't retreat is a hit
- [ ] Taking ground: armour moves in and fires again, infantry pushes the enemy out without firing
- [ ] ~~The reworked cards: Concentrated Fire, Suppressive Fire, Not One Step Back, Personal Armor, Camouflage, Fortify, Medic and Mechanic, Reposition, Refuel~~ (the card game was replaced by the actions mode, docs/ACTIONS_PLAN.md)
- [ ] Reload or close the tab mid-turn (orders, reveal, battle, retreats): the match resumes behind the cover screen, in the same state

## 3. Winning (PP5)
**Decided** (2026-10-19): each enemy unit destroyed is a medal; an objective hex is a medal for its side while one of its units stands on it at the end of a turn (the official "temporary" objective); at the end of each turn's battle a side that has reached the scenario's medals wins, the one with more if both have, and with as many each the game goes on; a side with no units left loses. Only in pass and play and against the computer, where the app knows both armies; on own tablets the medals are counted at the table (the menu's scenario panel shows the conditions).
- [x] Medals and objective hexes per scenario: `Scenario.victory` (`medals`, `objectives`, each a side, a name and its hexes), in the scenario file and its schema, checked by `validateScenario`. The built-ins (the player's choice of the proposed set): Pegasus Bridge 4 (Allies: each bridge), Sainte-Mère-Église 5 (both sides: the town's bottom-left hex, (4,6); the player's ruling, 2026-10-19, so a hex can be both sides' objective), Arracourt 5 (no objectives: the player's ruling, 2026-10-19), Forêt d'Écouves 5 (Allies: Écouché, the only objective)
- [x] The end of the game, with a summary: `MatchResultView` (the winner, the medals, each side's losses); the medals in the header, the reveal and the battle (`MedalTally`), the objectives on every map (a medal in their side's colour, solid while held)
- [ ] **Check:** which town hex is Écouché. It was picked from the map without the scenario sheet: (0,5), the town at the top centre
- [x] The medals to win: few units fell in computer games because the computer was too cautious (the player's call). With the bolder weights every computer-against-computer game ends, in 7 to 16 turns, and both sides win (32 games: Allies 15, Axis 17)
- [ ] The map editor: the medals and objective hexes of a new map (a file can already have them)

## Later
- Fog of war: built (in the battle only between two people; see `fogOfWar.ts` in ARCHITECTURE.md)
- Playing against the computer: planned in [PLAY_THE_COMPUTER.md](PLAY_THE_COMPUTER.md)
