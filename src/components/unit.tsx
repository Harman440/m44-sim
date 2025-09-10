// Unit.tsx
import React from "react";
import alliedInfantry from "../assets//units/allies/infantry.png";
import axisInfantry from "../assets//units/axis/infantry.png";

interface UnitProps {
  x: number;
  y: number;
  faction: string;
  type?: string; //TODO: render different unit types if undefined render default
}

const Unit: React.FC<UnitProps> = ({ x, y, faction }) => {
  const size = 48;
  const yOffset = -2;
  const xOffset = -4;
  return (
    <image
      href={faction === "Allies" ? alliedInfantry : axisInfantry}
      x={x - size / 2 - xOffset} // center the image on (x, y)
      y={y - size / 2 - yOffset}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
    />
  );
};

export default Unit;
