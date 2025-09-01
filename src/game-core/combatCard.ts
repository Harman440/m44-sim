// game-core/combatCard.js

import { UnitType } from "./unit";

class CombatCard {
    unitType: UnitType | null;

    constructor(unitType: UnitType | null = null) {
        this.unitType = unitType;
    }
    
}