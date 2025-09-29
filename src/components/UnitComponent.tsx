// Unit.tsx
import React from "react";
import alliedInfantry from "../assets/units/allies/infantry.png";
import axisInfantry from "../assets/units/axis/infantry.png";
import Unit from "../game-core/unit";

interface UnitProps {
  x: number;
  y: number;
  faction: string;
  unitData?: Unit; //TODO: render different unit types if undefined render default
}

const UnitComponent: React.FC<UnitProps> = ({ x, y, faction, unitData }) => {
  const size = 48;
  const yOffset = -2;
  const xOffset = -4;
  const half = size / 2;

  const href = faction === "Allies" ? alliedInfantry : axisInfantry;

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
        x={x - half - xOffset}
        y={y - half - yOffset}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
};

export default UnitComponent;