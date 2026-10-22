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
import { iconUrl } from "./GameIcon";
import { signedChange as signed } from "./UnitChangeChips";

const TEXT = defineMessages({
  es: {
    elite: "De élite",
    figures: (n: number) => (n === 1 ? "1 figura" : `${n} figuras`),
    damaged: (n: number) => `${n === 1 ? "1 figura" : `${n} figuras`}, una ya tocada: el próximo impacto la quita`,
    hitThisTurn: (n: number) => (n === 1 ? "1 impacto este turno" : `${n} impactos este turno`),
    pinned: "Inmovilizada: otra bandera la hace retirarse",
    retreats: (n: number) => (n === 1 ? "Se retira 1 casilla ahora" : `Se retira ${n} casillas ahora`),
    change: (morale: number, ammo: number, luck: string) => `Este turno: moral ${morale}, munición ${ammo}, suerte ${luck}`,
  },
  en: {
    elite: "Elite",
    figures: (n: number) => (n === 1 ? "1 figure" : `${n} figures`),
    damaged: (n: number) => `${n === 1 ? "1 figure" : `${n} figures`}, one already hit: the next hit removes it`,
    hitThisTurn: (n: number) => (n === 1 ? "1 hit this turn" : `${n} hits this turn`),
    pinned: "Pinned: another flag makes it retreat",
    retreats: (n: number) => (n === 1 ? "Retreats 1 hex now" : `Retreats ${n} hexes now`),
    change: (morale: number, ammo: number, luck: string) => `This turn: morale ${morale}, ammo ${ammo}, luck ${luck}`,
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
  /** Pass and play: it took a flag this turn (pinned), a flag bottom left */
  pinned?: boolean;
  /** Pass and play: hexes it must retreat now, on the flag */
  retreats?: number;
  /** Pass and play: a figure took one hit of two (armour): the figures badge is marked red */
  damaged?: boolean;
  /** Pass and play: hits it took this turn, a red tag over the token until the turn ends */
  hitThisTurn?: number;
  /** What it lost or gained since the orders were confirmed: a pill under the token (this side's units only) */
  change?: { morale: number; ammo: number; luck: number };
}

const TOKEN_RADIUS = 27;

/**
 * What a unit lost or gained this turn, under its token: each change with its icon (morale lost,
 * ammo or shells spent, luck moved), on a light pill
 */
function ChangePill({ x, y, change }: { x: number; y: number; change: NonNullable<UnitProps["change"]> }) {
  const t = useMessages(TEXT);
  const parts = [
    change.morale !== 0 && { icon: "morale" as const, text: signed(change.morale) },
    change.ammo !== 0 && { icon: "ammo" as const, text: signed(change.ammo) },
    Math.abs(change.luck) >= 0.05 && { icon: "luck" as const, text: signed(change.luck, 1) },
  ].filter((part): part is { icon: "morale" | "ammo" | "luck"; text: string } => !!part);
  if (parts.length === 0) return null;
  const ICON = 11;
  const widths = parts.map((part) => ICON + 2 + part.text.length * 6.2);
  const gap = 5;
  const width = widths.reduce((sum, w) => sum + w, 0) + gap * (parts.length - 1) + 10;
  let left = x - width / 2 + 5;
  return (
    <g className="unit__badge unit__badge--change" data-testid="change-pill">
      <title>{t.change(change.morale, change.ammo, signed(change.luck, 1))}</title>
      <rect x={x - width / 2} y={y - 8} width={width} height={16} rx={8} fill="#f1ead6" stroke="#2b2418" strokeWidth={1} opacity={0.95} />
      {parts.map((part, i) => {
        const at = left;
        left += widths[i]! + gap;
        return (
          <g key={part.icon}>
            <image href={iconUrl(part.icon)} x={at} y={y - ICON / 2} width={ICON} height={ICON} />
            <text x={at + ICON + 1.5} y={y} dominantBaseline="central" fontSize={10.5} fontWeight={700} fill="#2b2418">
              {part.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

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

// Preview: infantry stands in the hex as this many figures
const INFANTRY_FIGURES = 6;
const FIGURE_SIZE = 30;
/** Where each figure stands, from the centre: back row first, so the front row overlaps it */
const FIGURE_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [-20, -14],
  [0, -16],
  [20, -14],
  [-20, 12],
  [0, 14],
  [20, 12],
];

/**
 * A unit as its side's sprite, with no token behind it. A dashed gold ring marks a
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
  pinned = false,
  retreats = 0,
  damaged = false,
  hitThisTurn = 0,
  change,
}) => {
  const t = useMessages(TEXT);
  const unitType = unitData?.getUnitType() ?? UnitType.INFANTRY;
  const href = unitSprite(faction, unitType);
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

      {unitType === UnitType.INFANTRY ? (
        FIGURE_SPOTS.slice(0, INFANTRY_FIGURES).map(([dx, dy], i) => (
          <image
            key={i}
            href={href}
            data-unit-type={unitType}
            x={x + dx - FIGURE_SIZE / 2}
            y={y + dy - FIGURE_SIZE / 2}
            width={FIGURE_SIZE}
            height={FIGURE_SIZE}
            preserveAspectRatio="xMidYMid meet"
          />
        ))
      ) : (
        <image
          href={href}
          data-unit-type={unitType}
          x={x - SPRITE_SIZE / 2}
          y={y - SPRITE_SIZE / 2}
          width={SPRITE_SIZE}
          height={SPRITE_SIZE}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

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

      {change && <ChangePill x={x} y={y + TOKEN_RADIUS + 4} change={change} />}

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
