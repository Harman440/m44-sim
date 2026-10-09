// Illustrations for the command and combat cards, drawn in SVG from the
// card's own rules, so every card gets art without an image per card. The
// art is the whole face of the card: a piece of the board showing what the
// card does, and under it a row of pictograms per special rule. The text is
// in the card's details (CardDetails), shown when the card is tapped.
// Colours come from the look (--m44-* variables and --card-accent).
import { ReactNode, useId } from "react";
import CommandCard, { FireBonus, SECTIONS, Section } from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { FACTION_COLORS } from "../looks/looks";
import { unitSprite } from "./UnitComponent";
import { GameIconName, iconUrl } from "./GameIcon";
import generalsArt from "../assets/cards/british-generals.webp";
import armourAssaultArt from "../assets/cards/armour-assault.webp";
import artilleryBombardmentArt from "../assets/cards/artillery-bombardment.webp";
import closeAssaultArt from "../assets/cards/close-assault.webp";
import finestHourArt from "../assets/cards/finest-hour.webp";
import firefightArt from "../assets/cards/firefight.webp";
import hqArt from "../assets/cards/hq.webp";
import infantryAssaultArt from "../assets/cards/infantry-assault.webp";
import moveOutArt from "../assets/cards/move-out.webp";
import preparationsArt from "../assets/cards/preparations.webp";
import { defineMessages, useLang, useMessages, useTr } from "../i18n/useI18n";
import "./CardArt.css";

const TEXT = defineMessages({
  es: {
    sectionNames: { left: "Izquierda", center: "Centro", right: "Derecha" } as Record<Section, string>,
    all: "Todas",
    sections: (names: string) => `Secciones: ${names}`,
  },
  en: {
    sectionNames: { left: "Left", center: "Center", right: "Right" } as Record<Section, string>,
    all: "All",
    sections: (names: string) => `Sections: ${names}`,
  },
});

// --- shared pieces

const ART_WIDTH = 160;
/** Height of a row of pictograms under the board */
const RULE_HEIGHT = 30;
const RULE_GAP = 4;

const hexPoints = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI) / 3 + Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

interface ArtHex {
  x: number;
  y: number;
  /** Its radius, to draw it */
  r: number;
  row: number;
  section: Section;
}

/** A piece of board, `rows` rows of hexes across `width` like the real board (odd rows shifted), split in thirds */
function boardStrip(width: number, rows: number, top: number, r: number): ArtHex[] {
  const hexWidth = r * Math.sqrt(3);
  const cols = Math.floor((width - hexWidth / 2) / hexWidth);
  const left = (width - (cols * hexWidth + hexWidth / 2)) / 2 + hexWidth / 2;
  const hexes: ArtHex[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols - (row % 2); col++) {
      const x = left + col * hexWidth + (row % 2) * (hexWidth / 2);
      hexes.push({ x, y: top + r + row * r * 1.5, r, row, section: SECTIONS[Math.min(2, Math.floor((x / width) * 3))]! });
    }
  }
  return hexes;
}

/** The polygon of a board hex, a little smaller so the ground shows between hexes */
const hexShape = ({ x, y, r }: { x: number; y: number; r: number }) => hexPoints(x, y, r - 0.6);

