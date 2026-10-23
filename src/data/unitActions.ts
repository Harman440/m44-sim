// data/unitActions.ts
// The actions mode's actions and fire options (house rules). Each one names the card painting
// shown with it; the ones without a painting of their own borrow one for now (see
// docs/ACTIONS_PLAN.md R12). Change costs and moves here.
import { UnitType } from "../game-core/unit";
import type { FireOption, UnitAction } from "../game-core/unitAction";
import type { SupplyCost } from "../game-core/unitSupplies";
import { Equipment, Supply } from "./unitSupplies";
import type { Localized } from "../i18n/lang";

const energy = (amount: number): SupplyCost => ({ amounts: { [Supply.ENERGY]: amount } });
const fuel = (amount: number): SupplyCost => ({ amounts: { [Supply.FUEL]: amount } });
const energyAndMorale = (energy: number, morale: number): SupplyCost => ({ amounts: { [Supply.ENERGY]: energy, [Supply.MORALE]: morale } });
const FREE: SupplyCost = {};
const ONE_SHOT = { shots: 1 };

type Details = Omit<UnitAction, "id" | "unitType" | "name" | "description" | "ownTablets"> & { ownTablets?: boolean };

const action = (unitType: UnitType, name: string, names: Localized, description: Localized, details: Details): UnitAction => ({
  id: `${unitType}:${name}`,
  unitType,
  name: names,
  description,
  ownTablets: true,
  ...details,
});

const FIREFIGHT_NAME: Localized = { es: "Escaramuza", en: "Firefight" };
const FIREFIGHT_TEXT: Localized = { es: "Dispara sin moverse.", en: "Fires without moving." };
const RELOAD_NAME: Localized = { es: "Recargar", en: "Reload" };

const infantry = (name: string, names: Localized, description: Localized, details: Details) =>
  action(UnitType.INFANTRY, name, names, description, details);
const tank = (name: string, names: Localized, description: Localized, details: Details) =>
  action(UnitType.TANK, name, names, description, details);
const artillery = (name: string, names: Localized, description: Localized, details: Details) =>
  action(UnitType.ARTILLERY, name, names, description, details);

export const INFANTRY_ACTIONS: readonly UnitAction[] = [
  infantry("firefight", FIREFIGHT_NAME, FIREFIGHT_TEXT, { painting: "firefight", cost: energy(1), move: 0, fire: ONE_SHOT }),
  infantry("assault", { es: "Asalto de Infantería", en: "Infantry Assault" },
    { es: "Se mueve hasta 2 casillas y dispara.", en: "Moves up to 2 hexes and fires." },
    { painting: "infantry-assault", cost: energyAndMorale(3, 2), move: 2, fire: ONE_SHOT }),
  infantry("noRespite", { es: "Sin tregua", en: "No Respite" },
    { es: "Se mueve 1 casilla y dispara con las unidades que no se movieron.", en: "Moves 1 hex and fires with the units that didn't move." },
    { painting: "no-respite", cost: energy(2), move: 1, fire: { shots: 1, round: "unmoved" } }),
  infantry("moveOut", { es: "En marcha", en: "Move Out!" },
    { es: "Se mueve hasta 2 casillas; si se mueve 1 o ninguna, dispara.", en: "Moves up to 2 hexes; if it moves 1 or none, it fires." },
    { painting: "move-out", cost: energy(1), move: 2, fireMove: 1, fire: ONE_SHOT }),
  infantry("medic", { es: "Médico", en: "Medic" },
    { es: "No se mueve ni dispara: recupera 1 figura. Gasta el botiquín.", en: "Doesn't move or fire: gets 1 figure back. Uses up the medic kit." },
    { painting: "medic", cost: { equipment: [Equipment.MEDIC_KIT] }, move: 0, fire: null, effect: "medic" }),
  infantry("behindEnemyLines", { es: "Tras las líneas enemigas", en: "Behind Enemy Lines" },
    {
      es: "Se mueve hasta 3 casillas sin que el terreno la detenga y dispara con las unidades que se movieron (las restricciones de combate se mantienen). Tras la batalla se mueve otras 3 casillas.",
      en: "Moves up to 3 hexes with no terrain stopping it and fires with the units that moved (battle limits still apply). After the battle it moves 3 more hexes.",
    },
    { painting: "infiltrators", cost: energy(5), move: 3, ignoresTerrain: true, moveAfterBattle: 3, fire: ONE_SHOT }),
  infantry("motorized", { es: "Motorizado", en: "Motorized" },
    { es: "Se mueve hasta 3 casillas y no dispara.", en: "Moves up to 3 hexes and doesn't fire." },
    { painting: "motorized", cost: energy(4), move: 3, fire: null }),
  infantry("moraleUp", { es: "Subir la moral", en: "Morale Up" },
    { es: "No se mueve ni dispara: recupera toda la moral.", en: "Doesn't move or fire: gets all its morale back." },
    { painting: "not-a-step-back", cost: energy(1), move: 0, fire: null, effect: "moraleUp", ownTablets: false }),
  infantry("camouflage", { es: "Camuflaje", en: "Camouflage" },
    {
      es: "No se mueve ni dispara: tras la batalla recibe la ficha de camuflaje. Solo se le puede disparar en asalto cercano, y la pierde cuando se mueve o combate. Gasta la red de camuflaje.",
      en: "Doesn't move or fire: gets the camouflage badge after the battle. It can only be fired at in close assault, and loses it when it moves or battles. Uses up the camouflage net.",
    },
    { painting: "camouflage", cost: { ...energy(2), equipment: [Equipment.CAMOUFLAGE_NET] }, move: 0, fire: null, effect: "camouflage" }),
  infantry("fortify", { es: "Fortificar", en: "Fortify" },
    { es: "No se mueve ni dispara: pone sacos terreros en su casilla. Gasta los sacos.", en: "Doesn't move or fire: puts sandbags on its hex. Uses up the sandbags." },
    { painting: "fortify", cost: { ...energy(2), equipment: [Equipment.SANDBAGS] }, move: 0, fire: null, effect: "fortify" }),
  infantry("takeCover", { es: "A cubierto", en: "Take Cover" },
    {
      es: "Se mueve hasta 1 casilla y no dispara; este turno ignora el primer impacto de símbolo de infantería. Las granadas sí la impactan.",
      en: "Moves up to 1 hex and doesn't fire; this turn it ignores the first infantry-symbol hit. Grenades still hit it.",
    },
    { painting: "rattenkrieg", cost: energy(1), move: 1, fire: null, effect: "takeCover" }),
  infantry("reload", RELOAD_NAME,
    { es: "No se mueve ni dispara: recupera 2 de munición.", en: "Doesn't move or fire: gets 2 ammo back." },
    { painting: "preparations", cost: FREE, move: 0, fire: null, effect: "reload" }),
];

