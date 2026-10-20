import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Box, ToggleButton, Typography } from "@mui/material";
import { HexType } from "../../types/hex";
import { FACTIONS, Faction } from "../../types/faction";
import { UnitType } from "../../game-core/unit";
import { EditorTool } from "../../game-core/scenarioDraft";
import { terrainSwatch, tilesFor } from "../../boardArt/drawBoard";
import { unitSprite } from "../UnitComponent";
import SandbagsIcon from "../SandbagsIcon";
import { BarbedWireIcon } from "../BarbedWire";
import GameIcon from "../GameIcon";
import { FACTION_COLORS } from "../../looks/looks";
import { defineMessages, useLabels, useMessages } from "../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    terrain: "Terreno",
    units: "Unidades",
    marks: "Marcas",
    elite: "De élite",
    sandbags: "Sacos terreros",
    wire: "Alambrada",
    erase: "Borrar",
    objectives: "Objetivos",
    townTiles: "Losetas de pueblo",
    randomTile: "Al azar",
    tileOf: (terrain: string, n: number) => `${terrain} (loseta ${n})`,
    objectiveOf: (side: string) => `Objetivo (${side})`,
    unitOf: (unit: string, side: string) => `${unit} (${side})`,
    tool: (name: string) => `Herramienta: ${name}`,
  },
  en: {
    terrain: "Terrain",
    units: "Units",
    marks: "Marks",
    elite: "Elite",
    sandbags: "Sandbags",
    wire: "Barbed wire",
    erase: "Clear",
    objectives: "Objectives",
    townTiles: "Town tiles",
    randomTile: "Random",
    tileOf: (terrain: string, n: number) => `${terrain} (tile ${n})`,
    objectiveOf: (side: string) => `Objective (${side})`,
    unitOf: (unit: string, side: string) => `${unit} (${side})`,
    tool: (name: string) => `Tool: ${name}`,
  },
});

export const TERRAINS = [
  HexType.PLAINS,
  HexType.FOREST,
  HexType.HILL,
  HexType.TOWN,
  HexType.HEDGEROW,
  HexType.RIVER,
  HexType.BRIDGE,
  HexType.LAKE,
  HexType.BEACH,
  HexType.SWAMP,
  HexType.OCEAN,
];
const UNIT_TYPES = [UnitType.INFANTRY, UnitType.TANK, UnitType.ARTILLERY];
const MARKS = ["elite", "sandbags", "wire", "erase"] as const;

const sameTool = (a: EditorTool, b: EditorTool) => JSON.stringify(a) === JSON.stringify(b);

/** Terrain whose painted tile the editor lets the player pick, hex by hex */
const PICKABLE: HexType[] = [HexType.TOWN];

/** A picture of each of a terrain's tiles, by tile, drawn once `type` is given */
function useTileSwatches(type: HexType | undefined) {
  const [swatches, setSwatches] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!type) return;
    let current = true;
    tilesFor(type).forEach((tile) =>
      terrainSwatch(type, tile).then(
        (url) => current && setSwatches((before) => ({ ...before, [tile]: url })),
        () => {},
      ),
    );
    return () => {
      current = false;
    };
  }, [type]);
  return swatches;
}

/** A picture of each terrain's hex, as it's drawn on the board */
export function useTerrainSwatches() {
  const [swatches, setSwatches] = useState<Partial<Record<HexType, string>>>({});
  useEffect(() => {
    let current = true;
    TERRAINS.forEach((type) =>
      terrainSwatch(type).then(
        (url) => current && setSwatches((before) => ({ ...before, [type]: url })),
        () => {},
      ),
    );
    return () => {
      current = false;
    };
  }, []);
  return swatches;
}

const EliteStar = () => (
  <svg width={30} height={30} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" fill="#e8c44a" stroke="#6b5310" strokeWidth="1.2" />
  </svg>
);

interface EditorToolsProps {
  tool: EditorTool;
  onTool: (tool: EditorTool) => void;
}

