import { useContext, useEffect, useRef } from 'react';
import { IconButton } from '@mui/material';
import type React from 'react';
import type { ArmyView } from '../game-core/passAndPlay';
import type { UnitStrength } from '../game-core/gameSession';
import { OpponentContext, ViewSideContext, type BoardFog } from './OpponentContext';
import { VictoryContext } from './VictoryContext';
import { iconUrl } from './GameIcon';
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
import type { MarkerRule } from '../game-core/actionCard';
import { SandbagsArt } from './SandbagsIcon';
import { CamouflageBadge } from './CamouflageIcon';
import { useBoardZoom } from './boardZoom';
import { defineMessages, useMessages } from '../i18n/useI18n';

const TEXT = defineMessages({
  es: {
    zoomIn: 'Acercar el mapa',
    zoomOut: 'Alejar el mapa',
    fit: 'Ver el mapa entero',
  },
  en: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Show the whole map',
  },
});

/** Hexes to flash red; a new `id` restarts the animation on the same hexes */
export interface HexFlash {
  positions: readonly Position[];
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
  /** Hexes marked for the combat cards, drawn as targets or crosses */
  markers?: readonly Position[];
  /** How the marks are drawn: one kind for all, or each mark's kind (two cards can mark hexes) */
  markerKind?: MarkerRule['kind'] | readonly MarkerRule['kind'][];
  /** Hexes that can be marked next, highlighted */
  markablePositions?: readonly Position[];
  /** The combat cards given to units this turn (Explosives…): a small card badge on each unit */
  cardBadges?: readonly { position: Position | null }[];
  /** Units with the camouflage badge (the Camouflage card): only a close assault can hit them */
  camouflaged?: readonly Position[];
  /** Hexes a unit can fire at, each with its dice; tapping one picks it */
  fireTargets?: readonly { position: Position; dice: number }[];
  /** The target hex picked */
  selectedTarget?: Position | null;
  /** Show only this part of the board: the view is cropped to fit these hexes */
  focus?: readonly Position[];
  hexSize?: number;
  faction: Faction;
  /** The side of the unit on a hex, when the board shows both sides' units (the map editor) */
  unitFactionAt?: (position: Position) => Faction;
  /**
   * The other army (pass and play), drawn turned round onto this side's view with its orders in
   * its colour; by default the game screen's (`OpponentContext`)
   */
  opponent?: ArmyView | null;
  /**
   * Pass and play: fog of war, the hexes darkened and this side's units left off; by default the
   * game screen's
   */
  fog?: BoardFog | null;
  /** Pass and play: this side's units' figures and retreats; by default the game screen's */
  strength?: readonly UnitStrength[] | null;
  /**
   * Collisions of the movement (pass and play), numbered: each on the hex fought over, or between
   * the two hexes of units that crossed
   */
  collisions?: readonly (readonly Position[])[];
  /**
   * Draw the ordered units (this side's and the other army's) on the hex their order starts
   * from: the reveal before the armies move. Taken off, they glide to where they stand
   */
  atStart?: boolean;
  /**
   * The player can zoom and pan: pinch, the mouse wheel and the +/− buttons
   * zoom, a drag pans once zoomed in (a drag is never a tap on a hex)
   */
  zoomable?: boolean;
  /**
   * Zoom a little onto this hex (a unit picked from a list); a new `request` zooms again, even to
   * the same hex. Needs `zoomable`
   */
  zoomOn?: { position: Position; request: number } | null;
}

/** A unit drawn on the map, where it stands in its own side's view */
interface PlacedToken {
  unit: Unit;
  faction: Faction;
  position: Position;
  /** Its position is in the other army's view (turned round onto this board) */
  other: boolean;
  readyToFire?: boolean;
  fired?: boolean;
  orderable?: boolean;
  figures?: number;
  pinned?: boolean;
  retreats?: number;
  damaged?: boolean;
  hitThisTurn?: number;
}