export const TANK_ACTIONS: readonly UnitAction[] = [
  tank("firefight", FIREFIGHT_NAME, FIREFIGHT_TEXT, { painting: "firefight", cost: FREE, move: 0, fire: ONE_SHOT }),
  tank("assault", { es: "Asalto", en: "Assault" },
    { es: "Se mueve hasta 3 casillas y dispara.", en: "Moves up to 3 hexes and fires." },
    { painting: "infantry-assault", cost: fuel(1), move: 3, fire: ONE_SHOT }),
  tank("armorForward", { es: "Blindados adelante", en: "Armor Forward" },
    {
      es: "Se mueve hasta 3 casillas sin que el terreno la detenga y dispara, salvo si acaba en una casilla desde la que no se puede disparar.",
      en: "Moves up to 3 hexes with no terrain stopping it and fires, unless it ends on a hex it can't fire from.",
    },
    { painting: "armor-forward", cost: fuel(2), move: 3, ignoresTerrain: true, fire: ONE_SHOT }),
  tank("mechanic", { es: "Mecánico", en: "Mechanic" },
    { es: "No se mueve ni dispara: repara la figura tocada (la que tiene impactos sin haber caído).", en: "Doesn't move or fire: mends the figure that's hit (hit but not lost)." },
    { painting: "mechanic", cost: FREE, move: 0, fire: null, effect: "mechanic" }),
  tank("reload", RELOAD_NAME,
    { es: "No se mueve ni dispara: recupera 2 proyectiles.", en: "Doesn't move or fire: gets 2 shells back." },
    { painting: "preparations", cost: FREE, move: 0, fire: null, effect: "reload" }),
];

export const ARTILLERY_ACTIONS: readonly UnitAction[] = [
  artillery("firefight", FIREFIGHT_NAME, FIREFIGHT_TEXT, { painting: "spotter", cost: FREE, move: 0, fire: ONE_SHOT }),
  artillery("bombardment", { es: "Bombardeo de Artillería", en: "Artillery Bombardment" },
    { es: "No se mueve y dispara dos veces; cada disparo gasta un proyectil.", en: "Doesn't move and fires twice; each shot uses a shell." },
    { painting: "artillery-bombardment", cost: fuel(1), move: 0, fire: { shots: 2 } }),
  artillery("reposition", { es: "Reposicionamiento", en: "Reposition" },
    { es: "Se mueve hasta 2 casillas y no dispara.", en: "Moves up to 2 hexes and doesn't fire." },
    { painting: "reposition", cost: fuel(1), move: 2, fire: null }),
  artillery("fortify", { es: "Fortificar", en: "Fortify" },
    { es: "No se mueve ni dispara: pone sacos terreros en su casilla.", en: "Doesn't move or fire: puts sandbags on its hex." },
    { painting: "fortify", cost: fuel(1), move: 0, fire: null, effect: "fortify" }),
  artillery("reload", RELOAD_NAME,
    { es: "No se mueve ni dispara: recupera 2 proyectiles.", en: "Doesn't move or fire: gets 2 shells back." },
    { painting: "preparations", cost: FREE, move: 0, fire: null, effect: "reload" }),
];

/**
 * Actions that move and fire, which a unit with nothing left to fire can still be given: it moves
 * and doesn't fire (Move Out, and armour, whose every move fires)
 */
export const MOVES_WITHOUT_SHOTS: readonly string[] = ["infantry:moveOut", "tank:assault", "tank:armorForward"];

