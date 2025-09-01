import { useState } from 'react';

import './Hexagon.css';

const Hexagon = ({ 
  x, 
  y, 
  row, 
  col, 
  onClick, 
  isSelected, 
  hexSize = 25,
  showCoordinates = true,
  hexData = null // Hex class instance
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Create hexagon path with 90-degree rotation (flat top)
  const points = [];
  for (let i = 0; i < 6; i++) {
    // Add π/2 (90 degrees) to rotate the hexagon
    const angle = (i * Math.PI) / 3 + Math.PI / 2;
    points.push([
      x + hexSize * Math.cos(angle),
      y + hexSize * Math.sin(angle)
    ]);
  }
  
  const pathData = `M ${points[0][0]},${points[0][1]} ` +
    points.slice(1).map(p => `L ${p[0]},${p[1]}`).join(' ') + ' Z';

  const handleClick = () => {
    onClick(row, col);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const getTileClass = () => {
    if (isSelected) return 'hexagon__tile hexagon__tile--selected hexagon__tile-stroke';
    if (isHovered) return 'hexagon__tile hexagon__tile--hover hexagon__tile-stroke';
    return 'hexagon__tile hexagon__tile--default hexagon__tile-stroke';
  };

  const getTileColor = () => {
    if (hexData) {
      return hexData.color;
    }
    if (isSelected) return '#4ade80';
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
          {hexData ? hexData.name[0] : `${row},${col}`}
        </text>
      )}
      {hexData && hexData.hasUnit() && (//TODO: create Unit Component
        <circle
          cx={x}
          cy={y - 8}
          r="4"
          fill="#ff6b6b"
          stroke="#fff"
          strokeWidth="1"
        />
      )}
    </g>
  );
};

export default Hexagon;