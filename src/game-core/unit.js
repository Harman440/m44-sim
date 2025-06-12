// game-core/unit.js

const UNIT_STATS = {
    infantry: {
        maxMove: 2,
        moveAndFire: 1,
        range: 3,
    },
    tank: {
        maxMove: 3,
        moveAndFire: 3,
        range: 3,
    },
    artillery: {
        maxMove: 1,
        moveAndFire: 0, // can't move and fire
        range: 6,
    },
};

class Unit {
    constructor(unitType) {
        if (!UNIT_STATS[unitType]) {
            throw new Error(`Invalid unit type: ${unitType}`);
        }

        this.unitType = unitType;
        this.maxMove = UNIT_STATS[unitType].maxMove;
        this.moveAndFire = UNIT_STATS[unitType].moveAndFire;
        this.range = UNIT_STATS[unitType].range;

        this.position = null;
        this.hasOrder = false;
        this.canFire = false;
        this.health = 1;
    }
}

export default Unit;