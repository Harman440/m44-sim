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
  return (
    <image
      href={faction === "Allies" ? alliedInfantry : axisInfantry}
      x={x - 24 / 2} // center the image on (x, y)
      y={y - 24 / 2}
      width={24}
      height={24}
      preserveAspectRatio="xMidYMid meet"
    />
  );
};

export default Unit;
