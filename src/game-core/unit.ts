// game-core/unit.ts

export enum UnitType {INFANTRY = "infantry", TANK = "tank", ARTILLERY = "artillery"};

const UNIT_STATS: Record<UnitType, { maxMove: number; moveAndFire: number }> = {
  infantry: { maxMove: 2, moveAndFire: 1 },
  tank: { maxMove: 3, moveAndFire: 3 },
  artillery: { maxMove: 1, moveAndFire: 0 }, // can't move and fire
};

/**
 * A unit on the board. Whether it fires this turn belongs to its Order
 * (`Order.canFire`); the unit only tracks whether it can still be ordered.
 */
class Unit {
  private readonly unitType: UnitType;
  private readonly maxMove: number;
  private readonly moveAndFire: number;

  private orderable = false;
  private ordered = false;

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

  isOrderable(): boolean {
    return this.orderable;
  }

  setOrderable(orderable: boolean): void {
    this.orderable = orderable;
  }

  isOrdered(): boolean {
    return this.ordered;
  }

  giveOrder(): void {
    this.ordered = true;
    this.orderable = false;
  }

  clearOrder(): void {
    this.ordered = false;
  }
}

export default Unit;
