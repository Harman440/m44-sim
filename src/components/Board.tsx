import { useContext } from 'react';
import type React from 'react';
import type { ArmyView } from '../game-core/passAndPlay';
import { OpponentContext } from './OpponentContext';
import Hexagon, { HexHighlight } from './Hexagon';
import './Board.css';
import { Position } from '../types/scenario';
import { Faction } from '../types/faction';
import { includesPosition, positionKey, samePosition } from '../game-core/position';
import BoardManager, { turnedRound } from '../game-core/BoardManager';
import UnitComponent from './UnitComponent';
import { FACTION_COLORS } from '../looks/looks';
import OrderComponent from './OrderComponent';
import Order from '../game-core/order';
import { createBoardGeometry } from './boardGeometry';
import Unit from '../game-core/unit';
import type { MarkerRule } from '../game-core/combatCard';

/** A hex to flash red; a new `id` restarts the animation on the same hex */
export interface HexFlash {
  position: Position;
  id: number;
}

interface BoardProps {
  onTileClick: (position: Position) => void;
  unitHexPosition: Position | null;
  possibleMovePositions: Position[];
  possibleMoveAndFirePositions: Position[];
  boardManager: BoardManager;
  orders: readonly Order[];
  /** Scenario artwork drawn under the hexes */
  backgroundImage?: string;
  invalidFlash?: HexFlash | null;
  /** Units that have used their shots this turn */
  firedUnits?: ReadonlySet<Unit>;
  /** Units that can still be ordered, ringed */
  orderablePositions?: readonly Position[];
  /** Hexes marked for a combat card, drawn as targets or crosses */
  markers?: readonly Position[];
  markerKind?: MarkerRule['kind'];
  /** Hexes that can be marked next, highlighted */
  markablePositions?: readonly Position[];
  /** Hexes a unit can fire at, each with its dice; tapping one picks it */
  fireTargets?: readonly { position: Position; dice: number }[];
  /** The target hex picked */
  selectedTarget?: Position | null;
  /** Show only this part of the board: the view is cropped to fit these hexes */
  focus?: readonly Position[];
  hexSize?: number;
  faction: Faction;
  /**
   * The other army (pass and play), drawn turned round onto this side's view with its orders in
   * its colour; by default the game screen's (`OpponentContext`)
   */
  opponent?: ArmyView | null;
  /**
   * Collisions of the movement (pass and play), numbered: each on the hex fought over, or between
   * the two hexes of units that crossed
   */
  collisions?: readonly (readonly Position[])[];
}

