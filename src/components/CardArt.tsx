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
import "./CardArt.css";

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

// --- command cards

const COMMAND_HEX = 13.4;
const COMMAND_ROWS = 5;
const COMMAND_BOARD_HEIGHT = 4 + COMMAND_HEX * 2 + (COMMAND_ROWS - 1) * COMMAND_HEX * 1.5 + 4;

/** The unit art used for a card that orders any type: a mix, as on the table */
const ANY_UNIT = [UnitType.INFANTRY, UnitType.TANK, UnitType.INFANTRY, UnitType.ARTILLERY, UnitType.INFANTRY, UnitType.TANK];

/** The special rules of a command card, as rows of pictograms */
function commandRules(card: CommandCard): Glyph[][] {
  const rules: Glyph[][] = [];
  if (card.onTheMove > 0) {
    rules.push([
      { kind: "text", text: `+${card.onTheMove}` },
      { kind: "token", type: UnitType.INFANTRY, ghost: true },
      { kind: "move" },
      { kind: "fire", struck: true },
    ]);
  }
  if (card.noMove) rules.push([{ kind: "move", struck: true }, { kind: "fire" }]);
  if (card.moveBonus > 0) rules.push([{ kind: "move" }, { kind: "text", text: `+${card.moveBonus}` }, { kind: "fire" }]);
  if (card.holdShots > 1) {
    rules.push([{ kind: "move", struck: true }, ...Array.from({ length: card.holdShots }, (): Glyph => ({ kind: "fire" }))]);
  }
  if (card.maxMove !== null) {
    rules.push([{ kind: "move" }, { kind: "text", text: `${card.maxMove}` }, { kind: "fire", struck: true }]);
  }
  card.fireBonus.forEach((bonus) => rules.push(fireBonusGlyphs(bonus)));
  if (card.paidInCoins) {
    rules.push([
      { kind: "crate" },
      ...Object.values(UnitType)
        .filter((type) => card.coinCostOf(type) > 0)
        .flatMap((type): Glyph[] => [
          { kind: "token", type },
          { kind: "text", text: String(card.coinCostOf(type)) },
        ]),
    ]);
  }
  if (card.drawChoice > 1) {
    rules.push([{ kind: "cards", count: card.drawChoice }, { kind: "text", text: `${card.drawChoice}→1` }]);
  }
  if (card.endOfTurnReward) {
    rules.push([
      { kind: "crate" },
      { kind: "text", text: `+${card.endOfTurnReward.coins}` },
      ...(card.endOfTurnReward.combatCard ? [{ kind: "cards", count: 1 } as Glyph, { kind: "text", text: "+1" } as Glyph] : []),
    ]);
  }
  return rules;
}

/** Hexes of a section, the ones nearest its middle first */
function sectionHexes(hexes: ArtHex[], section: Section): ArtHex[] {
  const i = SECTIONS.indexOf(section);
  const cx = (ART_WIDTH / 6) * (1 + 2 * i);
  const cy = COMMAND_BOARD_HEIGHT / 2;
  return hexes
    .filter((hex) => hex.section === section)
    .sort((a, b) => Math.hypot(a.x - cx, (a.y - cy) * 1.4) - Math.hypot(b.x - cx, (b.y - cy) * 1.4));
}

/** Where the ordered units stand: how many in each section, as the card deals them out */
function orderedPerSection(card: CommandCard, active: readonly Section[]): Map<Section, number> {
  const counts = new Map<Section, number>();
  if (card.orders === "all") {
    // Enough to read as "all of them" without hiding the section
    active.forEach((section) => counts.set(section, active.length === 1 ? 5 : 3));
  } else if (card.perSection !== null) {
    active.forEach((section) => counts.set(section, card.perSection!));
  } else {
    // Dealt out from the middle: centre, left, right, centre…
    const order = active.length === 3 ? [SECTIONS[1]!, SECTIONS[0]!, SECTIONS[2]!] : active;
    for (let i = 0; i < card.orders; i++) {
      const section = order[i % order.length]!;
      counts.set(section, (counts.get(section) ?? 0) + 1);
    }
  }
  return counts;
}

const SECTION_NAMES: Record<Section, string> = { left: "Izquierda", center: "Centro", right: "Derecha" };

