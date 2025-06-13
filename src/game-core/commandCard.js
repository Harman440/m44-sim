// game-core/commandCard.js

class CommandCard {
    constructor({
        id,
        name,
        description = '',
        maxTotalOrders = 0,
        maxOrdersLeftSection = 0,
        maxOrdersCenterSection = 0,
        maxOrdersRightSection = 0,
        unitType = null,                    // "infantry", "tank", "artillery", or null for all
        numOntheMove = 0,                  // Units that can move and shoot
        closeAssaultAdditionalDice = 0,    // Bonus dice for close combat
        rangeAdditionalDice = 0,           // Bonus dice at range
        numFireTimes = 1,                  // Number of times a unit can fire
        extraMovement = 0,                 // Extra movement points
        extraPickUpCards = 0,              // Additional cards player can pick
        unitCosts = {},                    // e.g. { infantry: 1, tank: 2 }
        receiveCombatCoins = 0             // How many coins earned from playing it
        // TODO: Handle Infantry Assault (choose section on play)
    }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.maxTotalOrders = maxTotalOrders;
        this.maxOrdersLeftSection = maxOrdersLeftSection;
        this.maxOrdersCenterSection = maxOrdersCenterSection;
        this.maxOrdersRightSection = maxOrdersRightSection;
        this.unitType = unitType;
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
