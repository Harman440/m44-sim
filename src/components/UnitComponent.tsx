// Unit.tsx
import React from "react";
import alliedInfantry from "../assets/units/allies/infantry.webp";
import alliedInfantryBack from "../assets/units/allies/infantry-back.webp";
import alliedTank from "../assets/units/allies/tank.svg";
import alliedArtillery from "../assets/units/allies/artillery.svg";
import axisInfantry from "../assets/units/axis/infantry.webp";
import axisInfantryBack from "../assets/units/axis/infantry-back.webp";
import axisTank from "../assets/units/axis/tank.svg";
import axisArtillery from "../assets/units/axis/artillery.svg";
import Unit, { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { FACTION_COLORS } from "../looks/looks";
import { FIGURES } from "../data/figures";
import { defineMessages, useMessages } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    elite: "De élite",
    figures: (n: number) => (n === 1 ? "1 figura" : `${n} figuras`),
    damaged: (n: number) => `${n === 1 ? "1 figura" : `${n} figuras`}, una ya tocada: el próximo impacto la quita`,
    hitThisTurn: (n: number) => (n === 1 ? "1 impacto este turno" : `${n} impactos este turno`),
    pinned: "Inmovilizada: otra bandera la hace retirarse",
    retreats: (n: number) => (n === 1 ? "Se retira 1 casilla ahora" : `Se retira ${n} casillas ahora`),
  },
  en: {
    elite: "Elite",
    figures: (n: number) => (n === 1 ? "1 figure" : `${n} figures`),
    damaged: (n: number) => `${n === 1 ? "1 figure" : `${n} figures`}, one already hit: the next hit removes it`,
    hitThisTurn: (n: number) => (n === 1 ? "1 hit this turn" : `${n} hits this turn`),
    pinned: "Pinned: another flag makes it retreat",
    retreats: (n: number) => (n === 1 ? "Retreats 1 hex now" : `Retreats ${n} hexes now`),
  },
});

// Tank and artillery are placeholder SVGs; drop real art in the same folders to replace them
const SPRITES: Record<Faction, Record<UnitType, string>> = {
  Allies: {
    [UnitType.INFANTRY]: alliedInfantry,
    [UnitType.TANK]: alliedTank,
    [UnitType.ARTILLERY]: alliedArtillery,
  },
  Axis: {
    [UnitType.INFANTRY]: axisInfantry,
    [UnitType.TANK]: axisTank,
    [UnitType.ARTILLERY]: axisArtillery,
  },
};

/** Seen from behind, facing the enemy: a unit type without one shows its front */
const BACK_SPRITES: Record<Faction, Partial<Record<UnitType, string>>> = {
  Allies: { [UnitType.INFANTRY]: alliedInfantryBack },
  Axis: { [UnitType.INFANTRY]: axisInfantryBack },
};

export const unitSprite = (faction: Faction, unitType: UnitType): string => SPRITES[faction][unitType];

interface UnitProps {
  /** Centre of the token */
  x: number;
  y: number;
  faction: Faction;
  unitData?: Unit; // without data, an infantry sprite is drawn
  /** It belongs to the side the board is seen from, so it faces away towards the enemy: drawn from behind */
  fromBehind?: boolean;
  /** Its order lets it fire this turn */
  readyToFire?: boolean;
  /** It has used its shots this turn */
  fired?: boolean;
  /** It can be ordered */
  orderable?: boolean;
  /** Pass and play: its figures left, the sprites drawn and a number bottom right; by default all of them */
  figures?: number;
  /** Pass and play: it took a flag this turn (pinned), a flag bottom left */
  pinned?: boolean;
  /** Pass and play: hexes it must retreat now, on the flag */
  retreats?: number;
  /** Pass and play: a figure took one hit of two (armour): the figures badge is marked red */
  damaged?: boolean;
  /** Pass and play: hits it took this turn, a red tag over the token until the turn ends */
  hitThisTurn?: number;
}

const TOKEN_RADIUS = 27;

/** A five-pointed star centred on (cx, cy) */
const starPath = (cx: number, cy: number, outer: number, inner: number) =>
  "M" +
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join("L") +
  "Z";
const BADGE_RADIUS = 10;

/**
 * Each figure's sprite size and where it stands, from the centre: back row first, so the front row
 * overlaps it. A unit that has lost figures shows the first ones, losing its front row first
 */
const FIGURE_LAYOUT: Record<UnitType, { size: number; spots: ReadonlyArray<readonly [number, number]> }> = {
  [UnitType.INFANTRY]: {
    size: 30,
    spots: [
      [-20, -14],
      [0, -16],
      [20, -14],
      [-20, 12],
      [0, 14],
      [20, 12],
    ],
  },
  [UnitType.TANK]: {
    size: 30,
    spots: [
      [-15, -12],
      [15, -12],
      [0, 10],
    ],
  },
  [UnitType.ARTILLERY]: {
    size: 30,
    spots: [
      [-15, -12],
      [15, -12],
      [0, 10],
    ],
  },
};

/**
 * A unit as one of its side's sprites per figure, with no token behind it. A dashed gold ring marks a
 * unit that can be ordered; a badge shows it will fire (crosshair) or has
 * fired (check).
 */
