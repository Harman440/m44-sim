// Illustrations for the command and combat cards, drawn in SVG from the
// card's own rules, so every card gets art without an image per card.
// Colours come from the look (--m44-* variables and --card-accent).
import { useId } from "react";
import CommandCard, { SECTIONS, Section } from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { FACTION_COLORS } from "../looks/looks";
import { unitSprite } from "./UnitComponent";
import { GameIconName, iconUrl } from "./GameIcon";
import "./CardArt.css";

// --- shared pieces

const HEX_RADIUS = 8;
const ROW_SPACING = HEX_RADIUS * 1.5;

const hexPoints = (cx: number, cy: number, r = HEX_RADIUS) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI) / 3 + Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

interface ArtHex {
  x: number;
  y: number;
  /** Its radius, to draw it */
  r: number;
  section: Section;
}

/** A strip of board, `rows` rows of hexes across `width` like the real board (odd rows shifted), split in thirds */
function boardStrip(width: number, rows: number, top: number, r = HEX_RADIUS): ArtHex[] {
  const hexWidth = r * Math.sqrt(3);
  const cols = Math.floor((width - hexWidth / 2) / hexWidth);
  const left = (width - (cols * hexWidth + hexWidth / 2)) / 2 + hexWidth / 2;
  const hexes: ArtHex[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols - (row % 2); col++) {
      const x = left + col * hexWidth + (row % 2) * (hexWidth / 2);
      hexes.push({ x, y: top + r + row * r * 1.5, r, section: SECTIONS[Math.min(2, Math.floor((x / width) * 3))]! });
    }
  }
  return hexes;
}

/** The polygon of a board hex, a little smaller so the ground shows between hexes */
const hexShape = ({ x, y, r }: ArtHex) => hexPoints(x, y, r - 0.6);

/** A unit token like the board's: the unit's art on a disc ringed in the faction's colour */
function Token({ x, y, type, faction, r = 11 }: { x: number; y: number; type: UnitType; faction: Faction; r?: number }) {
  const size = r * 1.6;
  return (
    <g className="card-art__token">
      <circle cx={x} cy={y} r={r} fill="#f1ead6" stroke={FACTION_COLORS[faction]} strokeWidth={2.5} />
      <image href={unitSprite(faction, type)} x={x - size / 2} y={y - size / 2} width={size} height={size} />
    </g>
  );
}

/** A game-icons.net icon inside the SVG: its shape masks a rectangle, so it takes `className`'s fill */
function Icon({ name, x, y, size, className }: { name: GameIconName; x: number; y: number; size: number; className: string }) {
  const id = useId();
  return (
    <>
      <mask id={id} style={{ maskType: "alpha" }}>
        <image href={iconUrl(name)} x={x} y={y} width={size} height={size} />
      </mask>
      <rect x={x} y={y} width={size} height={size} mask={`url(#${id})`} className={className} />
    </>
  );
}

/** A small round badge with an icon, for a card's special rules */
function Badge({ x, y, icon }: { x: number; y: number; icon: GameIconName | "move" }) {
  return (
    <g className="card-art__badge">
      <circle cx={x} cy={y} r={9} />
      {icon === "move" ? (
        <path d={`M${x - 5} ${y + 2} h7 v-4 l5 5 -5 5 v-4 h-7 z`} className="card-art__ink" transform={`translate(0 -2)`} />
      ) : (
        <Icon name={icon} x={x - 6} y={y - 6} size={12} className="card-art__ink" />
      )}
    </g>
  );
}

// --- command cards

/** The special rules a command card shows as badges on its art */
function commandBadges(card: CommandCard): (GameIconName | "move")[] {
  const badges: (GameIconName | "move")[] = [];
  if (card.onTheMove > 0 || card.moveBonus > 0) badges.push("move");
  if (card.noMove) badges.push("endTurn");
  if (card.holdShots > 1 || card.closeAssaultOnly) badges.push("fire");
  if (card.fireBonus.length > 0) badges.push("dice");
  if (card.drawChoice > 1) badges.push("cards");
  if (card.paidInCoins || card.endOfTurnReward) badges.push("coins");
  return badges;
}

const SECTION_NAMES: Record<Section, string> = { left: "Izquierda", center: "Centro", right: "Derecha" };

