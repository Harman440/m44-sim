// game-core/commandCard.js
export enum CommandCardType {LEFT = "left", CENTER = "center", RIGHT = "right", ALLSIDES = "all-sides", INFANTRY = "infantry", TANK = "tank", ARTILLERY = "artillery", ALL = "all" };

type CommandCardProps = {
  id?: string;
  name?: string;
  type?: CommandCardType;
  description?: string;
  maxTotalOrders?: number;
  numOntheMove?: number;
  closeAssaultAdditionalDice?: number;
  rangeAdditionalDice?: number;
  numFireTimes?: number;
  extraMovement?: number;
  extraPickUpCards?: number;
  unitCosts?: Record<string, number>;
  receiveCombatCoins?: number;
};

class CommandCard {
    private static counter = 1;
    id: string;
    type: CommandCardType;
    name: string;
    description: string;
    maxTotalOrders: number;
    numOntheMove: number;
    closeAssaultAdditionalDice: number;
    rangeAdditionalDice: number;
    numFireTimes: number;
    extraMovement: number;
    extraPickUpCards: number;
    unitCosts: object;
    receiveCombatCoins: number;
    constructor({
        id = `command-card-${CommandCard.counter++}`,
        name = '',
        type = CommandCardType.ALL,
        description = '',
        maxTotalOrders = 0,
        numOntheMove = 0,                  // Units that can move and shoot
        closeAssaultAdditionalDice = 0,    // Bonus dice for close combat
        rangeAdditionalDice = 0,           // Bonus dice at range
        numFireTimes = 1,                  // Number of times a unit can fire
        extraMovement = 0,                 // Extra movement points
        extraPickUpCards = 0,              // Additional cards player can pick
        unitCosts = {},                    // e.g. { infantry: 1, tank: 2 }
        receiveCombatCoins = 0             // How many coins earned from playing it
        // TODO: Handle Infantry Assault (choose section on play)
    }: CommandCardProps) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.description = description;
        this.maxTotalOrders = maxTotalOrders;
        this.numOntheMove = numOntheMove;
        this.closeAssaultAdditionalDice = closeAssaultAdditionalDice;
        this.rangeAdditionalDice = rangeAdditionalDice;
        this.numFireTimes = numFireTimes;
        this.extraMovement = extraMovement;
        this.extraPickUpCards = extraPickUpCards;
        this.unitCosts = unitCosts;
        this.receiveCombatCoins = receiveCombatCoins;
    }

    toString() {
        return `${this.name} — ${this.description}`;
    }
}

export default CommandCard;