/**
 * A command card's art: a piece of the board with the sections it orders
 * tinted (hatched when the player picks one) and a token on a hex for each
 * unit it orders, then a row of pictograms per special rule
 */
export function CommandCardArt({ card, faction }: { card: CommandCard; faction: Faction }) {
  const hatch = useId();
  const hexes = boardStrip(ART_WIDTH, COMMAND_ROWS, 4, COMMAND_HEX);
  const chosen = card.sections === "chosen";
  const sections = chosen ? SECTIONS : (card.sections as readonly Section[]);
  const tinted = (section: Section) => !chosen && sections.includes(section);
  const label = chosen ? "una a elegir" : SECTIONS.filter(tinted).map((s) => SECTION_NAMES[s]).join(", ");
  const types = card.unitTypes ?? ANY_UNIT;
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";

  // The ordered units: in one section (the middle one stands for "any") when the player picks it
  const tokens: { hex: ArtHex; type: UnitType; enemy?: boolean; ghost?: boolean }[] = [];
  if (card.closeAssaultOnly) {
    // Own units next to enemy units, along the middle of the board
    [SECTIONS[0]!, SECTIONS[2]!].forEach((section) => {
      const [own, ...rest] = sectionHexes(hexes, section).filter((hex) => hex.row === 2);
      const next = rest.find((hex) => Math.abs(hex.x - own!.x) < COMMAND_HEX * 2);
      tokens.push({ hex: own!, type: types[tokens.length % types.length]! });
      if (next) tokens.push({ hex: next, type: UnitType.INFANTRY, enemy: true });
    });
  } else {
    const counts = orderedPerSection(card, chosen ? [SECTIONS[1]!] : sections);
    counts.forEach((count, section) => {
      sectionHexes(hexes, section)
        .slice(0, count)
        .forEach((hex) => tokens.push({ hex, type: types[tokens.length % types.length]! }));
    });
    if (card.onTheMove > 0) {
      // A unit anywhere that only moves: in a section the card doesn't order, if there is one
      const away = SECTIONS.find((section) => !sections.includes(section)) ?? SECTIONS[2]!;
      const taken = new Set(tokens.map((t) => t.hex));
      const hex = sectionHexes(hexes, away).find((h) => !taken.has(h) && h.row === 3) ?? sectionHexes(hexes, away)[0]!;
      tokens.push({ hex, type: UnitType.INFANTRY, ghost: true });
    }
  }
  const tokenAt = new Set(tokens.map((t) => t.hex));

  return (
    <CardFace
      label={`Secciones: ${label}`}
      boardHeight={COMMAND_BOARD_HEIGHT}
      rules={commandRules(card)}
      faction={faction}
      defs={
        <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" className="card-art__hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="5" className="card-art__hatch-line" />
        </pattern>
      }
    >
      {hexes.map((hex) => (
        <polygon
          key={`${hex.x}-${hex.y}`}
          points={hexShape(hex)}
          className={`card-art__hex${tinted(hex.section) ? " card-art__hex--on" : ""}${tokenAt.has(hex) && !chosen ? " card-art__hex--ordered" : ""}`}
          fill={chosen ? `url(#${hatch})` : undefined}
        />
      ))}
      {[1, 2].map((i) => (
        <line key={i} x1={(ART_WIDTH / 3) * i} y1={0} x2={(ART_WIDTH / 3) * i} y2={COMMAND_BOARD_HEIGHT} className="card-art__divider" />
      ))}
      {tokens.map(({ hex, type, enemy: isEnemy, ghost }, i) => (
        <Token key={i} type={type} faction={isEnemy ? enemy : faction} x={hex.x} y={hex.y} r={COMMAND_HEX * 0.82} ghost={ghost} />
      ))}
      {chosen &&
        // "Which one?": a question mark on each section
        SECTIONS.map((section, i) => (
          <text key={section} x={(ART_WIDTH / 6) * (1 + 2 * i)} y={16} className="card-art__quota">
            ?
          </text>
        ))}
      {card.perSection !== null &&
        !chosen &&
        sections.map((section) => (
          <text key={section} x={(ART_WIDTH / 6) * (1 + 2 * SECTIONS.indexOf(section))} y={COMMAND_BOARD_HEIGHT - 5} className="card-art__quota">
            ×{card.perSection}
          </text>
        ))}
    </CardFace>
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