/**
 * A command card's art: a strip of the board with the sections it orders
 * tinted (hatched when the player picks one), the unit types it orders as
 * tokens, and badges for its special rules
 */
export function CommandCardArt({ card, faction }: { card: CommandCard; faction: Faction }) {
  const hatch = useId();
  const width = 160;
  const height = 76;
  const hexes = boardStrip(width, 5, 4);
  const chosen = card.sections === "chosen";
  const active = (section: Section) => chosen || (card.sections as readonly Section[]).includes(section);
  const label = card.choosesSection
    ? "una a elegir"
    : SECTIONS.filter(active)
        .map((s) => SECTION_NAMES[s])
        .join(", ");
  const units = card.unitTypes ?? [];
  const middle = 4 + HEX_RADIUS + 2 * ROW_SPACING;
  const badges = commandBadges(card);

  return (
    <svg className="card-art" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Secciones: ${label}`}>
      <defs>
        <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" className="card-art__hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="5" className="card-art__hatch-line" />
        </pattern>
      </defs>
      <rect width={width} height={height} className="card-art__ground" />
      {hexes.map((hex) => (
        <polygon
          key={`${hex.x}-${hex.y}`}
          points={hexShape(hex)}
          className={`card-art__hex${active(hex.section) && !chosen ? " card-art__hex--on" : ""}`}
          fill={chosen ? `url(#${hatch})` : undefined}
        />
      ))}
      {[1, 2].map((i) => (
        <line key={i} x1={(width / 3) * i} y1={0} x2={(width / 3) * i} y2={height} className="card-art__divider" />
      ))}
      {card.perSection !== null &&
        SECTIONS.filter(active).map((section) => (
          <text key={section} x={(width / 6) * (1 + 2 * SECTIONS.indexOf(section))} y={middle + 4} className="card-art__quota">
            ×{card.perSection}
          </text>
        ))}
      {units.map((type, i) => (
        // Left of centre: the order count is stamped on the right
        <Token key={type} type={type} faction={faction} x={(width - 56) / 2 + (i - (units.length - 1) / 2) * 32} y={middle} r={14} />
      ))}
      {badges.map((icon, i) => (
        <Badge key={icon} icon={icon} x={11 + i * 21} y={height - 11} />
      ))}
    </svg>
  );
}

// --- combat cards

const COMBAT_WIDTH = 184;
const COMBAT_HEIGHT = 58;

/** A target reticle on a hex (Barrage, Air Power…) */
function Reticle({ x, y }: { x: number; y: number }) {
  return (
    <g className="card-art__reticle">
      <circle cx={x} cy={y} r={6} />
      <line x1={x - 9} y1={y} x2={x + 9} y2={y} />
      <line x1={x} y1={y - 9} x2={x} y2={y + 9} />
    </g>
  );
}

/** The hexes along the middle row, left to right */
const middleRow = (hexes: ArtHex[]) => {
  const y = hexes[Math.floor(hexes.length / 2)]!.y;
  return hexes.filter((hex) => Math.abs(hex.y - y) < 1);
};

