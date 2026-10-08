// labels/es.ts
// Spanish UI text for game enums
import { UnitType } from "../game-core/unit";
import { DieFace, DieKind, SIX_SIDED_FACES, countFaces } from "../game-core/dice";
import { HexType, Side } from "../types/hex";
import { appliedFaces } from "../game-core/rollResult";
import type { Labels } from ".";

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
};

const SECTIONS: Labels["sections"] = {
  [Side.LEFT]: "flanco izquierdo",
  [Side.LEFT_CENTER]: "entre izquierda y centro",
  [Side.CENTER]: "centro",
  [Side.RIGHT_CENTER]: "entre centro y derecha",
  [Side.RIGHT]: "flanco derecho",
};

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

const es: Labels = {
  factions: { Allies: "Aliados", Axis: "Eje" },
  units: UNITS,
  terrain: TERRAIN,
  sections: SECTIONS,
  sectionsShort: {
    [Side.LEFT]: "Izquierda",
    [Side.LEFT_CENTER]: "Izq.–centro",
    [Side.CENTER]: "Centro",
    [Side.RIGHT_CENTER]: "Centro–dcha.",
    [Side.RIGHT]: "Derecha",
  },
  dieFaces: DIE_FACES,
  combatPhases: {
    order: "Con las órdenes",
    battle: "En la batalla",
  },
  deckReasons: {
    shared: "Para todos",
    attacker: "Ataca",
    defender: "Defiende",
    tanks: "Blindados",
    artillery: "Artillería",
    enemyTanks: "Blindados enemigos",
    towns: "Combate urbano",
    bigGuns: "Artillería pesada",
    air: "Aviación",
  },
  target,
  describePlace: (hex) => (hex ? `${TERRAIN[hex.getType()]}, ${SECTIONS[hex.getSide()]}` : "fuera del mapa"),
  unit,
  unitKind,
  describeHex: (hex) => {
    const extras = [hex.wire && "alambrada", hex.sandbags && "sacos terreros"].filter(Boolean).join(" y ");
    const terrain = TERRAIN[hex.getType()] + (extras ? ` con ${extras}` : "");
    return hex.unit ? `${unit(hex.unit)} en ${terrain}` : terrain;
  },
  describeMovement: ({ maxMove, moveAndFire, holdShots }) => {
    if (maxMove === 0) return "No puede moverse con esta carta";
    if (holdShots === 0) return `Mueve hasta ${hexes(maxMove)}; no puede disparar`;
    const fire =
      moveAndFire === 0 ? "si se mueve no puede disparar" : `puede disparar si mueve hasta ${hexes(moveAndFire)}`;
    return `Mueve hasta ${hexes(maxMove)}; ${fire}`;
  },
  describeFaces,
  describeReinforcements: (table) =>
    SIX_SIDED_FACES.map((face) => {
      const unit = table[face];
      return `${DIE_FACES[face]} → ${unit ? UNITS[unit].toLowerCase() : "sin refuerzos"}`;
    }).join(" · "),
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
      case "extraOrder":
        return `Orden extra: ${UNITS[entry.unit].toLowerCase()}`;
      case "cardOrder":
        return `Orden de la carta: ${UNITS[entry.unit].toLowerCase()}`;
      case "supplies":
        return `Suministros: ${UNITS[entry.unit].toLowerCase()}`;
      case "endOfTurn":
        return "Fase final: suministros";
      case "cardReward":
        return "Fase final: recompensa de la carta";
      case "combatCard":
        return `Carta de combate: ${entry.card.es}`;
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
