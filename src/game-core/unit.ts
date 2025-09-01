// game-core/unit.js

// Define valid unit types as a union
export type UnitType = "infantry" | "tank" | "artillery";

// Map unit stats
const UNIT_STATS: Record<UnitType, { maxMove: number; moveAndFire: number }> = {
  infantry: { maxMove: 2, moveAndFire: 1 },
  tank: { maxMove: 3, moveAndFire: 3 },
  artillery: { maxMove: 1, moveAndFire: 0 }, // can't move and fire
};

class Unit {
  private static counter = 1;
  id: string;
  unitType: UnitType;
  maxMove: number;
  moveAndFire: number;
  hasOrder: boolean;

  constructor(unitType: UnitType = "infantry") {
    const stats = UNIT_STATS[unitType];
    this.id = `unit-${Unit.counter++}`;
    this.unitType = unitType;
    this.maxMove = stats.maxMove;
    this.moveAndFire = stats.moveAndFire;
    this.hasOrder = false;
  }
}

export default Unit;