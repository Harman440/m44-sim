// game-core/commandCard.ts
export enum CommandCardType {LEFT = "left", CENTER = "center", RIGHT = "right", ALLSIDES = "all-sides", INFANTRY = "infantry", TANK = "tank", ARTILLERY = "artillery", ALL = "all" };

type CommandCardProps = {
  id?: string;
  name?: string;
  type?: CommandCardType;
  description?: string;
  maxTotalOrders?: number;
  closeAssaultAdditionalDice?: number;
  rangeAdditionalDice?: number;
  numFireTimes?: number;
  extraPickUpCards?: number;
};

class CommandCard {
    private static counter = 1;
    id: string;
    type: CommandCardType;
    name: string;
    description: string;
    maxTotalOrders: number;
    closeAssaultAdditionalDice: number;
    rangeAdditionalDice: number;
    numFireTimes: number;
    extraPickUpCards: number;
    constructor({
        id = `command-card-${CommandCard.counter++}`,
        name = '',
        type = CommandCardType.ALL,
        description = '',
        maxTotalOrders = 0,
        closeAssaultAdditionalDice = 0,    // Bonus dice when firing at an adjacent hex
        rangeAdditionalDice = 0,           // Bonus dice when firing at range
        numFireTimes = 1,                  // Times each ordered unit may fire this turn
        extraPickUpCards = 0,              // For the planned draw-2-keep-1 special cards
    }: CommandCardProps) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.description = description;
        this.maxTotalOrders = maxTotalOrders;
        this.closeAssaultAdditionalDice = closeAssaultAdditionalDice;
        this.rangeAdditionalDice = rangeAdditionalDice;
        this.numFireTimes = numFireTimes;
        this.extraPickUpCards = extraPickUpCards;
    }
}

export default CommandCard;
