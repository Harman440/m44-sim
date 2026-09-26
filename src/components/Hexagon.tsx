import './Hexagon.css';
import { Position } from '../types/scenario';
import { Faction } from '../types/faction';
import Hex from '../game-core/hex';
import { positionKey } from '../game-core/position';
import UnitComponent from './UnitComponent';

/** How a hex is highlighted: the selected unit, or a destination for it */
export type HexHighlight = 'selected' | 'move-and-fire' | 'move' | null;

interface HexProps {
  x: number;
  y: number;
  position: Position;
  onClick: (position: Position) => void;
  highlight: HexHighlight;
  /** The unit here has an order that lets it fire this turn */
  unitReadyToFire: boolean;
  /** Set to flash the hex red; a new value restarts the flash */
  invalidFlashId?: number | null;
  hexSize?: number;
  hexData: Hex;
  faction: Faction;
}

function Hexagon({
  x,
  y,
  position,
  onClick,
  highlight,
  unitReadyToFire,
  invalidFlashId = null,
  hexSize = 25,
  hexData,
  faction
}: HexProps) {

  // Pointy-top hexagon: corners start at 90 degrees
  const points: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + Math.PI / 2;
    points.push([
      x + hexSize * Math.cos(angle),
      y + hexSize * Math.sin(angle)
    ]);
  }

  const pathData = `M ${points[0]![0]},${points[0]![1]} ` + // the `!` is safe because loop guarantees 6 points
    points.slice(1).map(p => `L ${p[0]},${p[1]}`).join(' ') + ' Z';

  return (
    <g
      className="hexagon"
      data-position={positionKey(position)}
      onClick={() => onClick(position)}
    >
      {/* Transparent unless highlighted: the scenario art shows the terrain */}
      <path
        d={pathData}
        className={highlight ? `hexagon__tile hexagon__tile--${highlight}` : 'hexagon__tile'}
      />
      {hexData.unit && (
        <UnitComponent
          x={x}
          y={y - 8}
          faction={faction}
          unitData={hexData.unit}
          readyToFire={unitReadyToFire}
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
