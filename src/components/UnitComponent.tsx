// Unit.tsx
import React from "react";
import alliedInfantry from "../assets/units/allies/infantry.png";
import alliedTank from "../assets/units/allies/tank.svg";
import alliedArtillery from "../assets/units/allies/artillery.svg";
import axisInfantry from "../assets/units/axis/infantry.png";
import axisTank from "../assets/units/axis/tank.svg";
import axisArtillery from "../assets/units/axis/artillery.svg";
import Unit, { UnitType } from "../game-core/unit";

// Tank and artillery are placeholder SVGs; drop real art in the same folders to replace them
const SPRITES: Record<"Allies" | "Axis", Record<UnitType, string>> = {
  Allies: {
    [UnitType.INFANTRY]: alliedInfantry,
    [UnitType.TANK]: alliedTank,
    [UnitType.ARTILLERY]: alliedArtillery,
  },
  Axis: {
    [UnitType.INFANTRY]: axisInfantry,
    [UnitType.TANK]: axisTank,
    [UnitType.ARTILLERY]: axisArtillery,
  },
};

/** Sprite for a unit type; anything other than "Allies" uses the Axis art */
export const unitSprite = (faction: string, unitType: UnitType): string =>
  SPRITES[faction === "Allies" ? "Allies" : "Axis"][unitType];

interface UnitProps {
  x: number;
  y: number;
  faction: string;
  unitData?: Unit; // without data, an infantry sprite is drawn
}

const UnitComponent: React.FC<UnitProps> = ({ x, y, faction, unitData }) => {
  const size = 48;
  const yOffset = -2;
  const xOffset = -4;
  const half = size / 2;

  const unitType = unitData?.getUnitType() ?? UnitType.INFANTRY;
  const href = unitSprite(faction, unitType);

  return (
    <g>
      {/* Glow red if ready to fire */}
      {unitData?.isReadyToFire() && (
        <circle
          cx={x}
          cy={y}
          r={half}
          fill="red"
          opacity={0.3}
        />
      )}

      {/* Glow blue if orderable */}
      {unitData?.getOrderable() && (
        <circle
          cx={x}
          cy={y}
          r={half}
          fill="blue"
          opacity={0.3}
        />
      )}

      {/* Unit image */}
      <image
        href={href}
        data-unit-type={unitType}
        x={x - half - xOffset}
        y={y - half - yOffset}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        style={{ opacity: 1 }}
      />
    </g>
  );
};

export default UnitComponent;