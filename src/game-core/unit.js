// game-core/unit.js

const UNIT_STATS = {
    infantry: {
        maxMove: 2,
        moveAndFire: 1,
    },
    tank: {
        maxMove: 3,
        moveAndFire: 3,
    },
    artillery: {
        maxMove: 1,
        moveAndFire: 0, // can't move and fire
    },
};

class Unit {
    constructor(row, col, unitType = 'infantry') {
        if (!UNIT_STATS[unitType]) {
            throw new Error(`Invalid unit type: ${unitType}`);
        }

        this.unitType = unitType;
        this.maxMove = UNIT_STATS[unitType].maxMove;
        this.moveAndFire = UNIT_STATS[unitType].moveAndFire;

        this.row = row;
        this.col = col;

        this.hasOrder = false;
    }
}

export default Unit;