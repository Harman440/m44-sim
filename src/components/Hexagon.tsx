import './Hexagon.css';
import { Position } from '../types/scenario';
import Hex from '../game-core/hex';
import { positionKey } from '../game-core/position';
import { BarbedWireArt } from './BarbedWire';

/** How a hex is highlighted: the selected unit, a destination for it, or a hex it can fire at */
export type HexHighlight = 'selected' | 'move-and-fire' | 'move' | 'mark' | 'target' | 'target-selected' | null;

interface HexProps {
  x: number;
  y: number;
  position: Position;
  onClick: (position: Position) => void;
  highlight: HexHighlight;
  /** Set to flash the hex red; a new value restarts the flash */
  invalidFlashId?: number | null;
  hexSize?: number;
  hexData: Hex;
}

function Hexagon({
  x,
  y,
  position,
  onClick,
  highlight,
  invalidFlashId = null,
  hexSize = 25,
  hexData
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
      {hexData.wire && <BarbedWireArt x={x} y={y} hexSize={hexSize} underUnit={hexData.unit !== null} />}
      {/* Keyed so each new flash remounts the path and replays the animation */}
      {invalidFlashId !== null && (
        <path key={invalidFlashId} d={pathData} className="hexagon__flash-invalid" />
      )}
    </g>
  );
};

export default Hexagon;
