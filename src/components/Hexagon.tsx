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
  /** Set to flash the hex red; a new value restarts the flash */
  invalidFlashId?: number | null;
  hexSize?: number;
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
  invalidFlashId = null,
  hexSize = 25,
  hexData,
  faction
}: HexProps) {

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

  //TODO: simplify naming scheme
  const getTileClass = () => {
    if (isSelectedUnit) return 'hexagon__tile hexagon__tile--selected';
    if (isPossibleMoveFirePos) return 'hexagon__tile hexagon__tile--move-and-fire';//NOTE: Move and Fire has priority over move
    if (isPossibleMove) return 'hexagon__tile hexagon__tile--move';
    return 'hexagon__tile';
  };

  const getTileColor = () => {
    if (hexData) {
      return hexData.getColor();
    }
    return '#374151';
  };

  return (
    <g
      className="hexagon"
      data-position={`${position.row}-${position.col}`}
      onClick={handleClick}
      style={{ fill: getTileColor() }}
    >
      <path
        d={pathData}
        className={getTileClass()}
      />
      {hexData && hexData.hasUnit() && (
        <UnitComponent
          x={x}
          y={y - 8}
          faction={faction}
          unitData={hexData.unit}
        />
      )}
      {/* Keyed so each new flash remounts the path and replays the animation */}
      {invalidFlashId !== null && (
        <path key={invalidFlashId} d={pathData} className="hexagon__flash-invalid" />
      )}
    </g>
  );
};

export default Hexagon;