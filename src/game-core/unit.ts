// game-core/unit.ts

export enum UnitType {INFANTRY = "infantry", TANK = "tank", ARTILLERY = "artillery"};

const UNIT_STATS: Record<UnitType, { maxMove: number; moveAndFire: number; checkLineOfSight: boolean }> = {
  infantry: { maxMove: 2, moveAndFire: 1, checkLineOfSight: true },
  tank: { maxMove: 3, moveAndFire: 3, checkLineOfSight: true },
  // can't move and fire; fires over anything in between (house rule)
  artillery: { maxMove: 1, moveAndFire: 0, checkLineOfSight: false },
};

/** Whether this unit type needs line of sight to fire (artillery doesn't) */
export const checksLineOfSight = (unitType: UnitType): boolean => UNIT_STATS[unitType].checkLineOfSight;

/** A unit on the board. What it may do this turn comes from its Order and the card played. */
class Unit {
  private readonly unitType: UnitType;
  private readonly maxMove: number;
  private readonly moveAndFire: number;

  constructor(unitType: UnitType = UnitType.INFANTRY) {
    const stats = UNIT_STATS[unitType];
    this.unitType = unitType;
    this.maxMove = stats.maxMove;
    this.moveAndFire = stats.moveAndFire;
  }

  getUnitType(): UnitType {
    return this.unitType;
  }

  getMaxMove(): number {
    return this.maxMove;
  }

  getMoveAndFire(): number {
    return this.moveAndFire;
  }

  checkLineOfSight(): boolean {
    return checksLineOfSight(this.unitType);
  }
}

export default Unit;

export const isUnitType = (value: unknown): value is UnitType =>
  Object.values(UnitType).includes(value as UnitType);