/** A stable key per unit, so its token is the same element wherever it moves and can glide there */
const unitKeys = new WeakMap<Unit, number>();
let nextUnitKey = 1;
const unitKey = (unit: Unit): number => {
  let key = unitKeys.get(unit);
  if (key === undefined) {
    key = nextUnitKey++;
    unitKeys.set(unit, key);
  }
  return key;
};

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
  cardBadges = [],
  camouflaged = [],
  fireTargets = [],
  selectedTarget = null,
  focus = [],
  hexSize = 50,
  faction,
  unitFactionAt,
  opponent: opponentProp,
  fog: fogProp,
  strength: strengthProp,
  collisions = [],
  atStart = false,
  zoomable = false,
  zoomOn = null
}: BoardProps) {
  const t = useMessages(TEXT);
  const shared = useContext(OpponentContext);
  const victory = useContext(VictoryContext);
  /** Each unit's hits this turn when this map last drew it, and the count it last shook at (renderUnits) */
  const seenHits = useRef(new WeakMap<Unit, number>());
  const shookAt = useRef(new WeakMap<Unit, number>());
  const opponent = opponentProp === undefined ? (shared?.opponent ?? null) : opponentProp;
  const fog = fogProp === undefined ? (shared?.fog ?? null) : fogProp;
  const hiddenAt = (position: Position) => !!fog && includesPosition(fog.hidden, position);
  // No unit is shown on a dark hex, so neither is its badge
  const badgeHidden = (position: Position) => hiddenAt(position) || (!!fog && includesPosition(fog.dark, position));
  const hiddenUnits = new Set(fog?.hidden.flatMap((position) => boardManager.getHex(position)?.unit ?? []) ?? []);
  const strength = new Map(
    (strengthProp === undefined ? (shared?.strength ?? []) : (strengthProp ?? [])).map((s) => [positionKey(s.position), s])
  );
  const { width: boardWidth, height: boardHeight } = boardManager;
  const grid = createBoardGeometry(boardWidth, boardHeight, hexSize);
  // Pass and play: the map is seen from the main side, so the other side's board is drawn turned
  // round; positions stay in this board's own view (taps, targets, orders)
  const viewSide = useContext(ViewSideContext) ?? faction;
  const turned = viewSide !== faction;
  const geometry = turned
    ? { ...grid, hexCenter: (position: Position) => grid.hexCenter(turnedRound(position, boardManager.size)) }
    : grid;
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
    return orders.map((order, index) => hiddenUnits.has(order.unit) ? null : (
      <OrderComponent
        key={index} // an order's index identifies it for the whole turn (see Order)
        orderIndex={index}
        order={order}
        getHexCenter={geometry.hexCenter}
        hexSize={hexSize}
      />
    ));
  };

  /** The other army's order arrows, turned round onto this side's view */
  const renderOpponent = () => {
    if (!opponent) return null;
    const center = (position: Position) => geometry.hexCenter(turnedRound(position, boardManager.size));
    return (
      <g className="board__opponent" data-testid="opponent-army" pointerEvents="none">
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
        {(opponent.camouflaged ?? []).map((position) => {
          const { x, y } = center(position);
          return (
            <g key={positionKey(position)} data-camouflage={`opponent-${positionKey(position)}`}>
              <CamouflageBadge x={x + hexSize * 0.64} y={y} r={hexSize * 0.2} />
            </g>
          );
        })}
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
  /**
   * Pass and play: the objective hexes, a medal in the colour of the side that scores each, solid
   * while that side holds it (at the end of the last turn). Their positions are in the Allies' view
   */
  const renderObjectives = () => {
    const objectives = victory?.objectives ?? [];
    // A hex that's both sides' objective has both medals, side by side
    const shared = (hex: Position) => new Set(objectives.filter((o) => includesPosition(o.hexes, hex)).map((o) => o.faction)).size > 1;
    return objectives.flatMap((objective) =>
      objective.hexes.map((hex) => {
        const position = faction === 'Axis' ? turnedRound(hex, boardManager.size) : hex;
        const { x, y } = geometry.hexCenter(position);
        // At the top of the hex, over the edge of a unit's token
        const r = hexSize * 0.3;
        const offset = shared(hex) ? (objective.faction === viewSide ? -1 : 1) * r * 1.1 : 0;
        const cx = x + offset;
        const cy = y - hexSize * 0.66;
        const held = includesPosition(victory!.held[objective.faction], hex);
        const id = `objective-${objective.faction}-${positionKey(hex)}`;
        return (
          <g
            key={id}
            className={`board__objective${held ? ' board__objective--held' : ''}`}
            data-objective={positionKey(position)}
            data-objective-side={objective.faction}
            pointerEvents="none"
          >
            <circle cx={cx} cy={cy} r={r} fill={FACTION_COLORS[objective.faction]} />
            <mask id={id} style={{ maskType: 'alpha' }}>
              <image href={iconUrl('medal')} x={cx - r * 0.75} y={cy - r * 0.75} width={r * 1.5} height={r * 1.5} />
            </mask>
            <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} mask={`url(#${id})`} className="board__objective-medal" />
          </g>
        );
      })
    );
  };

  const renderMarkers = () =>
    markers.map((position, i) => {
      const { x, y } = geometry.hexCenter(position);
      const r = hexSize * 0.55;
      const kind = typeof markerKind === 'string' ? markerKind : (markerKind[i] ?? 'target');
      return (
        <g
          key={`${i}-${positionKey(position)}`}
          className={`board__marker board__marker--${kind}`}
          data-marker={positionKey(position)}
          pointerEvents="none"
          filter="url(#board-pencil)"
        >
          {kind === 'cross' ? (
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

        const flashesInvalid = invalidFlash !== null && includesPosition(invalidFlash.positions, position);

        tiles.push(
          <Hexagon
            key={positionKey(position)}
            x={x}
            y={y}
            position={position}
            onClick={onTileClick}
            highlight={highlightAt(position)}
            invalidFlashId={flashesInvalid ? invalidFlash.id : null}
            hexSize={hexSize}
            hexData={hexData}
          />
        );
      }
    }
    return tiles;
  };

  /** The hexes the fog of war hides, shaded; taps go through to the hexes */
  const renderFog = () => {
    if (!fog || fog.dark.length === 0) return null;
    const corners = (x: number, y: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i * Math.PI) / 3 + Math.PI / 2;
        // A hair bigger, so no seam shows between two dark hexes
        return `${x + hexSize * 1.02 * Math.cos(angle)},${y + hexSize * 1.02 * Math.sin(angle)}`;
      }).join(' ');
    return (
      <g className="board__fog" data-testid="fog-of-war" pointerEvents="none">
        {fog.dark.map((position) => {
          const { x, y } = geometry.hexCenter(position);
          return <polygon key={positionKey(position)} data-fog-at={positionKey(position)} points={corners(x, y)} />;
        })}
      </g>
    );
  };

  /** Every unit on the map, this side's and the other army's, where it's drawn */
  const tokens = (): PlacedToken[] => {
    const startOf = (list: readonly Order[]) => new Map(list.map((order) => [order.unit, order.start]));
    const ownStarts = atStart ? startOf(orders) : null;
    const own = boardManager.getAllHexes().flatMap((hex): PlacedToken[] => {
      const unit = hex.unit;
      if (!unit || hiddenUnits.has(unit)) return [];
      const position = hex.getPosition();
      const stands = strength.get(positionKey(position));
      return [{
        unit,
        faction: unitFactionAt?.(position) ?? faction,
        position: ownStarts?.get(unit) ?? position,
        other: false,
        readyToFire: unitsReadyToFire.has(unit),
        fired: firedUnits?.has(unit) ?? false,
        orderable: includesPosition(orderablePositions, position),
        figures: stands?.figures,
        pinned: stands?.pinned,
        retreats: stands?.retreats,
        damaged: stands?.damaged,
        hitThisTurn: stands?.hitThisTurn,
      }];
    });
    if (!opponent) return own;
    const otherStarts = atStart ? startOf(opponent.orders) : null;
    const other = opponent.units.map(({ position, unit, figures, pinned, retreats, damaged, hitThisTurn }): PlacedToken => ({
      unit,
      faction: opponent.faction,
      position: otherStarts?.get(unit) ?? position,
      other: true,
      figures,
      pinned,
      retreats,
      damaged,
      hitThisTurn,
    }));
    return [...own, ...other];
  };

  /**
   * The units, each keyed by itself rather than its hex: when one moves, its token glides to the
   * new hex (a CSS transition). Taps go through to the hexes underneath
   */
  const renderUnits = () => {
    // A unit hit since this map last drew it shakes once: the hits it had then, and the count it shook at
    const seen = seenHits.current;
    const shaken = shookAt.current;
    const drawn = tokens();
    for (const { unit, hitThisTurn = 0 } of drawn) {
      const before = seen.get(unit);
      if (before !== undefined && hitThisTurn > before) shaken.set(unit, hitThisTurn);
      seen.set(unit, hitThisTurn);
    }
    return drawn
      .sort((a, b) => unitKey(a.unit) - unitKey(b.unit))
      .map((token) => {
        const { x, y } = geometry.hexCenter(token.other ? turnedRound(token.position, boardManager.size) : token.position);
        return (
          <g
            key={unitKey(token.unit)}
            className="board__unit"
            data-unit-at={positionKey(token.position)}
            data-faction={token.faction}
            pointerEvents="none"
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            {/* Keyed by its hits, so each new hit plays the shake again */}
            <g
              key={token.hitThisTurn ?? 0}
              className={shaken.get(token.unit) === (token.hitThisTurn ?? 0) ? 'board__unit-hit' : undefined}
            >
              <UnitComponent
                x={0}
                y={0}
                faction={token.faction}
                unitData={token.unit}
                readyToFire={token.readyToFire}
                fired={token.fired}
                orderable={token.orderable}
                figures={token.figures}
                pinned={token.pinned}
                retreats={token.retreats}
                damaged={token.damaged}
                hitThisTurn={token.hitThisTurn}
              />
            </g>
          </g>
        );
      });
  };

  /**
   * The sandbags, this side's and the other army's, in front of the tokens like a wall. Each side's
   * face its enemy: the top of the map for the side it's seen from, the bottom for the other
   */
  const renderSandbags = () => {
    // At the start of the movement the units ordered off their sandbags still stand behind them
    const left = (list: readonly Order[]) => (atStart ? list.flatMap((order) => order.lostSandbags) : []);
    const own = [
      ...boardManager.getAllHexes().flatMap((hex) => (hex.sandbags && !hiddenAt(hex.getPosition()) ? [hex.getPosition()] : [])),
      ...left(orders.filter((order) => !hiddenUnits.has(order.unit))),
    ].map((position) => ({
      position,
      center: geometry.hexCenter(position),
      side: unitFactionAt?.(position) ?? faction,
    }));
    const other = opponent
      ? [...opponent.sandbags, ...left(opponent.orders)].map((position) => ({
          position,
          center: geometry.hexCenter(turnedRound(position, boardManager.size)),
          side: opponent.faction,
        }))
      : [];
    return [...own, ...other].map(({ position, center, side }) => {
      const key = `${side}-${positionKey(position)}`;
      return (
        <g key={key} data-sandbags-at={positionKey(position)} data-sandbags-side={side}>
          <SandbagsArt x={center.x} y={center.y} hexSize={hexSize} turned={side !== viewSide} />
        </g>
      );
    });
  };

  /** A small card on the units a combat card was given to, at the token's left */
  /** The camouflage token, right of the token, halfway down */
  const renderCamouflage = () =>
    camouflaged.filter((position) => !badgeHidden(position)).map((position) => {
      const { x, y } = geometry.hexCenter(position);
      return (
        <g key={positionKey(position)} data-camouflage={positionKey(position)} pointerEvents="none">
          <CamouflageBadge x={x + hexSize * 0.64} y={y} r={hexSize * 0.2} />
        </g>
      );
    });

  const renderCardBadges = () =>
    cardBadges.flatMap(({ position }, i) => {
      if (!position || badgeHidden(position)) return [];
      const { x, y } = geometry.hexCenter(position);
      const w = hexSize * 0.3;
      const h = w * 1.4;
      // Left of the token, halfway down: its corners hold the order, elite, figures and retreat badges
      const cx = x - hexSize * 0.68;
      const cy = y;
      return (
        <g key={`${i}-${positionKey(position)}`} className="board__card-badge" data-card-badge={positionKey(position)} pointerEvents="none">
          <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={w * 0.15} transform={`rotate(12 ${cx} ${cy})`} />
        </g>
      );
    });

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

  const zoom = useBoardZoom({ x: viewX, y: viewY, width: viewWidth, height: viewHeight }, zoomable);
  const shown = zoom.view;
  const { focusOn } = zoom;
  const zoomRequest = zoomOn?.request;
  useEffect(() => {
    if (!zoomOn || !zoomable) return;
    const { x, y } = geometry.hexCenter(zoomOn.position);
    focusOn(x, y);
    // Only a new request zooms: the board redrawing doesn't
  }, [zoomRequest]);

  return (
    <div className={`board${zoomable ? ' board--zoomable' : ''}${zoom.zoomed ? ' board--zoomed' : ''}`} {...zoom.handlers}>
      {/* viewBox + CSS width lets the board scale down to fit tablets; zooming narrows the viewBox */}
      <svg
        ref={zoom.svgRef}
        viewBox={`${shown.x} ${shown.y} ${shown.width} ${shown.height}`}
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
              viewSide === "Axis"
                ? `rotate(180 ${(width / 2)} ${(height / 2)})`
                : undefined
            }
          />
        )}

        {/* Layer 2: Hexagon tiles, then the units and the sandbags in front of them */}
        {renderBoard()}
        {renderFog()}
        {renderUnits()}
        {renderSandbags()}
        {renderObjectives()}
        {renderCardBadges()}
        {renderCamouflage()}

        {/* Layer 3: Orders, and the other army on a shared map */}
        {renderOrders()}
        {renderOpponent()}

        {/* Layer 4: Combat card markers and collisions */}
        {renderMarkers()}
        {renderCollisions()}

        {/* Layer 5: dice at each hex a unit can fire at (top layer) */}
        {renderTargetDice()}
      </svg>
      {zoomable && (
        <div className="board__zoom">
          <IconButton className="board__zoom-button" aria-label={t.zoomIn} title={t.zoomIn} disabled={!zoom.canZoomIn} onClick={zoom.zoomIn}>
            +
          </IconButton>
          <IconButton className="board__zoom-button" aria-label={t.zoomOut} title={t.zoomOut} disabled={!zoom.zoomed} onClick={zoom.zoomOut}>
            −
          </IconButton>
          <IconButton className="board__zoom-button" aria-label={t.fit} title={t.fit} disabled={!zoom.zoomed} onClick={zoom.reset}>
            ⤢
          </IconButton>
        </div>
      )}
    </div>
  );
};

export default Board;
