// Unit.tsx
import React from "react";
import alliedInfantry from "../assets/units/allies/infantry.webp";
import alliedTank from "../assets/units/allies/tank.svg";
import alliedArtillery from "../assets/units/allies/artillery.svg";
import axisInfantry from "../assets/units/axis/infantry.webp";
import axisTank from "../assets/units/axis/tank.svg";
import axisArtillery from "../assets/units/axis/artillery.svg";
import Unit, { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { FACTION_COLORS } from "../looks/looks";
import { defineMessages, useMessages } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    elite: "De élite",
    figures: (n: number) => (n === 1 ? "1 figura" : `${n} figuras`),
    damaged: (n: number) => `${n === 1 ? "1 figura" : `${n} figuras`}, una ya tocada: el próximo impacto la quita`,
    hitThisTurn: (n: number) => (n === 1 ? "1 impacto este turno" : `${n} impactos este turno`),
    retreats: (n: number) => (n === 1 ? "Se retira 1 casilla tras la batalla" : `Se retira ${n} casillas tras la batalla`),
  },
  en: {
    elite: "Elite",
    figures: (n: number) => (n === 1 ? "1 figure" : `${n} figures`),
    damaged: (n: number) => `${n === 1 ? "1 figure" : `${n} figures`}, one already hit: the next hit removes it`,
    hitThisTurn: (n: number) => (n === 1 ? "1 hit this turn" : `${n} hits this turn`),
    retreats: (n: number) => (n === 1 ? "Retreats 1 hex after the battle" : `Retreats ${n} hexes after the battle`),
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

export const unitSprite = (faction: Faction, unitType: UnitType): string => SPRITES[faction][unitType];

interface UnitProps {
  /** Centre of the token */
  x: number;
  y: number;
  faction: Faction;
  unitData?: Unit; // without data, an infantry sprite is drawn
  /** Its order lets it fire this turn */
  readyToFire?: boolean;
  /** It has used its shots this turn */
  fired?: boolean;
  /** It can be ordered */
  orderable?: boolean;
  /** Pass and play: its figures left, shown bottom right */
  figures?: number;
  /** Pass and play: hexes it must retreat after the battle, shown bottom left */
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
const SPRITE_SIZE = 44;
const BADGE_RADIUS = 10;

/**
 * A unit as a round token in its side's colour. A dashed gold ring marks a
 * unit that can be ordered; a badge shows it will fire (crosshair) or has
 * fired (check).
 */
const UnitComponent: React.FC<UnitProps> = ({
  x,
  y,
  faction,
  unitData,
  readyToFire = false,
  fired = false,
  orderable = false,
  figures,
  retreats = 0,
  damaged = false,
  hitThisTurn = 0,
}) => {
  const t = useMessages(TEXT);
  const unitType = unitData?.getUnitType() ?? UnitType.INFANTRY;
  const href = unitSprite(faction, unitType);
  const badgeX = x + TOKEN_RADIUS * 0.72;
  const badgeY = y - TOKEN_RADIUS * 0.72;

  return (
    <g className="unit">
      <circle
        className="unit__token"
        cx={x}
        cy={y}
        r={TOKEN_RADIUS}
        fill="#f1ead6"
        fillOpacity={0.9}
        stroke={FACTION_COLORS[faction]}
        strokeWidth={4}
      />

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

      <image
        href={href}
        data-unit-type={unitType}
        x={x - SPRITE_SIZE / 2}
        y={y - SPRITE_SIZE / 2}
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        preserveAspectRatio="xMidYMid meet"
      />

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

      {/* Marked to retreat after the battle: a flag with the hexes, bottom left */}
      {retreats > 0 && (
        <g className="unit__badge unit__badge--retreat" data-testid="retreat-badge">
          <title>{t.retreats(retreats)}</title>
          <circle cx={x - TOKEN_RADIUS * 0.72} cy={y + TOKEN_RADIUS * 0.72} r={BADGE_RADIUS + 1} fill="#c9a227" stroke="#f1ead6" strokeWidth={2} />
          <path
            d={`M${x - TOKEN_RADIUS * 0.72 - 4} ${y + TOKEN_RADIUS * 0.72 + 6}v-12l8 3.5l-8 3.5`}
            fill="#3b2a07"
            stroke="#3b2a07"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          {retreats > 1 && (
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