/** The editor's tools: a terrain, a unit of either side, a badge, sandbags, wire, the eraser or a side's objective */
function EditorTools({ tool, onTool }: EditorToolsProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const swatches = useTerrainSwatches();
  const picking = tool.kind === "terrain" && PICKABLE.includes(tool.type) ? tool.type : undefined;
  const tileSwatches = useTileSwatches(picking);
  const pickable = picking ? tilesFor(picking) : [];

  const toolName = (tool: EditorTool): string => {
    if (tool.kind === "terrain") {
      // The terrain's name is lower case for the middle of a sentence ("Tanque en bosque")
      const terrain = labels.terrain[tool.type].replace(/^./, (first) => first.toUpperCase());
      return tool.tile ? t.tileOf(terrain, tilesFor(tool.type).indexOf(tool.tile) + 1) : terrain;
    }
    if (tool.kind === "unit") return t.unitOf(labels.units[tool.type], labels.factions[tool.faction]);
    if (tool.kind === "objective") return t.objectiveOf(labels.factions[tool.faction]);
    return t[tool.kind];
  };

  const button = (each: EditorTool, art: ReactNode, selected = sameTool(each, tool), label = toolName(each)) => (
    <ToggleButton
      key={JSON.stringify(each)}
      value={JSON.stringify(each)}
      selected={selected}
      onChange={() => onTool(each)}
      aria-label={label}
      sx={{ minHeight: 48, p: "4px !important" }}
    >
      {art}
    </ToggleButton>
  );
  const swatch = (url: string | undefined) =>
    url ? <Box component="img" src={url} alt="" sx={{ width: 36, height: 41, display: "block" }} /> : <Box sx={{ width: 36, height: 41 }} />;
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))", gap: 0.5 };
  const heading = (text: string) => (
    <Typography variant="overline" component="h3" sx={{ lineHeight: 1.6 }}>
      {text}
    </Typography>
  );

  return (
    <Box sx={{ width: "100%" }}>
      {heading(t.terrain)}
      <Box sx={grid}>
        {TERRAINS.map((type) =>
          button(
            { kind: "terrain", type },
            swatch(swatches[type]),
            // A town with a tile picked is still the town tool
            tool.kind === "terrain" && tool.type === type,
          ),
        )}
      </Box>

      {picking && pickable.length > 1 && (
        <>
          {heading(t.townTiles)}
          <Box sx={grid}>
            {button(
              { kind: "terrain", type: picking },
              <GameIcon name="dice" size={28} />,
              !(tool.kind === "terrain" && tool.tile),
              t.randomTile,
            )}
            {pickable.map((tile) => button({ kind: "terrain", type: picking, tile }, swatch(tileSwatches[tile])))}
          </Box>
        </>
      )}

      {heading(t.units)}
      <Box sx={grid}>
        {FACTIONS.flatMap((faction: Faction) =>
          UNIT_TYPES.map((type) =>
            button(
              { kind: "unit", faction, type },
              <Box
                sx={{ width: 38, height: 38, borderRadius: "50%", bgcolor: FACTION_COLORS[faction], display: "grid", placeItems: "center" }}
              >
                <Box component="img" src={unitSprite(faction, type)} alt="" sx={{ width: 30, height: 30, objectFit: "contain" }} />
              </Box>,
            ),
          ),
        )}
      </Box>

      {heading(t.marks)}
      <Box sx={grid}>
        {MARKS.map((kind) =>
          button(
            { kind },
            kind === "elite" ? (
              <EliteStar />
            ) : kind === "sandbags" ? (
              <SandbagsIcon size={34} />
            ) : kind === "wire" ? (
              <BarbedWireIcon size={34} />
            ) : (
              <GameIcon name="cancel" size={28} />
            ),
          ),
        )}
      </Box>

      {heading(t.objectives)}
      <Box sx={grid}>
        {FACTIONS.map((faction: Faction) =>
          button(
            { kind: "objective", faction },
            <Box
              sx={{ width: 38, height: 38, borderRadius: "50%", bgcolor: FACTION_COLORS[faction], color: "var(--m44-paper)", display: "grid", placeItems: "center" }}
            >
              <GameIcon name="medal" size={26} />
            </Box>,
          ),
        )}
      </Box>

      <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 600 }} aria-live="polite">
        {t.tool(toolName(tool))}
      </Typography>
    </Box>
  );
}

export default EditorTools;