/** Infantry-symbol hits a unit given Take Cover ignores in a turn */
export const TAKE_COVER_HITS = 1;

export const UNIT_ACTIONS: Record<UnitType, readonly UnitAction[]> = {
  [UnitType.INFANTRY]: INFANTRY_ACTIONS,
  [UnitType.TANK]: TANK_ACTIONS,
  [UnitType.ARTILLERY]: ARTILLERY_ACTIONS,
};

const ALL_ACTIONS = new Map([...INFANTRY_ACTIONS, ...TANK_ACTIONS, ...ARTILLERY_ACTIONS].map((each) => [each.id, each]));

export const actionById = (id: string): UnitAction | undefined => ALL_ACTIONS.get(id);

const ammo: SupplyCost = { amounts: { [Supply.AMMO]: 1 } };
const shell: SupplyCost = { amounts: { [Supply.SHELLS]: 1 } };

const NORMAL_NAME: Localized = { es: "Disparo normal", en: "Normal fire" };
const SUPPRESSIVE_NAME: Localized = { es: "Fuego de supresión", en: "Suppressive Fire" };
const SUPPRESSIVE_TEXT: Localized = {
  es: "Tira el dado de supresión: el de batalla con 1 infantería, 1 granada, 3 banderas y 1 suministro, o el de 8 caras con 2 infantería, 4 banderas y 2 suministros.",
  en: "Rolls the suppressive die: the battle die with 1 infantry, 1 grenade, 3 flags and 1 supply, or the 8-sided one with 2 infantry, 4 flags and 2 supplies.",
};

export const FIRE_OPTIONS: Record<UnitType, readonly FireOption[]> = {
  [UnitType.INFANTRY]: [
    { id: "infantry:normal", unitType: UnitType.INFANTRY, name: NORMAL_NAME, painting: "firefight", cost: ammo,
      description: { es: "Dispara como siempre. Gasta 1 de munición.", en: "Fires as usual. Uses 1 ammo." } },
    { id: "infantry:explosives", unitType: UnitType.INFANTRY, name: { es: "Explosivos", en: "Explosives" }, painting: "explosives-mix",
      cost: { ...ammo, equipment: [Equipment.EXPLOSIVES] }, closeAssaultOnly: true, closeAssaultBonus: { dice: 1 },
      description: {
        es: "Solo en asalto cercano: 1 dado más. Gasta 1 de munición y los explosivos.",
        en: "Close assault only: 1 extra die. Uses 1 ammo and the explosives.",
      } },
    { id: "infantry:suppressive", unitType: UnitType.INFANTRY, name: SUPPRESSIVE_NAME, painting: "heat-of-battle", cost: ammo, die: "suppressive",
      description: { es: `${SUPPRESSIVE_TEXT.es} Gasta 1 de munición.`, en: `${SUPPRESSIVE_TEXT.en} Uses 1 ammo.` } },
  ],
  [UnitType.TANK]: [
    { id: "tank:normal", unitType: UnitType.TANK, name: NORMAL_NAME, painting: "firefight", cost: shell, closeAssaultBonus: { dice: 1, unmoved: true },
      description: {
        es: "Dispara como siempre, con 1 dado más en asalto cercano si no se movió. Gasta 1 proyectil.",
        en: "Fires as usual, with 1 extra die in close assault if it didn't move. Uses 1 shell.",
      } },
    { id: "tank:suppressive", unitType: UnitType.TANK, name: SUPPRESSIVE_NAME, painting: "heat-of-battle", cost: shell, die: "suppressive",
      description: { es: `${SUPPRESSIVE_TEXT.es} Gasta 1 proyectil.`, en: `${SUPPRESSIVE_TEXT.en} Uses 1 shell.` } },
  ],
  [UnitType.ARTILLERY]: [
    { id: "artillery:fire", unitType: UnitType.ARTILLERY, name: { es: "Fuego", en: "Fire" }, painting: "spotter", cost: shell,
      description: { es: "Dispara. Gasta 1 proyectil.", en: "Fires. Uses 1 shell." } },
  ],
};

const ALL_FIRE_OPTIONS = new Map(Object.values(FIRE_OPTIONS).flat().map((each) => [each.id, each]));

export const fireOptionById = (id: string): FireOption | undefined => ALL_FIRE_OPTIONS.get(id);

/**
 * The actions a plain move turns into, in the order they're tried (cheapest first): the move a
 * unit is given with no action named (`GameSession.issueOrder`, the computer). A hold is
 * Firefight; a move of 1 hex, Move Out, which fires; of 2, Move Out, which doesn't; a longer
 * one, Motorized (Reposition for artillery). Infantry Assault, which costs morale, only when it's
 * picked
 */
export const PLAIN_ACTIONS: Record<UnitType, readonly string[]> = {
  [UnitType.INFANTRY]: ["infantry:firefight", "infantry:moveOut", "infantry:motorized"],
  [UnitType.TANK]: ["tank:firefight", "tank:assault"],
  [UnitType.ARTILLERY]: ["artillery:firefight", "artillery:reposition"],
};
