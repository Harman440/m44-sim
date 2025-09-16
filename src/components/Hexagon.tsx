import { useState } from 'react';

import './Hexagon.css';
import { Position } from '../types/scenario';
import Hex from '../game-core/hex';
import UnitComponent from './UnitComponent';

interface HexProps {
  x: number;
  y: number;
  position: Position;
  onClick: (position: Position) => void;
  isSelectedUnit: boolean;
  isPossibleMove: boolean;
  isPossibleMoveFirePos: boolean;
  hexSize?: number;
  showCoordinates?: boolean;
  hexData: Hex;
  faction: string;
}

function Hexagon({ 
  x, 
  y, 
  position,
  onClick,
  isSelectedUnit,
  isPossibleMove,
  isPossibleMoveFirePos,
  hexSize = 25,
  showCoordinates = true,
  hexData,
  faction
}: HexProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Create hexagon path with 90-degree rotation (flat top)
  const points: number[][] = [];
  for (let i = 0; i < 6; i++) {
    // Add π/2 (90 degrees) to rotate the hexagon
    const angle = (i * Math.PI) / 3 + Math.PI / 2;
    points.push([
      x + hexSize * Math.cos(angle),
      y + hexSize * Math.sin(angle)
    ]);
  }
  
  const pathData = `M ${points[0]![0]},${points[0]![1]} ` + // the `!` is safe because loop guarantees 6 points
    points.slice(1).map(p => `L ${p[0]},${p[1]}`).join(' ') + ' Z';

  const handleClick = () => {
    onClick(position);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  //TODO: simplify naming scheme
  const getTileClass = () => {
    if (isSelectedUnit) return 'hexagon__tile hexagon__tile--selected hexagon__tile-stroke';
    if (isPossibleMoveFirePos) return 'hexagon__tile hexagon__tile--highlighted-red hexagon__tile-stroke';//NOTE: Move and Fire has priority over move
    if (isPossibleMove) return 'hexagon__tile hexagon__tile--highlighted hexagon__tile-stroke';
    if (isHovered) return 'hexagon__tile hexagon__tile--hover hexagon__tile-stroke';
    return 'hexagon__tile hexagon__tile--default hexagon__tile-stroke';
  };

  //TODO: it is not reading colors from nor from css
  const getTileColor = () => {
    if (hexData) {
      return hexData.color;
    }
    if (isSelectedUnit) return '#d94adeff';
    if (isPossibleMove) return '#1565d4ff';
    if (isPossibleMoveFirePos) return '#de4a7b';
    if (isHovered) return '#4b5563';
    return '#374151';
  };

  return (
    <g 
      className="hexagon"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <path
        d={pathData}
        className={getTileClass()}
        style={{ fill: getTileColor() }}//TODO: Move get color to css
      />
      {showCoordinates && (
        <text
          x={x}
          y={y + 4}
          className="hexagon__coordinates"
        >
          {hexData ? hexData.name[0] : `${position.row},${position.col}`}
        </text>
      )}
      {hexData && hexData.hasUnit() && (
      <UnitComponent
        x={x}
        y={y - 8}
        faction={faction}
        unitData={hexData.getUnit()!} //TODO: handle null
      />
      )}
    </g>
  );
};

export default Hexagon;