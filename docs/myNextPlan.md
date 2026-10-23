- Art work for cards
    - Cards using default art: refuel

- Think about special unit that hit with star
    - Use same dice as air power and create new 8 sided dice with one more tank or one more infantry depending on the unit it can hit with stars. remove one supplies
- More air powers?? double when air superiority or tripple

- Improve badges for elite units

- Finish game with game summary and show map

- More hexes types art and rules
- Improve Villages Art. Maybe revert all the changes to Villages and just add like "houses" or new hexes
- Hills could be see bluffs or hills. So merge with beach hexes too and dont show cliff on the countryside side
- sandbags on move to background

- Improve map sizes to much more hexes. Maps should be scrollable so that more fits

- More maps, with a map reader to quicken things
- PDF reader
- More rules will appear with more maps

- Improve AI. Sometimes makes weird decisions.
- Include Fog of war:
    - When AI is rolling dice dont show units
    - AI is really scared and just orders units when it is obvious there are no units close. Give AI better vision or something like that

- New Card: Special equipment combat cards: give infantry a mortar or rocket launcher

- collision are very buggy: I need more info. Improve interactions so this the bug is shown better

- ~~Rework to Card playing~~ (dropped: the actions game has no sections, docs/ACTIONS_PLAN.md R0):
    - The scenario is divded into two side or if bigger more sections. each section has to be atleat 7 hexes.
    - Follow House rules for overload for now

- Pop up for should be tighter and only show actions that make sense. Use icons instead of hexes. clicking outside deselects unit. Add a bit of transparency to pop up
- when a unit is chosen and change type of fire keep it selected
- can reinforcents appear wherever: fix only end hexes
- I am too free to order units: check Moral, ammo, etc.. everything must feel more
- add condition of rest if not next to enemy unit
- some times the fire is obvious as there is nothing to fire and no units will retreat into range and/or there is only one obvious target. make these decisions faster for the player

- New Rework: Officer
   - Each units last figure is a serageant and can recruit other troops from other units. It spends maybe moral and energy and must be near to other weakend unit
   - Officers are the figures that must die to count as a vistory point

- [x] Rework (built: [ACTIONS_PLAN.md](ACTIONS_PLAN.md)):
 - You order all units: To make it easier there can be to the right a list of all units to the left of the map. 
    The player can click on them one by one, the map zooms a little to the unit and the player can then do an action with that unit. The player can still select directly from the map
 - All command cards and combat cards will be named command cards and dont have to be played
 - Max 1 command card can be played
 - The player recieves nothing at the end of the turn.
 - The player starts with all command cards
 - These are the command cards:
    - The finest hour: all units fire with one extra dice: cost 15
    - Resupply: (Preparations image) all infantry get the equipment back and moral and ammo: cost 9
    - Refuel: (Armor Assault image) all tanks and artillery get the fuel topped up: cost 10
    - Air bombardement: same: cost 8 (depending on scenario)
    - Reinforcemnts: same: cost 10
    - barrage: same: cost 8 (depending on scenario)
    - Air power: same: cost 7 (depending on scenario)

 - Each unit now have extra traits:
    - all infantry have moral, energy, ammo and equipment
    - all tanks have fuel and shells
    - all artillery have fuel and shells
 - Moral: Infantry start with 5 and loose one each time a flag is rolled on it. Once Moral is 0 cant move and fire
 - Energy: Infantry start at 5 and some actions will cost energy. They recover 1 energy at the end of the turn. caps at 5
 - Ammo: Infantry start with 2; Every time they fire they loose 1. Must be ordered to reload to recover 2 ammo
 - Fuel: Armor start with 5, Artillery with 1. some actions requiere fuel. Never recovered unless refuel card is played
 - shells: Armor start with 2, Artillery with 2. Loose one when firing, must be ordered to reload to recover 2 shells

 - Actions: When selecting a unit a small menu should pop-up to the right so that the player can choose and action. When an action is selected a desciption appears to the right of the map with the image i tell you below
 - Infantry Actions:
    - FireFight: (Firefight image) Fire without moving: cost 1 energy
    - Assault: (Infantry Assault Image) Move 1 hex and fire: cost 1 energy
    - No respite: (no respite Image) Move 1 hex and fire but in the not moving phase: cost 2 energy
    - close Assault: (close Assault image) Dont move fire close assault with 1 extra dice: cost 1 energy
    - Move out: (Move out Image) Move up to 2 hexes and not fire: cost 1 energy
    - Medic: (Medic Image) Dont move nor fire, recover 1 soldier: cost the medic
    - Behind enemy lines: all the same: cost 4 energy
    - Motorized: (Motorized Image) Move up to 3 hexes and not fire: cost 2 energy
    - Moral up: (not a step back) recover all Moral, cost 1 energy
    - Camouflage: same: cost 2 energy not fire nor move
    - Fortify: same: cost 2 energy and sandbags equipment. Not move nor fire
    - Take cover: (Rattenkrieg image). Move up to 1 hex and Ignore first 2 infantry hits (like personal armour). 1 energy cost
    - reload: recover ammo

 - Infantry Combat options, Always loose 1 ammo:
    - Normal: same
    - Explosives: (Mix of street equipment and Explosives image) If in close assault +1 dice and loose explosives equipment
    - suppresive Fire: use special dice. If 6 sided dice: 1 inf, 1 grenade, 3 retreats and 1 supply, If 8 sided die: 4 retreats, 2 inf, 2 supply

 - Armour actions:
  - Firefight: Fire without moving
  - Assault: Move and fire: cost 1 fuel
  - Armour Forward: Ignore terrain Movement restrictions: 2 fuel
  - Mechanic: Dont move nor fire and if there is a damaged tank remove damage
  - Reload: recover 2 shells

 - Armour combat options, always loose 1 shell:
    - Normal: If it hasnt move fire +1 dice in close assault
    - suppresive Fire: same as Infantry
 
 - Artillery Actions:
    - Firefight: (Use spotter Image) Dont move and Fire
    - artillery Bombardement: (Artillery Bombardement Image) Fire twice: cost 1 fuel
    - Reposition: (reposition Image) Move 2 hexes and not fire: cost 1 fuel
    - Fortify: (Fortify Image) place sandbags: cost 1 fuel
    - Reload: recover 2 shells

 - Artillery Combat options:
    - Fire: Each Fire costs 1 shell for artillery bombardement each fire 1 shell

 - each unit also has a luck meter: For every hit the luck goes down and for every miss it goes up. The probabilty of landing a hit is affected by this