/** What the combat card's art shows, from its effect and marker rule */
function CombatScene({ card, faction, hexes }: { card: CombatCard; faction: Faction; hexes: ArtHex[] }) {
  const row = middleRow(hexes);
  const at = (i: number) => row[Math.min(row.length - 1, Math.max(0, i))]!;
  const mid = Math.floor(row.length / 2);
  const effect = card.effect;

  if (card.marker?.kind === "target") {
    // Reticles on the marked hexes: in a chain for Air Power, spread out otherwise
    const count = card.marker.count;
    const hexesHit = card.marker.chain
      ? Array.from({ length: count }, (_, i) => at(mid - Math.floor(count / 2) + i))
      : Array.from({ length: count }, (_, i) => at(mid + Math.round((i - (count - 1) / 2) * 3)));
    return (
      <>
        {hexesHit.map((hex, i) => (
          <polygon key={`on-${i}`} points={hexShape(hex)} className="card-art__hex card-art__hex--hit" />
        ))}
        {hexesHit.map((hex, i) => (
          <Reticle key={i} x={hex.x} y={hex.y} />
        ))}
      </>
    );
  }

  if (card.marker?.kind === "cross") {
    // Where a new unit appears: a cross on a hex, next to the unit it comes with (Sniper) or a new token
    const hex = at(mid + 1);
    const type = card.marker.nextTo ?? UnitType.INFANTRY;
    const d = 5;
    return (
      <>
        <polygon points={hexShape(hex)} className="card-art__hex card-art__hex--on" />
        <g className="card-art__cross">
          <line x1={hex.x - d} y1={hex.y - d} x2={hex.x + d} y2={hex.y + d} />
          <line x1={hex.x - d} y1={hex.y + d} x2={hex.x + d} y2={hex.y - d} />
        </g>
        <Token type={type} faction={faction} x={at(mid - 1).x} y={hex.y} />
        {effect?.kind === "reinforcements" && <Badge icon="dice" x={at(mid + 3).x} y={hex.y} />}
      </>
    );
  }

  if (effect?.kind === "diceBonus") {
    // The unit it helps, and a die with the extra dice
    const types = effect.unitTypes;
    const dieX = COMBAT_WIDTH / 2 + 18;
    const y = COMBAT_HEIGHT / 2;
    return (
      <>
        {types.map((type, i) => (
          <Token key={type} type={type} faction={faction} x={COMBAT_WIDTH / 2 - 18 - i * 26} y={y} r={13} />
        ))}
        <rect x={dieX - 12} y={y - 12} width={24} height={24} rx={5} className="card-art__die" />
        <Icon name="dice" x={dieX - 8} y={y - 8} size={16} className="card-art__ink" />
        <text x={dieX + 16} y={y + 7} className="card-art__bonus">
          +{effect.dice}
        </text>
      </>
    );
  }

  if (effect?.kind === "move") {
    // A unit and the path it takes, longer with a move bonus; the terrain it may enter is shaded
    const type = effect.unitTypes?.[0] ?? UnitType.INFANTRY;
    const steps = effect.maxMove ?? 3 + (effect.moveBonus ?? 0);
    const start = at(mid - Math.ceil(steps / 2));
    const end = at(mid - Math.ceil(steps / 2) + steps);
    const special = effect.ignoreTerrain || effect.fireInto || effect.endOn;
    return (
      <>
        {special && <polygon points={hexShape(end)} className="card-art__hex card-art__hex--terrain" />}
        <path
          d={`M${start.x + 10} ${start.y} Q${(start.x + end.x) / 2} ${start.y - 14} ${end.x - 4} ${end.y}`}
          className="card-art__path"
        />
        <path d={`M${end.x - 9} ${end.y - 6} L${end.x - 2} ${end.y} L${end.x - 10} ${end.y + 3} z`} className="card-art__arrow" />
        <Token type={type} faction={faction} x={start.x} y={start.y} />
        {effect.fireInto && <Reticle x={at(row.indexOf(end) + 1).x} y={end.y} />}
      </>
    );
  }

  if (effect?.kind === "changeSection") {
    // An arrow from one section to another
    const y = COMBAT_HEIGHT / 2;
    const from = COMBAT_WIDTH / 6;
    const to = (COMBAT_WIDTH / 6) * 5;
    return (
      <>
        {hexes
          .filter((hex) => hex.section === SECTIONS[0] || hex.section === SECTIONS[2])
          .map((hex) => (
            <polygon
              key={`${hex.x}-${hex.y}`}
              points={hexShape(hex)}
              className={`card-art__hex ${hex.section === SECTIONS[2] ? "card-art__hex--on" : "card-art__hex--faded"}`}
            />
          ))}
        <path d={`M${from} ${y} Q${COMBAT_WIDTH / 2} ${y - 28} ${to - 6} ${y - 2}`} className="card-art__path card-art__path--solid" />
        <path d={`M${to - 12} ${y - 9} L${to - 2} ${y} L${to - 13} ${y + 3} z`} className="card-art__arrow" />
      </>
    );
  }

  const glyph = tableGlyph(card, faction, row, mid);
  if (glyph) return glyph;

  // Resolved at the table: the emblem of when it's played, stamped on a disc
  const size = 26;
  const cx = COMBAT_WIDTH / 2;
  const cy = COMBAT_HEIGHT / 2;
  return (
    <>
      <circle cx={cx} cy={cy} r={24} className="card-art__seal-ring" />
      <circle cx={cx} cy={cy} r={20} className="card-art__seal" />
      <Icon
        name={card.phase === "order" ? "battle" : "fire"}
        x={cx - size / 2}
        y={cy - size / 2}
        size={size}
        className="card-art__emblem"
      />
    </>
  );
}

