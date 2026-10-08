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
  es: { elite: "De élite" },
  en: { elite: "Elite" },
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