function Board({
  onTileClick,
  unitHexPosition,
  possibleMovePositions,
  possibleMoveAndFirePositions,
  boardManager,
  orders,
  backgroundImage,
  invalidFlash = null,
  firedUnits,
  orderablePositions = [],
  markers = [],
  markerKind = 'target',
  markablePositions = [],
  fireTargets = [],
  selectedTarget = null,
  focus = [],
  hexSize = 50,
  faction,
  opponent: opponentProp,
  collisions = []
}: BoardProps) {
  const opponentInContext = useContext(OpponentContext);
  const opponent = opponentProp === undefined ? opponentInContext : opponentProp;
  const { width: boardWidth, height: boardHeight } = boardManager;
  const geometry = createBoardGeometry(boardWidth, boardHeight, hexSize);
  const unitsReadyToFire = new Set(orders.filter((order) => order.canFire).map((order) => order.unit));

  const highlightAt = (position: Position): HexHighlight => {
    if (unitHexPosition && samePosition(unitHexPosition, position)) return 'selected';
    if (selectedTarget && samePosition(selectedTarget, position)) return 'target-selected';
    if (fireTargets.some((target) => samePosition(target.position, position))) return 'target';
    // Move-and-fire wins over move-only: every move-and-fire hex is also a move hex
    if (includesPosition(possibleMoveAndFirePositions, position)) return 'move-and-fire';
    if (includesPosition(possibleMovePositions, position)) return 'move';
    if (includesPosition(markablePositions, position)) return 'mark';
    return null;
  };

  const renderOrders = () => {
    return orders.map((order, index) => (
      <OrderComponent
        key={index} // an order's index identifies it for the whole turn (see Order)
        orderIndex={index}
        order={order}
        getHexCenter={geometry.hexCenter}
        hexSize={hexSize}
      />
    ));
  };

  /** The other army's units and order arrows, turned round onto this side's view */
  const renderOpponent = () => {
    if (!opponent) return null;
    const center = (position: Position) => geometry.hexCenter(turnedRound(position, boardWidth, boardHeight));
    return (
      <g className="board__opponent" data-testid="opponent-army" pointerEvents="none">
        {opponent.units.map(({ position, unit }) => {
          const { x, y } = center(position);
          return <UnitComponent key={positionKey(position)} x={x} y={y} faction={opponent.faction} unitData={unit} />;
        })}
        {opponent.orders.map((order, index) => (
          <OrderComponent
            key={index}
            orderIndex={index}
            order={order}
            getHexCenter={center}
            hexSize={hexSize}
            color={FACTION_COLORS[opponent.faction]}
          />
        ))}
      </g>
    );
  };

  /** A burst with the collision's number, on its hex or on the edge between two */
  const renderCollisions = () =>
    collisions.map((hexes, i) => {
      const centers = hexes.map(geometry.hexCenter);
      const x = centers.reduce((sum, c) => sum + c.x, 0) / centers.length;
      const y = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;
      const r = hexSize * 0.42;
      const spikes = Array.from({ length: 16 }, (_, k) => {
        const radius = k % 2 === 0 ? r : r * 0.62;
        const angle = (k * Math.PI) / 8;
        return `${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`;
      }).join(' ');
      return (
        <g key={i} className="board__collision" data-testid="collision-mark" pointerEvents="none">
          <polygon points={spikes} />
          <text x={x} y={y}>{i + 1}</text>
        </g>
      );
    });

  /** A target (attack) or a cross (a unit appears), like pencil on the paper map */
  const renderMarkers = () =>
    markers.map((position, i) => {
      const { x, y } = geometry.hexCenter(position);
      const r = hexSize * 0.55;
      return (
        <g
          key={positionKey(position)}
          className={`board__marker board__marker--${markerKind}`}
          data-marker={positionKey(position)}
          pointerEvents="none"
          filter="url(#board-pencil)"
        >
          {markerKind === 'cross' ? (
            <path d={`M ${x - r} ${y - r} L ${x + r} ${y + r} M ${x + r} ${y - r} L ${x - r} ${y + r}`} />
          ) : (
            <>
              <circle cx={x} cy={y} r={r} />
              <circle cx={x} cy={y} r={r * 0.45} />
              <path d={`M ${x - r * 1.25} ${y} L ${x + r * 1.25} ${y} M ${x} ${y - r * 1.25} L ${x} ${y + r * 1.25}`} />
            </>
          )}
          {markers.length > 1 && (
            <text x={x + r * 0.9} y={y - r * 0.9} className="board__marker-number">
              {i + 1}
            </text>
          )}
        </g>
      );
    });

  /** The dice a shot at each target hex would roll, as a badge on the hex */
  const renderTargetDice = () =>
    fireTargets.map(({ position, dice }) => {
      const { x, y } = geometry.hexCenter(position);
      const picked = selectedTarget !== null && samePosition(selectedTarget, position);
      return (
        <g
          key={positionKey(position)}
          className={`board__target-dice${picked ? ' board__target-dice--picked' : ''}`}
          pointerEvents="none"
        >
          <circle cx={x} cy={y} r={hexSize * 0.36} />
          <text x={x} y={y} dominantBaseline="central" textAnchor="middle">
            {dice}
          </text>
        </g>
      );
    });

  const renderBoard = () => {
    const tiles = [];

    for (let row = 0; row < boardHeight; row++) {
      // Odd rows have one hex fewer
      const actualMaxWidth = boardWidth + (row % 2 === 1 ? -1 : 0);
      for (let col = 0; col < actualMaxWidth; col++) {
        const position: Position = { row, col };
        const { x, y } = geometry.hexCenter(position);

        const hexData = boardManager.getHex(position);
        if (!hexData) {
          throw new Error(`Hex not found at ${JSON.stringify(position)}`);
        }

        const flashesInvalid = invalidFlash !== null && samePosition(invalidFlash.position, position);

        tiles.push(
          <Hexagon
            key={positionKey(position)}
            x={x}
            y={y}
            position={position}
            onClick={onTileClick}
            highlight={highlightAt(position)}
            unitReadyToFire={hexData.unit !== null && unitsReadyToFire.has(hexData.unit)}
            unitFired={hexData.unit !== null && (firedUnits?.has(hexData.unit) ?? false)}
            unitOrderable={includesPosition(orderablePositions, position)}
            invalidFlashId={flashesInvalid ? invalidFlash.id : null}
            hexSize={hexSize}
            hexData={hexData}
            faction={faction}
          />
        );
      }
    }
    return tiles;
  };

  const { width, height, imageMargin } = geometry;
  // Crop the view to the board image: the hexes all lie inside it, so the
  // dark margin around it would only waste screen space on tablets. With
  // `focus`, crop further to those hexes (still inside the image).
  let viewX = imageMargin;
  let viewY = imageMargin;
  let viewWidth = width - 2 * imageMargin;
  let viewHeight = height - 2 * imageMargin;
  if (focus.length > 0) {
    const centers = focus.map(geometry.hexCenter);
    const halfWidth = (hexSize * Math.sqrt(3)) / 2;
    const left = Math.max(viewX, Math.min(...centers.map((c) => c.x)) - halfWidth - 4);
    const top = Math.max(viewY, Math.min(...centers.map((c) => c.y)) - hexSize - 4);
    const right = Math.min(viewX + viewWidth, Math.max(...centers.map((c) => c.x)) + halfWidth + 4);
    const bottom = Math.min(viewY + viewHeight, Math.max(...centers.map((c) => c.y)) + hexSize + 4);
    viewX = left;
    viewY = top;
    viewWidth = right - left;
    viewHeight = bottom - top;
  }

  return (
    <div className="board">
      {/* viewBox + CSS width lets the board scale down to fit tablets */}
      <svg
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
        style={{ maxWidth: focus.length > 0 ? undefined : width, '--board-aspect': viewWidth / viewHeight } as React.CSSProperties}
        className="board__svg"
      >

        <defs>
          {/* Wobble for order arrows, like grease pencil on a map */}
          <filter id="board-pencil" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
          </filter>
        </defs>

        {/* Layer 1: Scenario image */}
        {backgroundImage && (
          <image
            href={backgroundImage}
            x={imageMargin}
            y={imageMargin}
            width={width - 2 * imageMargin}
            height={height - 2 * imageMargin}
            preserveAspectRatio="xMidYMid meet"
            transform={
              faction === "Axis"
                ? `rotate(180 ${(width / 2)} ${(height / 2)})`
                : undefined
            }
          />
        )}

        {/* Layer 2: Hexagon tiles*/}
        {renderBoard()}

        {/* Layer 3: Orders, and the other army on a shared map */}
        {renderOrders()}
        {renderOpponent()}

        {/* Layer 4: Combat card markers and collisions */}
        {renderMarkers()}
        {renderCollisions()}

        {/* Layer 5: dice at each hex a unit can fire at (top layer) */}
        {renderTargetDice()}
      </svg>
    </div>
  );
};

export default Board;
