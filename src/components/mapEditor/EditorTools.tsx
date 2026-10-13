import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Box, ToggleButton, Typography } from "@mui/material";
import { HexType } from "../../types/hex";
import { FACTIONS, Faction } from "../../types/faction";
import { UnitType } from "../../game-core/unit";
import { EditorTool } from "../../game-core/scenarioDraft";
import { terrainSwatch } from "../../boardArt/drawBoard";
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
    unitOf: (unit: string, side: string) => `${unit} (${side})`,
    tool: (name: string) => `Tool: ${name}`,
  },
});

const TERRAINS = [
  HexType.PLAINS,
  HexType.FOREST,
  HexType.HILL,
  HexType.TOWN,
  HexType.HEDGEROW,
  HexType.RIVER,
  HexType.BRIDGE,
  HexType.LAKE,
];
const UNIT_TYPES = [UnitType.INFANTRY, UnitType.TANK, UnitType.ARTILLERY];
const MARKS = ["elite", "sandbags", "wire", "erase"] as const;

const sameTool = (a: EditorTool, b: EditorTool) => JSON.stringify(a) === JSON.stringify(b);

/** A picture of each terrain's hex, as it's drawn on the board */
function useTerrainSwatches() {
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

/** The editor's tools: a terrain, a unit of either side, a badge, sandbags, wire or the eraser */
function EditorTools({ tool, onTool }: EditorToolsProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const swatches = useTerrainSwatches();

  const toolName = (tool: EditorTool): string => {
    // The terrain's name is lower case for the middle of a sentence ("Tanque en bosque")
    if (tool.kind === "terrain") return labels.terrain[tool.type].replace(/^./, (first) => first.toUpperCase());
    if (tool.kind === "unit") return t.unitOf(labels.units[tool.type], labels.factions[tool.faction]);
    return t[tool.kind];
  };

  const button = (each: EditorTool, art: ReactNode) => (
    <ToggleButton
      key={JSON.stringify(each)}
      value={JSON.stringify(each)}
      selected={sameTool(each, tool)}
      onChange={() => onTool(each)}
      aria-label={toolName(each)}
      sx={{ minHeight: 48, p: "4px !important" }}
    >
      {art}
    </ToggleButton>
  );
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
            swatches[type] ? (
              <Box component="img" src={swatches[type]} alt="" sx={{ width: 36, height: 41, display: "block" }} />
            ) : (
              <Box sx={{ width: 36, height: 41 }} />
            ),
          ),
        )}
      </Box>

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

      <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 600 }} aria-live="polite">
        {t.tool(toolName(tool))}
      </Typography>
    </Box>
  );
}

export default EditorTools;