/** A card's copies share its id with a number on the end ("medic-2") */
const baseId = (card: CombatCard) => card.id.replace(/-\d+$/, "");

/** Cards that stop an enemy unit of this type (any type: infantry is drawn) */
const DENIED: Record<string, UnitType> = {
  "out-of-ammo": UnitType.INFANTRY,
  "out-of-fuel": UnitType.TANK,
  "shells-shortage": UnitType.ARTILLERY,
};

/** Art for some cards resolved at the table, drawn from what they do; null for the rest */
function tableGlyph(card: CombatCard, faction: Faction, row: ArtHex[], mid: number) {
  const id = baseId(card);
  const at = (i: number) => row[Math.min(row.length - 1, Math.max(0, i))]!;
  const y = at(mid).y;
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";

  if (id === "medic" || id === "mechanic" || id === "return-to-duty") {
    // A weakened unit and a medical cross
    const type = id === "mechanic" ? UnitType.TANK : UnitType.INFANTRY;
    const cx = at(mid + 1).x + 4;
    return (
      <>
        <Token type={type} faction={faction} x={at(mid - 1).x} y={y} r={13} />
        <rect x={cx - 11} y={y - 11} width={22} height={22} rx={4} className="card-art__die" />
        <path d={`M${cx - 3} ${y - 8} h6 v5 h5 v6 h-5 v5 h-6 v-5 h-5 v-6 h5 z`} className="card-art__medic" />
      </>
    );
  }

  if (id === "fortify") {
    // Sandbags in an arc in front of a unit
    const cx = at(mid).x;
    return (
      <>
        <Token type={UnitType.INFANTRY} faction={faction} x={cx} y={y + 4} />
        {[-2, -1, 0, 1, 2].map((i) => (
          <ellipse key={i} cx={cx + i * 8} cy={y - 12 + Math.abs(i) * 3} rx={5} ry={3.4} className="card-art__sandbag" />
        ))}
      </>
    );
  }

  if (id === "pull-back" || id === "reposition") {
    // A unit stepping back two hexes, towards its own side
    const type = id === "reposition" ? UnitType.ARTILLERY : UnitType.INFANTRY;
    const start = at(mid + 1);
    const end = at(mid - 2);
    return (
      <>
        <path d={`M${start.x - 10} ${y} Q${(start.x + end.x) / 2} ${y - 14} ${end.x + 4} ${y}`} className="card-art__path" />
        <path d={`M${end.x + 9} ${y - 6} L${end.x + 2} ${y} L${end.x + 10} ${y + 3} z`} className="card-art__arrow" />
        <Token type={type} faction={faction} x={start.x} y={y} />
      </>
    );
  }

  if (DENIED[id]) {
    // An enemy unit, struck out
    const cx = at(mid).x;
    return (
      <>
        <Token type={DENIED[id]!} faction={enemy} x={cx} y={y} r={13} />
        <g className="card-art__denied">
          <circle cx={cx} cy={y} r={17} />
          <line x1={cx - 12} y1={y + 12} x2={cx + 12} y2={y - 12} />
        </g>
      </>
    );
  }

  if (id === "camouflage") {
    // A unit half hidden under a net
    const cx = at(mid).x;
    return (
      <>
        <Token type={UnitType.INFANTRY} faction={faction} x={cx} y={y} r={13} />
        <circle cx={cx} cy={y} r={17} className="card-art__net" />
      </>
    );
  }

  return null;
}

/** A combat card's art: a strip of board with what the card does on it */
export function CombatCardArt({ card, faction }: { card: CombatCard; faction: Faction }) {
  const hexes = boardStrip(COMBAT_WIDTH, 3, 1.5, 11);
  return (
    <svg className="card-art card-art--combat" viewBox={`0 0 ${COMBAT_WIDTH} ${COMBAT_HEIGHT}`} aria-hidden>
      <rect width={COMBAT_WIDTH} height={COMBAT_HEIGHT} className="card-art__ground" />
      {hexes.map((hex) => (
        <polygon key={`${hex.x}-${hex.y}`} points={hexShape(hex)} className="card-art__hex" />
      ))}
      <CombatScene card={card} faction={faction} hexes={hexes} />
    </svg>
  );
}