const UnitComponent: React.FC<UnitProps> = ({
  x,
  y,
  faction,
  unitData,
  fromBehind = false,
  readyToFire = false,
  fired = false,
  orderable = false,
  figures,
  pinned = false,
  retreats = 0,
  damaged = false,
  hitThisTurn = 0,
}) => {
  const t = useMessages(TEXT);
  const unitType = unitData?.getUnitType() ?? UnitType.INFANTRY;
  const href = (fromBehind && BACK_SPRITES[faction][unitType]) || unitSprite(faction, unitType);
  const layout = FIGURE_LAYOUT[unitType];
  // Own tablets don't count figures: a unit stands at full strength
  const figuresShown = figures ?? FIGURES[unitType].figures;
  const badgeX = x + TOKEN_RADIUS * 0.72;
  const badgeY = y - TOKEN_RADIUS * 0.72;

  return (
    <g className="unit">
      {orderable && (
        <circle
          className="unit__ring unit__ring--orderable"
          cx={x}
          cy={y}
          r={TOKEN_RADIUS + 5}
          fill="none"
          stroke="#ffd54f"
          strokeWidth={4}
          strokeDasharray="8 5"
        />
      )}

      {layout.spots.slice(0, figuresShown).map(([dx, dy], i) => (
        <image
          key={i}
          href={href}
          data-unit-type={unitType}
          x={x + dx - layout.size / 2}
          y={y + dy - layout.size / 2}
          width={layout.size}
          height={layout.size}
          preserveAspectRatio="xMidYMid meet"
        />
      ))}

      {/* The scenario's elite badge (moves its whole move and fires), top left */}
      {unitData?.elite && (
        <g className="unit__badge unit__badge--elite" data-testid="elite-badge">
          <title>{t.elite}</title>
          <circle cx={x - TOKEN_RADIUS * 0.72} cy={badgeY} r={BADGE_RADIUS} fill="#c9a227" stroke="#f1ead6" strokeWidth={2} />
          <path
            d={starPath(x - TOKEN_RADIUS * 0.72, badgeY, 6.5, 2.7)}
            fill="#3b2a07"
          />
        </g>
      )}

      {/* Pass and play: figures left, bottom right */}
      {figures !== undefined && (
        <g
          className={`unit__badge unit__badge--figures${damaged ? " unit__badge--damaged" : ""}`}
          data-testid="figures-badge"
          data-damaged={damaged || undefined}
        >
          <title>{damaged ? t.damaged(figures) : t.figures(figures)}</title>
          <circle
            cx={badgeX}
            cy={y + TOKEN_RADIUS * 0.72}
            r={BADGE_RADIUS + 1}
            fill={damaged ? "#b3261e" : "#f1ead6"}
            stroke={damaged ? "#f1ead6" : FACTION_COLORS[faction]}
            strokeWidth={2.5}
          />
          <text
            x={badgeX}
            y={y + TOKEN_RADIUS * 0.72}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fontWeight={700}
            fill={damaged ? "#f1ead6" : "#2b2418"}
          >
            {figures}
          </text>
        </g>
      )}

      {/* Pass and play: the hits it took this turn, a red tag at the top */}
      {hitThisTurn > 0 && (
        <g className="unit__badge unit__badge--hits" data-testid="hits-badge">
          <title>{t.hitThisTurn(hitThisTurn)}</title>
          <rect
            x={x - 15}
            y={y - TOKEN_RADIUS - 11}
            width={30}
            height={18}
            rx={9}
            fill="#b3261e"
            stroke="#f1ead6"
            strokeWidth={1.5}
          />
          <text
            x={x}
            y={y - TOKEN_RADIUS - 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={700}
            fill="#f1ead6"
          >
            −{hitThisTurn}
          </text>
        </g>
      )}

      {/* Pinned (a flag this turn): a flag bottom left, with the hexes it must retreat now */}
      {(pinned || retreats > 0) && (
        <g className="unit__badge unit__badge--retreat" data-testid="retreat-badge">
          <title>{retreats > 0 ? t.retreats(retreats) : t.pinned}</title>
          <circle cx={x - TOKEN_RADIUS * 0.72} cy={y + TOKEN_RADIUS * 0.72} r={BADGE_RADIUS + 1} fill="#c9a227" stroke="#f1ead6" strokeWidth={2} />
          <path
            d={`M${x - TOKEN_RADIUS * 0.72 - 4} ${y + TOKEN_RADIUS * 0.72 + 6}v-12l8 3.5l-8 3.5`}
            fill="#3b2a07"
            stroke="#3b2a07"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          {retreats > 0 && (
            <text x={x - TOKEN_RADIUS * 0.72 + 6} y={y + TOKEN_RADIUS * 0.72 + 5} fontSize={10} fontWeight={700} fill="#3b2a07">
              {retreats}
            </text>
          )}
        </g>
      )}

      {fired ? (
        <g className="unit__badge unit__badge--fired">
          <circle cx={badgeX} cy={badgeY} r={BADGE_RADIUS} fill="#3f6b2a" stroke="#f1ead6" strokeWidth={2} />
          <path
            d={`M${badgeX - 5} ${badgeY} l3.5 3.5 l6 -7`}
            fill="none"
            stroke="#f1ead6"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : readyToFire ? (
        <g className="unit__badge unit__badge--fire">
          <circle cx={badgeX} cy={badgeY} r={BADGE_RADIUS} fill="#b3261e" stroke="#f1ead6" strokeWidth={2} />
          <circle cx={badgeX} cy={badgeY} r={4.5} fill="none" stroke="#f1ead6" strokeWidth={1.8} />
          <path
            d={`M${badgeX} ${badgeY - 8}v4M${badgeX} ${badgeY + 4}v4M${badgeX - 8} ${badgeY}h4M${badgeX + 4} ${badgeY}h4`}
            stroke="#f1ead6"
            strokeWidth={1.8}
          />
        </g>
      ) : null}
    </g>
  );
};

export default UnitComponent;
