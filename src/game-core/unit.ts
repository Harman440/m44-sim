// game-core/unit.ts

export enum UnitType {INFANTRY = "infantry", TANK = "tank", ARTILLERY = "artillery"};

/** Whether this unit type needs line of sight to fire (artillery fires over anything in between, house rule) */
export const checksLineOfSight = (unitType: UnitType): boolean => unitType !== UnitType.ARTILLERY;

/** A unit on the board. How far it moves and whether it fires this turn come from its Order's action. */
class Unit {
  private readonly unitType: UnitType;
  /**
   * An elite unit (a scenario's badge: Troops 2 "Specialized Units" and "Elite Armor"). It moves
   * and fires as any unit of its type; it carries more supplies (data/unitSupplies.ts)
   */
  readonly elite: boolean;

  constructor(unitType: UnitType = UnitType.INFANTRY, elite = false) {
    this.unitType = unitType;
    this.elite = elite;
  }

  getUnitType(): UnitType {
    return this.unitType;
  }

  checkLineOfSight(): boolean {
    return checksLineOfSight(this.unitType);
  }
}

export default Unit;

export const isUnitType = (value: unknown): value is UnitType =>
  Object.values(UnitType).includes(value as UnitType);
