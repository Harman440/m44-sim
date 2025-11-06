// game-core/unit.js

// Define valid unit types as a union
export enum UnitType {INFANTRY = "infantry", TANK = "tank", ARTILLERY = "artillery"};

// Map unit stats
const UNIT_STATS: Record<UnitType, { maxMove: number; moveAndFire: number }> = {
  infantry: { maxMove: 2, moveAndFire: 1 },
  tank: { maxMove: 3, moveAndFire: 3 },
  artillery: { maxMove: 1, moveAndFire: 0 }, // can't move and fire
};

class Unit {
  private static counter = 1;

  private readonly id: string;
  private readonly unitType: UnitType;
  private readonly maxMove: number;
  private readonly moveAndFire: number;

  private orderable: boolean;
  private ordered: boolean;
  private readyToFire: boolean = false;

  constructor(unitType: UnitType = UnitType.INFANTRY) {
    const stats = UNIT_STATS[unitType];
    this.id = `unit-${Unit.counter++}`;
    this.unitType = unitType;
    this.maxMove = stats.maxMove;
    this.moveAndFire = stats.moveAndFire;
    this.ordered = false;
    this.orderable = false;
  }

  // Static controls for ID counter
  static resetCounter(): void {
    Unit.counter = 1;
  }

  static setCounter(value: number): void {
    if (value < 1) throw new Error("Counter must be >= 1");
    Unit.counter = value;
  }

  static getCounter(): number {
    return Unit.counter;
  }

  // Public getters (read-only)
  getId(): string {
    return this.id;
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

  getOrderable(): boolean {
    return this.orderable;
  }

  isOrdered(): boolean {
    return this.ordered;
  }

  isReadyToFire(): boolean {
    return this.readyToFire;
  }

  // Controlled state changes
  giveOrder(canFire: boolean): void {
    this.ordered = true;
    this.readyToFire = canFire;
    this.orderable = false;
  }

  clearOrder(): void {
    this.ordered = false;
    this.readyToFire = false;
  }

  disableFire(): void {
    this.readyToFire = false;
  }
}

export default Unit;
