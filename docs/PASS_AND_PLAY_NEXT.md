# Pass and play: next steps

What's left of [PASS_AND_PLAY.md](oldPlans/PASS_AND_PLAY.md) (PP1–PP7 are built) and of the changes after it: the card rebalance ([PLAN-part2.md](oldPlans/PLAN-part2.md), Part J), pinned units, limited damage dropped by the app, units of one side passing through each other, Medic and Mechanic healing. Work through it in order and tick items off when they're done. Items marked **Decide** need an answer from the player first.

**Decided:** a retreat goes to any free, passable hex among the two behind the unit, toward its own edge, as now.

## 1. Fixes from the playtest
The player played a match after the latest changes: everything else worked. The bugs from [myNextPlan.md](myNextPlan.md) are still there:
- [ ] Collisions are still buggy: find the cases that go wrong (ask the player for the ones seen), cover them with tests in `simultaneousMove.test.ts` and `passAndPlay.test.ts`, and fix them
- [ ] Concentrated Fire rolls different dice when the group mixes close assault and shots at range (each unit its own die, Step 65). The player calls it a bug: **Decide** with the player which die the whole group rolls, then fix it
- [ ] (Add what the next games turn up)

## 2. Checks for the next game
The risky parts, to watch in a match with "Modo prueba" (every combat card in the hand):
- [ ] Collisions: same hex, swapping hexes, stepping into a standing enemy; the bounce back with no flag; a unit that collided has no shot left
- [ ] Units of one side passing through each other; when two end on one hex, the later arrival goes back along its path
- [ ] Pinned and retreats: the first flag pins, each flag after it is a hex to retreat at once; a hex it can't retreat is a hit
- [ ] Taking ground: armour moves in and fires again, infantry pushes the enemy out without firing
- [ ] The reworked cards: Concentrated Fire, Suppressive Fire, Not One Step Back, Personal Armor, Camouflage, Fortify, Medic and Mechanic, Reposition, Refuel
- [ ] Reload or close the tab mid-turn (orders, reveal, battle, retreats): the match resumes behind the cover screen, in the same state

## 3. Winning (PP5)
- [ ] Medals and objective hexes per scenario
- [ ] The end of the game, with a summary (from [myNextPlan.md](myNextPlan.md))

## Later
- Fog of war
- Playing against the computer ([myNextPlan.md](myNextPlan.md))
