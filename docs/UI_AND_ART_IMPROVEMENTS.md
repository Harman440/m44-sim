# UI and Game Art Improvements

Ideas for improving the visual style and usability of the game. These are proposals, not implemented changes.

## Terrain and board art

- **Add more terrain art and terrain types.** Start with visual variants where possible, then add a new terrain rule when it creates a distinct tactical choice. Possible themes include ruins, rocky ground, orchards, and more varied countryside. A new rules-bearing terrain needs coordinated updates to its type, movement and combat rules, labels, and art.
- **Revisit village art.** Try a quieter hamlet or farmhouse tile style that uses the existing town rules before considering a full rollback of the current village artwork. Treat houses as a new playable hex type only if they should have different rules from towns.
- [x] **Add coastal bluff art for hills.** A hill next to the beach or sea turns its cliff face toward the water and fades into grassy slopes on landward sides. It uses the existing hill rules; beach and hill remain distinct terrain.
- **Move sandbags behind unit figures.** Draw sandbags after terrain and fog, but before units, so they remain visible on the board without covering soldiers.
- **Keep map layers readable.** Terrain, unit sprites, selection highlights, and status markers should have distinct contrast so map detail does not compete with game information.

## Unit art and badges

- **Replace the tank figures.** Both faction tank assets are placeholder SVGs with the same silhouette in different colors. Give Allied and Axis tanks recognizable, distinct silhouettes, with clear turrets and tracks that remain legible at map scale. Match the infantry sprite scale and style, and retain transparent backgrounds.
- **Improve elite badges.** Make the elite mark more recognizable at small sizes, with a clear high-contrast shape and consistent placement. Reuse the same visual treatment in the unit list where practical.
- **Reduce badge crowding.** Elite, firing, damage, retreat, and combat-card markers can gather around one unit. Standardize their size and placement; keep secondary details in the unit list or a selected-unit view when they do not need to sit on the map.

## UI and interaction

- **Make the action pop-up tighter.** Prioritize actions that make sense for the selected unit, use icons to help scan the list, and add some transparency so the map remains visible underneath. Keep unavailable actions and their reasons clear when they are useful to explain a restriction.
- **Help players compare actions.** The pop-up currently lists action names and costs; the separate action panel shows the selected action's description and card art. Add a short description or compact visual cue to each choice, while preserving the larger detail panel for the selected action.
- **Make selection behavior predictable.** Clicking outside the action pop-up should deselect the unit where appropriate. Changing fire type should keep the selected unit selected.
- **Keep map and roster in sync.** Selecting a unit from either the map or unit list should clearly identify the same unit and keep its action and supply information easy to find.

## Suggested order

1. Move sandbags behind the units.
2. Replace the tank placeholder figures and improve elite badge legibility.
3. Refine the action pop-up and status-marker layout.
4. Prototype village and coastal bluff art using existing terrain rules.
5. Add new terrain rules after the art concept and tactical role are clear.