/** A unit token like the board's: the unit's art on a disc ringed in the faction's colour */
function Token({
  x,
  y,
  type,
  faction,
  r = 11,
  ghost = false,
}: {
  x: number;
  y: number;
  type: UnitType;
  faction: Faction;
  r?: number;
  /** Dashed and see-through: a unit that only moves */
  ghost?: boolean;
}) {
  const size = r * 1.6;
  return (
    <g className={`card-art__token${ghost ? " card-art__token--ghost" : ""}`}>
      <circle cx={x} cy={y} r={r} fill="#f1ead6" stroke={FACTION_COLORS[faction]} strokeWidth={r / 4} />
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

/** A target reticle on a hex (Barrage, Air Power…) */
function Reticle({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return (
    <g className="card-art__reticle">
      <circle cx={x} cy={y} r={r} />
      <line x1={x - r * 1.5} y1={y} x2={x + r * 1.5} y2={y} />
      <line x1={x} y1={y - r * 1.5} x2={x} y2={y + r * 1.5} />
    </g>
  );
}

/** A red cross where a new unit appears */
function Cross({ x, y, d = 5 }: { x: number; y: number; d?: number }) {
  return (
    <g className="card-art__cross">
      <line x1={x - d} y1={y - d} x2={x + d} y2={y + d} />
      <line x1={x - d} y1={y + d} x2={x + d} y2={y - d} />
    </g>
  );
}

// --- pictograms: a card's special rules, one row each

/** One piece of a pictogram row; each knows its width */
type Glyph =
  | { kind: "text"; text: string }
  | { kind: "token"; type: UnitType; ghost?: boolean; enemy?: boolean }
  | { kind: "move"; struck?: boolean }
  | { kind: "fire"; struck?: boolean }
  | { kind: "die" }
  | { kind: "crate" }
  /** `count` cards fanned, with one picked */
  | { kind: "cards"; count: number }
  /** Two hexes side by side (close assault) or apart (at range) */
  | { kind: "reach"; adjacent: boolean }
  | { kind: "reticle" }
  | { kind: "cross" }
  | { kind: "terrain" };

const glyphWidth = (glyph: Glyph): number => {
  switch (glyph.kind) {
    case "text":
      return glyph.text.length * 8.6 + 2;
    case "token":
      return 22;
    case "move":
      return 24;
    case "cards":
      return 26;
    case "reach":
      return glyph.adjacent ? 22 : 30;
    default:
      return 20;
  }
};

const GLYPH_GAP = 5;

/** A struck-out line over a glyph: "not this" */
const Strike = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <line x1={x + 1} y1={y + 8} x2={x + w - 1} y2={y - 8} className="card-art__strike" />
);

function GlyphPiece({ glyph, x, y, faction }: { glyph: Glyph; x: number; y: number; faction: Faction }) {
  const w = glyphWidth(glyph);
  switch (glyph.kind) {
    case "text":
      return (
        <text x={x + w / 2} y={y + 6} className="card-art__rule-text">
          {glyph.text}
        </text>
      );
    case "token": {
      const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";
      return <Token type={glyph.type} faction={glyph.enemy ? enemy : faction} x={x + w / 2} y={y} r={10} ghost={glyph.ghost} />;
    }
    case "move":
      return (
        <g>
          <path d={`M${x + 1} ${y + 3} h13 v5 l9 -8 -9 -8 v5 h-13 z`} className="card-art__move" />
          {glyph.struck && <Strike x={x} y={y} w={w} />}
        </g>
      );
    case "fire":
      return (
        <g>
          <Icon name="fire" x={x + 1} y={y - 9} size={18} className="card-art__fire" />
          {glyph.struck && <Strike x={x} y={y} w={w} />}
        </g>
      );
    case "die":
      return (
        <g>
          <rect x={x + 1} y={y - 9} width={18} height={18} rx={4} className="card-art__die" />
          {[
            [-4.5, -4.5],
            [0, 0],
            [4.5, 4.5],
          ].map(([dx, dy]) => (
            <circle key={`${dx}`} cx={x + 10 + dx!} cy={y + dy!} r={1.8} className="card-art__pip" />
          ))}
        </g>
      );
    case "crate":
      return (
        <g>
          <rect x={x + 1} y={y - 9} width={18} height={18} rx={2} className="card-art__crate" />
          <path d={`M${x + 1} ${y - 3} h18 M${x + 1} ${y + 3} h18 M${x + 3} ${y - 9} l14 18`} className="card-art__crate-planks" />
        </g>
      );
    case "cards":
      return (
        <g>
          {Array.from({ length: glyph.count }, (_, i) => {
            const angle = (i - (glyph.count - 1) / 2) * 16;
            return (
              <rect
                key={i}
                x={x + w / 2 - 6}
                y={y - 9}
                width={12}
                height={17}
                rx={2}
                transform={`rotate(${angle} ${x + w / 2} ${y + 10})`}
                className={i === Math.floor(glyph.count / 2) ? "card-art__mini-card card-art__mini-card--picked" : "card-art__mini-card"}
              />
            );
          })}
        </g>
      );
    case "reach": {
      const r = 6;
      const left = x + r + 0.5;
      const right = x + w - r - 0.5;
      return (
        <g>
          <polygon points={hexPoints(left, y, r)} className="card-art__reach" />
          <polygon points={hexPoints(right, y, r)} className="card-art__reach card-art__reach--target" />
          {!glyph.adjacent && <line x1={left + r + 1} y1={y} x2={right - r - 1} y2={y} className="card-art__reach-gap" />}
        </g>
      );
    }
    case "reticle":
      return <Reticle x={x + w / 2} y={y} />;
    case "cross":
      return <Cross x={x + w / 2} y={y} />;
    case "terrain":
      return <polygon points={hexPoints(x + w / 2, y, 9.5)} className="card-art__hex--terrain" />;
  }
}

/** A row of pictograms on a strip, centred */
function RuleRow({ glyphs, y, faction }: { glyphs: Glyph[]; y: number; faction: Faction }) {
  const total = glyphs.reduce((sum, glyph) => sum + glyphWidth(glyph), 0) + GLYPH_GAP * (glyphs.length - 1);
  // Squeeze a row that is wider than the card
  const scale = Math.min(1, (ART_WIDTH - 12) / total);
  let x = (ART_WIDTH - total * scale) / 2 / scale;
  const cy = y + RULE_HEIGHT / 2;
  return (
    <g className="card-art__rule">
      <rect x={3} y={y} width={ART_WIDTH - 6} height={RULE_HEIGHT} rx={RULE_HEIGHT / 2} className="card-art__rule-bg" />
      <g transform={scale < 1 ? `translate(0 ${cy * (1 - scale)}) scale(${scale})` : undefined}>
        {glyphs.map((glyph, i) => {
          const piece = <GlyphPiece key={i} glyph={glyph} x={x} y={cy} faction={faction} />;
          x += glyphWidth(glyph) + GLYPH_GAP;
          return piece;
        })}
      </g>
    </g>
  );
}

/** "+1", "−1" */
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

const fireBonusGlyphs = (bonus: FireBonus): Glyph[] => [
  ...(bonus.unitTypes ?? []).map((type): Glyph => ({ kind: "token", type })),
  { kind: "die" },
  { kind: "text", text: signed(bonus.dice) },
  ...(bonus.closeAssault === undefined ? [] : [{ kind: "reach", adjacent: bonus.closeAssault } as Glyph]),
];

/** The art: a piece of board with the rows of pictograms under it */
function CardFace({
  label,
  boardHeight,
  rules,
  faction,
  children,
  defs,
}: {
  label?: string;
  boardHeight: number;
  rules: Glyph[][];
  faction: Faction;
  children: ReactNode;
  defs?: ReactNode;
}) {
  const height = boardHeight + (rules.length > 0 ? RULE_GAP + rules.length * (RULE_HEIGHT + RULE_GAP) : 0);
  return (
    <svg
      className="card-art"
      viewBox={`0 0 ${ART_WIDTH} ${height}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {defs && <defs>{defs}</defs>}
      <rect width={ART_WIDTH} height={boardHeight} rx={4} className="card-art__ground" />
      {children}
      {rules.map((glyphs, i) => (
        <RuleRow key={i} glyphs={glyphs} y={boardHeight + RULE_GAP + i * (RULE_HEIGHT + RULE_GAP)} faction={faction} />
      ))}
    </svg>
  );
}

// --- section cards (Batida, Ataque, Asalto, Vanguardia, Avance General, Movimiento en Pinza)

/** A card that orders units of any type in fixed sections: drawn with the painting and an arrow per section */
export const isSectionCard = (card: CommandCard): boolean =>
  !card.tactic && card.sections !== "chosen" && card.unitTypes === null;

const SECTION_HEX = 10.5;
const SECTION_BOARD_TOP = 4;
const SECTION_ROWS = 4;
const SECTION_HEIGHT = SECTION_BOARD_TOP + SECTION_HEX * 2 + (SECTION_ROWS - 1) * SECTION_HEX * 1.5 + 2;
const CHIP_HEIGHT = 26;

/** A section card's special rules, each a chip of pictograms beside the painting */
function sectionRules(card: CommandCard): Glyph[][] {
  const rules: Glyph[][] = [];
  if (card.drawChoice > 1) rules.push([{ kind: "cards", count: card.drawChoice }]);
  if (card.onTheMove > 0) rules.push([{ kind: "token", type: UnitType.INFANTRY, ghost: true }, { kind: "move" }]);
  return rules;
}

/** A special rule as a small rounded chip, its own SVG so it can sit beside the painting */
function RuleChip({ glyphs, faction }: { glyphs: Glyph[]; faction: Faction }) {
  const pad = 6;
  const width = glyphs.reduce((sum, glyph) => sum + glyphWidth(glyph), 0) + GLYPH_GAP * (glyphs.length - 1) + pad * 2;
  let x = pad;
  return (
    <svg className="card-art section-art__chip" viewBox={`0 0 ${width} ${CHIP_HEIGHT}`} aria-hidden>
      <rect x={1} y={1} width={width - 2} height={CHIP_HEIGHT - 2} rx={(CHIP_HEIGHT - 2) / 2} className="card-art__rule-bg" />
      {glyphs.map((glyph, i) => {
        const piece = <GlyphPiece key={i} glyph={glyph} x={x} y={CHIP_HEIGHT / 2} faction={faction} />;
        x += glyphWidth(glyph) + GLYPH_GAP;
        return piece;
      })}
    </svg>
  );
}

/**
 * A section card's art: the painting of the generals over their map, with a
 * chip per special rule to its right, and under it a piece of board with a
 * slim brush-stroke arrow into each section the card orders, curving up from
 * the bottom of the board, with the number of units it orders there in a
 * circle on the arrow (a number, or "Todas").
 */
export function SectionCardArt({ card, faction }: { card: CommandCard; faction: Faction }) {
  const t = useMessages(TEXT);
  const brush = useId();
  const sections = card.sections as readonly Section[];
  const hexes = boardStrip(ART_WIDTH, SECTION_ROWS, SECTION_BOARD_TOP, SECTION_HEX);
  const boardBottom = SECTION_HEIGHT - 2;
  const mid = ART_WIDTH / 2;
  const count = card.orders === "all" ? t.all : String(card.perSection ?? card.orders);
  const word = !/^\d+$/.test(count);
  const rules = sectionRules(card);
  // A lone arrow sets off near the middle; several set off spread apart so they don't cross
  const spread = sections.length === 1 ? 0.2 : 0.5;
  const [headLength, headWidth] = [11, 8];
  const tipY = SECTION_BOARD_TOP + 4;
  const arrows = sections.map((section) => {
    const cx = (ART_WIDTH / 6) * (1 + 2 * SECTIONS.indexOf(section));
    // A quadratic curve from the bottom edge, ending upright in the section
    const start = { x: mid + (cx - mid) * spread, y: boardBottom - 3 };
    const end = { x: cx, y: tipY + headLength };
    const bend = { x: cx, y: (start.y + end.y) / 2 + 6 };
    return {
      section,
      shaft: `M${start.x} ${start.y} Q${bend.x} ${bend.y} ${end.x} ${end.y}`,
      head: `M${cx} ${tipY} L${cx + headWidth} ${end.y + 1} L${cx} ${end.y - 2} L${cx - headWidth} ${end.y + 1} Z`,
      // The badge sits on the middle of the curve
      badge: { x: (start.x + 2 * bend.x + end.x) / 4, y: (start.y + 2 * bend.y + end.y) / 4 },
    };
  });
  return (
    <>
      <span className="section-art__top">
        <img className="section-art__painting" src={generalsArt} alt="" draggable={false} />
        {rules.length > 0 && (
          <span className="section-art__chips">
            {rules.map((glyphs, i) => (
              <RuleChip key={i} glyphs={glyphs} faction={faction} />
            ))}
          </span>
        )}
      </span>
      <svg
        className="card-art section-art__board"
        viewBox={`0 0 ${ART_WIDTH} ${SECTION_HEIGHT}`}
        role="img"
        aria-label={t.sections(sections.map((section) => t.sectionNames[section]).join(", "))}
      >
        <defs>
          <filter id={brush} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.12 0.05" numOctaves={2} seed={4} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={2} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect y={SECTION_BOARD_TOP - 2} width={ART_WIDTH} height={boardBottom - SECTION_BOARD_TOP + 4} rx={4} className="card-art__ground" />
        {hexes.map((hex) => (
          <polygon
            key={`${hex.x}-${hex.y}`}
            points={hexShape(hex)}
            className={`card-art__hex${sections.includes(hex.section) ? " card-art__hex--on" : ""}`}
          />
        ))}
        {[1, 2].map((i) => (
          <line key={i} x1={(ART_WIDTH / 3) * i} y1={SECTION_BOARD_TOP - 2} x2={(ART_WIDTH / 3) * i} y2={boardBottom + 2} className="card-art__divider" />
        ))}
        {arrows.map(({ section, shaft, head }) => (
          <g key={section} className="section-art__arrow" filter={`url(#${brush})`}>
            <path d={shaft} className="section-art__arrow-edge" />
            <path d={head} className="section-art__arrow-head" />
            <path d={shaft} className="section-art__arrow-shaft" />
          </g>
        ))}
        {arrows.map(({ section, badge }) => (
          <g key={section} className="section-art__badge">
            <circle cx={badge.x} cy={badge.y} r={9} />
            <text x={badge.x} y={badge.y} className={word ? "section-art__badge-word" : undefined}>
              {count}
            </text>
          </g>
        ))}
      </svg>
    </>
  );
}

// --- tactic cards (La Hora de la Verdad, Escaramuza, En marcha…)

/** Each tactic card's painting, by the card's id without its copy number; the rest show the generals for now */
const TACTIC_PAINTINGS: Record<string, string> = {
  "armor-assault": armourAssaultArt,
  "artillery-bombardment": artilleryBombardmentArt,
  "close-assault": closeAssaultArt,
  "finest-hour": finestHourArt,
  firefight: firefightArt,
  "infantry-assault": infantryAssaultArt,
  "direct-from-hq": hqArt,
  "move-out": moveOutArt,
  preparations: preparationsArt,
};

/**
 * A tactic card's art: its painting (the generals as a placeholder), with the card's
 * short summary under it. Its full text is in its details (CardDetails).
 */
export function TacticCardArt({ card }: { card: CommandCard }) {
  const tr = useTr();
  const lang = useLang();
  const painting = TACTIC_PAINTINGS[card.id.replace(/-\d+$/, "")] ?? generalsArt;
  return (
    <>
      <span className="tactic-art__painting-frame">
        <img className="tactic-art__painting" src={painting} alt="" draggable={false} />
      </span>
      <span className="tactic-art__summary" lang={lang}>
        {tr(card.summary)}
      </span>
    </>
  );
}

// --- combat cards

const COMBAT_HEX = 13.4;
const COMBAT_ROWS = 5;
const COMBAT_BOARD_HEIGHT = 3 + COMBAT_HEX * 2 + (COMBAT_ROWS - 1) * COMBAT_HEX * 1.5 + 3;

/** The hexes along the middle row, left to right */
const middleRow = (hexes: ArtHex[]) => hexes.filter((hex) => hex.row === Math.floor(COMBAT_ROWS / 2));

/** A card's copies share its id with a number on the end ("medic-2") */
const baseId = (card: CombatCard) => card.id.replace(/-\d+$/, "");

/** The rules of a combat card the app knows, as rows of pictograms */
function combatRules(card: CombatCard): Glyph[][] {
  const effect = card.effect;
  const rules: Glyph[][] = [];
  if (card.marker?.kind === "target" && effect?.kind === "attack") {
    rules.push([
      { kind: "text", text: `${card.marker.count}×` },
      { kind: "reticle" },
      { kind: "die" },
      { kind: "text", text: `${effect.dicePerHex}` },
    ]);
  }
  if (effect?.kind === "reinforcements") rules.push([{ kind: "cross" }, { kind: "die" }, { kind: "text", text: "→" }, { kind: "token", type: UnitType.INFANTRY }]);
  if (effect?.kind === "diceBonus") {
    rules.push(fireBonusGlyphs({ dice: effect.dice, unitTypes: effect.unitTypes, closeAssault: effect.closeAssault }));
  }
  if (effect?.kind === "move") {
    const type = effect.unitTypes?.[0];
    rules.push([
      { kind: "text", text: `${effect.units}×` },
      ...(type ? [{ kind: "token", type } as Glyph] : []),
      { kind: "move" },
      ...(effect.moveBonus ? [{ kind: "text", text: `+${effect.moveBonus}` } as Glyph] : []),
      ...(effect.maxMove ? [{ kind: "text", text: `${effect.maxMove}` } as Glyph] : []),
      ...(effect.fireInto || effect.ignoreTerrain ? [{ kind: "terrain" } as Glyph] : []),
      ...(effect.fireInto ? [{ kind: "fire" } as Glyph] : []),
    ]);
  }
  if (effect?.kind === "takeGround") {
    rules.push([
      { kind: "text", text: `${effect.units}×` },
      ...effect.unitTypes.map((type): Glyph => ({ kind: "token", type })),
      { kind: "move" },
      { kind: "fire" },
    ]);
  }
  return rules;
}

/** What the combat card's art shows, from its effect and marker rule */
function CombatScene({ card, faction, hexes }: { card: CombatCard; faction: Faction; hexes: ArtHex[] }) {
  const row = middleRow(hexes);
  const at = (i: number) => row[Math.min(row.length - 1, Math.max(0, i))]!;
  const mid = Math.floor(row.length / 2);
  const effect = card.effect;
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";

  if (card.marker?.kind === "target") {
    // Reticles on the marked hexes, over enemy units: in a chain for Air Power, spread out otherwise
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
          <Token key={`unit-${i}`} type={i % 2 ? UnitType.TANK : UnitType.INFANTRY} faction={enemy} x={hex.x} y={hex.y} r={8} />
        ))}
        {hexesHit.map((hex, i) => (
          <Reticle key={i} x={hex.x} y={hex.y} r={7} />
        ))}
      </>
    );
  }

  if (card.marker?.kind === "cross") {
    // Where a new unit appears: a cross on a hex, and the unit landing on it
    const hex = at(mid + 1);
    const from = at(mid - 1);
    return (
      <>
        <polygon points={hexShape(hex)} className="card-art__hex card-art__hex--on" />
        <Cross x={hex.x} y={hex.y} d={6} />
        <path d={`M${from.x + 10} ${from.y - 4} Q${(from.x + hex.x) / 2} ${hex.y - 22} ${hex.x - 7} ${hex.y - 9}`} className="card-art__path" />
        <Token type={UnitType.INFANTRY} faction={faction} x={from.x} y={from.y} ghost />
      </>
    );
  }

  if (effect?.kind === "diceBonus") {
    // The unit it helps firing at an enemy (adjacent in close assault), and the extra die
    const shooter = at(mid - 2);
    const target = effect.closeAssault ? at(mid - 1) : at(mid + 2);
    const type = effect.unitTypes[0] ?? UnitType.INFANTRY;
    /** The die above the shot, clear of the card's right edge */
    const dieX = at(effect.closeAssault ? mid : mid - 1).x;
    return (
      <>
        <path d={`M${shooter.x + 12} ${shooter.y} L${target.x - 12} ${target.y}`} className="card-art__path card-art__path--solid" />
        <Token type={type} faction={faction} x={shooter.x} y={shooter.y} r={11} />
        <Token type={UnitType.INFANTRY} faction={enemy} x={target.x} y={target.y} r={9} />
        <Reticle x={target.x} y={target.y} r={8} />
        <g transform={`translate(${dieX - 12} ${shooter.y - 30})`}>
          <rect width={24} height={24} rx={5} className="card-art__die" />
          <Icon name="dice" x={4} y={4} size={16} className="card-art__ink" />
        </g>
        <text x={dieX + 22} y={shooter.y - 12} className="card-art__bonus">
          {signed(effect.dice)}
        </text>
      </>
    );
  }

  if (effect?.kind === "move") {
    // A unit and the path it takes, longer with a move bonus; the terrain it may enter is shaded
    const type = effect.unitTypes?.[0] ?? UnitType.INFANTRY;
    const steps = Math.min(row.length - 2, effect.maxMove ?? 3 + (effect.moveBonus ?? 0));
    const startIndex = Math.max(0, mid - Math.ceil(steps / 2));
    const start = at(startIndex);
    const end = at(startIndex + steps);
    const special = effect.ignoreTerrain || effect.fireInto || effect.endOn;
    return (
      <>
        {special && <polygon points={hexShape(end)} className="card-art__hex card-art__hex--terrain" />}
        <path
          d={`M${start.x + 12} ${start.y} Q${(start.x + end.x) / 2} ${start.y - 20} ${end.x - 5} ${end.y}`}
          className="card-art__path"
        />
        <path d={`M${end.x - 11} ${end.y - 7} L${end.x - 2} ${end.y} L${end.x - 12} ${end.y + 3} z`} className="card-art__arrow" />
        <Token type={type} faction={faction} x={start.x} y={start.y} />
        {effect.fireInto && <Reticle x={at(startIndex + steps + 1).x} y={end.y} />}
      </>
    );
  }

  if (effect?.kind === "changeSection") {
    // An arrow from one section to another
    const y = COMBAT_BOARD_HEIGHT / 2;
    const from = ART_WIDTH / 6;
    const to = (ART_WIDTH / 6) * 5;
    return (
      <>
        {hexes
          .filter((hex) => hex.section !== SECTIONS[1])
          .map((hex) => (
            <polygon
              key={`${hex.x}-${hex.y}`}
              points={hexShape(hex)}
              className={`card-art__hex ${hex.section === SECTIONS[2] ? "card-art__hex--on" : "card-art__hex--faded"}`}
            />
          ))}
        <path d={`M${from} ${y + 6} Q${ART_WIDTH / 2} ${y - 36} ${to - 6} ${y}`} className="card-art__path card-art__path--solid" />
        <path d={`M${to - 14} ${y - 9} L${to - 2} ${y + 1} L${to - 15} ${y + 4} z`} className="card-art__arrow" />
      </>
    );
  }

  if (effect?.kind === "takeGround") {
    // A unit winning a close assault: it takes the hex and fires again
    const from = at(mid - 1);
    const to = at(mid);
    const next = at(mid + 1);
    return (
      <>
        <polygon points={hexShape(to)} className="card-art__hex card-art__hex--on" />
        <Token type={effect.unitTypes[0] ?? UnitType.INFANTRY} faction={faction} x={from.x} y={from.y} />
        <path d={`M${from.x + 8} ${from.y - 10} Q${to.x} ${to.y - 22} ${to.x + 2} ${to.y - 8}`} className="card-art__path" />
        <Token type={UnitType.INFANTRY} faction={enemy} x={next.x} y={next.y} r={9} />
        <Reticle x={next.x} y={next.y} r={8} />
      </>
    );
  }

  const glyph = tableGlyph(card, faction, row, mid);
  if (glyph) return glyph;

  // Resolved at the table: the emblem of when it's played, stamped on a disc
  const size = 34;
  const cx = ART_WIDTH / 2;
  const cy = COMBAT_BOARD_HEIGHT / 2;
  return (
    <>
      <circle cx={cx} cy={cy} r={31} className="card-art__seal-ring" />
      <circle cx={cx} cy={cy} r={26} className="card-art__seal" />
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
    const cx = at(mid + 1).x + 6;
    return (
      <>
        <Token type={type} faction={faction} x={at(mid - 1).x} y={y} r={15} />
        <rect x={cx - 14} y={y - 14} width={28} height={28} rx={5} className="card-art__die" />
        <path d={`M${cx - 4} ${y - 10} h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 z`} className="card-art__medic" />
      </>
    );
  }

  if (id === "fortify") {
    // Sandbags in an arc in front of a unit
    const cx = at(mid).x;
    return (
      <>
        <Token type={UnitType.INFANTRY} faction={faction} x={cx} y={y + 6} r={13} />
        {[-2, -1, 0, 1, 2].map((i) => (
          <ellipse key={i} cx={cx + i * 10} cy={y - 14 + Math.abs(i) * 4} rx={6} ry={4.2} className="card-art__sandbag" />
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
        <path d={`M${start.x - 12} ${y} Q${(start.x + end.x) / 2} ${y - 20} ${end.x + 5} ${y}`} className="card-art__path" />
        <path d={`M${end.x + 11} ${y - 7} L${end.x + 2} ${y} L${end.x + 12} ${y + 3} z`} className="card-art__arrow" />
        <Token type={type} faction={faction} x={start.x} y={y} />
        <Token type={type} faction={faction} x={end.x} y={y} ghost />
      </>
    );
  }

  if (DENIED[id]) {
    // An enemy unit, struck out
    const cx = at(mid).x;
    return (
      <>
        <Token type={DENIED[id]!} faction={enemy} x={cx} y={y} r={15} />
        <g className="card-art__denied">
          <circle cx={cx} cy={y} r={20} />
          <line x1={cx - 14} y1={y + 14} x2={cx + 14} y2={y - 14} />
        </g>
      </>
    );
  }

  if (id === "camouflage") {
    // A unit half hidden under a net
    const cx = at(mid).x;
    return (
      <>
        <Token type={UnitType.INFANTRY} faction={faction} x={cx} y={y} r={15} />
        <circle cx={cx} cy={y} r={20} className="card-art__net" />
      </>
    );
  }

  if (id === "ambush") {
    // The enemy closes in, and your unit fires first
    const own = at(mid - 1);
    const them = at(mid);
    return (
      <>
        <Token type={UnitType.INFANTRY} faction={faction} x={own.x} y={y} r={12} />
        <Token type={UnitType.INFANTRY} faction={enemy} x={them.x} y={y} r={10} />
        <Reticle x={them.x} y={y} r={8} />
        <text x={own.x} y={y - 18} className="card-art__bonus">
          1º
        </text>
      </>
    );
  }

  if (id === "rifles-up") {
    // Your unit fires before anyone else
    const own = at(mid - 1);
    const them = at(mid + 2);
    return (
      <>
        <path d={`M${own.x + 12} ${y} L${them.x - 12} ${y}`} className="card-art__path card-art__path--solid" />
        <Token type={UnitType.INFANTRY} faction={faction} x={own.x} y={y} r={12} />
        <Token type={UnitType.INFANTRY} faction={enemy} x={them.x} y={y} r={10} />
        <Reticle x={them.x} y={y} r={8} />
        <text x={own.x} y={y - 18} className="card-art__bonus">
          1º
        </text>
      </>
    );
  }

  if (id === "not-a-step-back") {
    // A unit holding its hex: the retreat arrow struck out
    const own = at(mid);
    return (
      <>
        <Token type={UnitType.INFANTRY} faction={faction} x={own.x} y={y} r={13} />
        <path d={`M${own.x - 16} ${y} L${own.x - 40} ${y}`} className="card-art__path" />
        <path d={`M${own.x - 36} ${y - 6} L${own.x - 44} ${y} L${own.x - 36} ${y + 6} z`} className="card-art__arrow" />
        <line x1={own.x - 40} y1={y + 10} x2={own.x - 20} y2={y - 10} className="card-art__strike" />
      </>
    );
  }

  if (id === "infiltrators") {
    // Behind the enemy's lines: a unit slipping past an enemy and firing
    const own = at(mid - 2);
    const them = at(mid);
    const behind = at(mid + 2);
    return (
      <>
        <Token type={UnitType.INFANTRY} faction={enemy} x={them.x} y={y} r={10} />
        <path d={`M${own.x + 10} ${y - 8} Q${them.x} ${y - 36} ${behind.x - 8} ${y - 8}`} className="card-art__path" />
        <path d={`M${behind.x - 14} ${y - 14} L${behind.x - 6} ${y - 6} L${behind.x - 16} ${y - 5} z`} className="card-art__arrow" />
        <Token type={UnitType.INFANTRY} faction={faction} x={own.x} y={y} />
        <Token type={UnitType.INFANTRY} faction={faction} x={behind.x} y={y} ghost />
      </>
    );
  }

  return null;
}

/** A combat card's art: a piece of board with what the card does on it, and pictograms for its rules */
export function CombatCardArt({ card, faction }: { card: CombatCard; faction: Faction }) {
  const hexes = boardStrip(ART_WIDTH, COMBAT_ROWS, 3, COMBAT_HEX);
  return (
    <CardFace boardHeight={COMBAT_BOARD_HEIGHT} rules={combatRules(card)} faction={faction}>
      {hexes.map((hex) => (
        <polygon key={`${hex.x}-${hex.y}`} points={hexShape(hex)} className="card-art__hex" />
      ))}
      <CombatScene card={card} faction={faction} hexes={hexes} />
    </CardFace>
  );
}
