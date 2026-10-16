# Pass and play: next steps

What's left of [PASS_AND_PLAY.md](oldPlans/PASS_AND_PLAY.md) (PP1–PP7 are built) and of the changes after it: the card rebalance ([PLAN-part2.md](oldPlans/PLAN-part2.md), Part J), pinned units, limited damage dropped by the app, units of one side passing through each other, Medic and Mechanic healing. Work through it in order and tick items off when they're done. Items marked **Decide** need an answer from the player first.

## 1. Play a whole game on the tablet
Play at least one full scenario, in landscape and portrait, and note under 3 what feels wrong. "Modo prueba" puts every combat card in the hand. Things to watch:

### Hidden turns
- [ ] The cover screen goes up every time the device changes hands, and nothing of the other side's hand, cards or orders shows before it
- [ ] A hand isn't dealt in again when a player gets the device back, nor after resuming a match
- [ ] The attacker's extra first turn: "Pasar" is off, and the defender joins at turn 2. Its pins and hits don't carry into the defender's turn 2
- [ ] While the orders are secret, the enemy army (and its sandbags) shows at the hexes its orders started from, not where it was ordered to
- [ ] Every map is seen from the main side picked in the menu, whoever holds the device

### Reveal and movement
- [ ] Both sides' cards and orders are clear on the reveal map, with the cards given to units shown as badges
- [ ] Units move step by step together. Collisions happen where expected: same hex, swapping hexes, stepping into a standing enemy
- [ ] Units of one side pass through each other's hexes; when two end on one hex, the later arrival goes back along its path
- [ ] Orders cut short come out right: wire a tank didn't reach comes back, a unit that never left keeps its sandbags
- [ ] Collision dice: close assault minus 1, terrain ignored. A unit whose order doesn't let it fire doesn't roll, and with no flag on either side the one that moved bounces back a hex. A unit that collided has no shot left in the battle
- [ ] The collision list fits the landscape column. Look out for the bugs `myNextPlan.md` notes ("collisions are very buggy")
- [ ] Medic and Mechanic: the weakened unit's figures come back as the orders are carried out

### Figures and hits
- [ ] Figure counts feel right in play: infantry 6, armour 3 of 2 hits, artillery 3 then a 1-figure crew
- [ ] Limited damage: the extra hits are dropped by the app (grenades kept first), flags and supplies always count; a card's extra dice keep one more
- [ ] Figures, a damaged figure (red badge), the "−N" hits this turn and the pinned and retreat marks are readable on the tokens

### Battle
- [ ] Firing order: units that didn't move first, then moved ones (and moved infantry with ¡Fusiles arriba!); attacker first, sides alternating, one side going on when the other has nothing left
- [ ] Targets and line of sight with both armies on the map; the target's type and sandbags known without questions
- [ ] A unit with an enemy next to it is offered only the adjacent hexes
- [ ] Pinned: the first flag pins (pinned infantry fires with a die less), each flag after it is a hex to retreat at once, and a unit that retreated doesn't battle again. Sandbags ignore 1 flag
- [ ] Retreats: the unit's player taps the hexes among the two behind; a hex it can't retreat is a hit
- [ ] Taking ground after a close assault whose target retreated or was destroyed: armour moves in and fires again, infantry pushes the enemy out without firing again
- [ ] Infantry on barbed wire can remove it instead of firing, and the wire goes from both sides' boards
- [ ] No undo of a shot: check this doesn't hurt after a mis-tap

### Combat cards
- [ ] Attack cards (Barrage, Air Power, Air Bombardment) roll every marked hex before anyone fires, the marks visible whichever side played them
- [ ] Close Assault marks the units next to an enemy as the battle starts
- [ ] Concentrated Fire's group roll: "Sumar unidad", the dice added up, limited damage over the whole group. The `myNextPlan.md` note says it rolls the wrong dice when close assault and range shots mix
- [ ] Suppressive Fire's switch changes the die (one infantry side becomes a flag)
- [ ] Not One Step Back (infantry ignores every flag), Personal Armor (the first 2 infantry-symbol hits ignored), Camouflage (only fired at in close assault, lost when the unit moves or fires) and Fortify (sandbags at once instead of firing) work against the other side's shots
- [ ] Street Equipment, Explosives, Spotter and Heat of Battle add their dice or flag

### Final phase and saving
- [ ] Each side draws its card and takes its reward behind the cover screen (Refuel gives Armor Assault, Reinforcements' infantry arrives with 6 figures)
- [ ] Reposition: the artillery moves up to 2 hexes in the final phase
- [ ] Reload or close the tab mid-turn (orders, reveal, battle, retreats): the match resumes behind the cover screen, in the same state
- [ ] Each phase fits one screen in landscape at 1280×800

## 2. Open decisions
- [ ] **Decide:** whether a retreat may go through or onto a hex the unit couldn't fire from (now: any free, passable hex behind)

## 3. Fixes from the playtest
- [ ] (Add what step 1 turns up)

## 4. Winning (PP5)
- [ ] Medals and objective hexes per scenario
- [ ] The end of the game, with a summary (from [myNextPlan.md](myNextPlan.md))

## Later
- Fog of war
- Playing against the computer ([myNextPlan.md](myNextPlan.md))
