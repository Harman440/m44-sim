// labels/es.ts
// Spanish UI text for game enums
import { UnitType } from "../game-core/unit";
import { DieFace, DieKind, countFaces } from "../game-core/dice";
import { HexType } from "../types/hex";
import { appliedFaces } from "../game-core/rollResult";
import type { Labels } from ".";
import { EQUIPMENT, Equipment, SUPPLIES, Supply } from "../data/unitSupplies";

const UNITS: Labels["units"] = {
  [UnitType.INFANTRY]: "Infantería",
  [UnitType.TANK]: "Tanque",
  [UnitType.ARTILLERY]: "Artillería",
};

const TERRAIN: Labels["terrain"] = {
  [HexType.PLAINS]: "llanura",
  [HexType.FOREST]: "bosque",
  [HexType.HILL]: "colina",
  [HexType.TOWN]: "pueblo",
  [HexType.HEDGEROW]: "seto",
  [HexType.RIVER]: "río",
  [HexType.BRIDGE]: "puente",
  [HexType.LAKE]: "lago",
  [HexType.BEACH]: "playa",
  [HexType.SWAMP]: "pantano",
  [HexType.OCEAN]: "océano",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const DIE_FACES: Labels["dieFaces"] = {
  [DieFace.INFANTRY]: "Infantería",
  [DieFace.TANK]: "Tanque",
  [DieFace.GRENADE]: "Granada",
  [DieFace.SUPPLY]: "Suministro",
  [DieFace.FLAG]: "Bandera",
};

const DIE_NOTES: Record<DieKind, string> = {
  battle: "",
  longRange: " · dado de 8 caras",
  attack: " · dado de ataque",
  suppressive: " · dado de supresión",
  longRangeSuppressive: " · dado de 8 caras de supresión",
};

const SUPPLY_NAMES: Labels["supplies"] = {
  [Supply.MORALE]: "Moral",
  [Supply.ENERGY]: "Energía",
  [Supply.AMMO]: "Munición",
  [Supply.FUEL]: "Combustible",
  [Supply.SHELLS]: "Proyectiles",
};

const EQUIPMENT_NAMES: Labels["equipment"] = {
  [Equipment.EXPLOSIVES]: "Explosivos",
  [Equipment.SANDBAGS]: "Sacos terreros",
  [Equipment.MEDIC_KIT]: "Botiquín",
  [Equipment.CAMOUFLAGE_NET]: "Red de camuflaje",
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hexes = (n: number) => count(n, "casilla", "casillas");
const coins = (n: number) => count(n, "suministro", "suministros");
const target = (infantry: boolean) => (infantry ? "Infantería" : "Blindados o artillería");

const describeFaces: Labels["describeFaces"] = (faces) => {
  const counts = countFaces(faces);
  const parts = Object.values(DieFace)
    .filter((face) => counts[face] > 0)
    .map((face) => `${counts[face]} × ${DIE_FACES[face]}`);
  return parts.length > 0 ? parts.join(" · ") : "sin efecto";
};

const unitKind: Labels["unitKind"] = (type, elite = false) => UNITS[type] + (elite ? " de élite" : "");

const unit: Labels["unit"] = (unit) => unitKind(unit.getUnitType(), unit.elite);

/** A supply counted one, where it differs from its name */
const ONE_SUPPLY: Partial<Record<Supply, string>> = { [Supply.SHELLS]: "proyectil" };

const describeCost: Labels["describeCost"] = (cost) =>
  [
    ...SUPPLIES.flatMap((supply) => {
      const amount = cost.amounts?.[supply];
      return amount ? [`${amount} ${amount === 1 ? (ONE_SUPPLY[supply] ?? SUPPLY_NAMES[supply].toLowerCase()) : SUPPLY_NAMES[supply].toLowerCase()}`] : [];
    }),
    ...(cost.equipment ?? []).map((kind) => EQUIPMENT_NAMES[kind].toLowerCase()),
  ].join(" + ") || "gratis";

const describeSupplies: Labels["describeSupplies"] = (supplies) =>
  [
    ...SUPPLIES.flatMap((supply) => (supplies.amounts[supply] === undefined ? [] : [`${SUPPLY_NAMES[supply]} ${supplies.amounts[supply]}`])),
    ...EQUIPMENT.flatMap((kind) => (supplies.equipment[kind] === undefined ? [] : [`${EQUIPMENT_NAMES[kind]} ${supplies.equipment[kind]}`])),
  ].join(" · ");

const es: Labels = {
  factions: { Allies: "Aliados", Axis: "Eje" },
  units: UNITS,
  terrain: TERRAIN,
  dieFaces: DIE_FACES,
  target,
  describePlace: (hex) => (hex ? capitalize(TERRAIN[hex.getType()]) : "fuera del mapa"),
  unit,
  unitKind,
  describeHex: (hex) => {
    const extras = [hex.wire && "alambrada", hex.sandbags && "sacos terreros"].filter(Boolean).join(" y ");
    const terrain = TERRAIN[hex.getType()] + (extras ? ` con ${extras}` : "");
    return hex.unit ? `${unit(hex.unit)} en ${terrain}` : terrain;
  },
  describeMovement: ({ maxMove, moveAndFire, holdShots }) => {
    if (maxMove === 0) return holdShots === 0 ? "No se mueve ni dispara" : "No se mueve; dispara";
    if (holdShots === 0) return `Mueve hasta ${hexes(maxMove)}; no puede disparar`;
    const fire =
      moveAndFire === 0 ? "si se mueve no puede disparar" : `puede disparar si mueve hasta ${hexes(moveAndFire)}`;
    return `Mueve hasta ${hexes(maxMove)}; ${fire}`;
  },
  supplies: SUPPLY_NAMES,
  equipment: EQUIPMENT_NAMES,
  describeSupplies,
  describeCost,
  actionRefusals: {
    [Supply.MORALE]: "Moral 0",
    [Supply.ENERGY]: "Sin energía",
    [Supply.AMMO]: "Sin munición",
    [Supply.FUEL]: "Sin combustible",
    [Supply.SHELLS]: "Sin proyectiles",
    equipment: "Sin equipo",
    unitType: "No es de esta unidad",
    ownTablets: "No en tablets propias",
    nothingToMend: "Nada que reparar",
    notNeeded: "No hace falta",
    noPartner: "Nadie con quien reagruparse",
  },
  describeFaces,
  describeAppliedFaces: (faces, kept) =>
    kept === null
      ? describeFaces(faces)
      : `${describeFaces(appliedFaces(faces, kept))} (aplica ${kept.length} de ${faces.length})`,
  describeTarget: ({ infantry, closeAssault, die }) =>
    `Contra ${target(infantry).toLowerCase()} · ${closeAssault ? "asalto cercano" : "a distancia"}${DIE_NOTES[die]}`,
  describeRoll: ({ hits, retreats, coins: earned }, withCoins = true) =>
    [
      count(hits, "impacto", "impactos"),
      count(retreats, "retirada", "retiradas"),
      ...(withCoins && earned > 0 ? [`+${coins(earned)}`] : []),
    ].join(" · "),
  coins,
  hexes,
  describeCoinEntry: (entry) => {
    switch (entry.kind) {
      case "supplies":
        return `Suministros: ${UNITS[entry.unit].toLowerCase()}`;
      case "card":
        return `Carta: ${entry.card.es}`;
      case "adjustment":
        return entry.amount < 0 ? "Pago a mano" : "Ingreso a mano";
    }
  },
  describeMarkerRule: ({ kind, count, chain, awayFromOwnUnits }) => {
    if (kind === "cross") return "Marca con una cruz la casilla libre donde aparece la unidad.";
    if (chain) return `Marca ${hexes(count)} en cadena: cada una junto a la anterior.`;
    if (awayFromOwnUnits) return `Marca ${hexes(count)} que no estén en tus unidades ni junto a ellas.`;
    return `Marca ${hexes(count)} sin unidades tuyas.`;
  },
};

export default es;
