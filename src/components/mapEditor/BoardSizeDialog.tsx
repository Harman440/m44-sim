import { ReactNode, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ToggleButton, Typography } from "@mui/material";
import { Scenario } from "../../types/scenario";
import { HexType } from "../../types/hex";
import { BOARD_LIMITS, boardSizeOf } from "../../game-core/boardSize";
import { BoardEdge, resizeBoard, resizedBoard } from "../../game-core/scenarioDraft";
import { TERRAINS, useTerrainSwatches } from "./EditorTools";
import { defineMessages, useLabels, useMessages } from "../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Tamaño del mapa",
    size: (cols: number, rows: number) => `${cols} × ${rows} casillas`,
    intro: `Crece o encoge el mapa por un borde: una columna a la izquierda o a la derecha, o dos filas arriba o abajo, para que el Eje y los Aliados tengan el mismo tablero. De ${BOARD_LIMITS.cols.min} a ${BOARD_LIMITS.cols.max} columnas y de ${BOARD_LIMITS.rows.min} a ${BOARD_LIMITS.rows.max} filas.`,
    fill: "Las casillas nuevas son de",
    shrink: "Al encoger se quita lo que haya en el borde. Se puede deshacer.",
    onlyPassAndPlay: "Un mapa más grande que el estándar se juega en Pasar y jugar o contra el ordenador.",
    edges: { top: "Arriba", bottom: "Abajo", left: "Izquierda", right: "Derecha" } satisfies Record<BoardEdge, string>,
    grow: (edge: string) => `Añadir por ${edge.toLowerCase()}`,
    shrinkEdge: (edge: string) => `Quitar por ${edge.toLowerCase()}`,
    done: "Listo",
  },
  en: {
    title: "Map size",
    size: (cols: number, rows: number) => `${cols} × ${rows} hexes`,
    intro: `Grow or shrink the map at an edge: a column on the left or right, or two rows at the top or bottom, so the Axis and the Allies have the same board. ${BOARD_LIMITS.cols.min} to ${BOARD_LIMITS.cols.max} columns and ${BOARD_LIMITS.rows.min} to ${BOARD_LIMITS.rows.max} rows.`,
    fill: "New hexes are",
    shrink: "Shrinking takes off whatever is on the edge. It can be undone.",
    onlyPassAndPlay: "A map bigger than the standard one is played in Pass and play or against the computer.",
    edges: { top: "Top", bottom: "Bottom", left: "Left", right: "Right" } satisfies Record<BoardEdge, string>,
    grow: (edge: string) => `Add at the ${edge.toLowerCase()}`,
    shrinkEdge: (edge: string) => `Take off at the ${edge.toLowerCase()}`,
    done: "Done",
  },
});

interface BoardSizeDialogProps {
  open: boolean;
  draft: Scenario;
  /** The map as it is now, drawn small, to see each change */
  preview: ReactNode;
  /** A resized map: each change is its own step to undo */
  onChange: (next: Scenario) => void;
  onClose: () => void;
}

/** Grow or shrink the map at its edges, new hexes painted with a terrain picked here */
function BoardSizeDialog({ open, draft, preview, onChange, onClose }: BoardSizeDialogProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const swatches = useTerrainSwatches();
  const [fill, setFill] = useState<HexType>(HexType.PLAINS);
  const { cols, rows } = boardSizeOf(draft);

  const resize = (edge: BoardEdge, grow: boolean) => {
    const next = resizeBoard(draft, edge, grow, fill);
    if (next) onChange(next);
  };
  const terrainName = (type: HexType) => labels.terrain[type].replace(/^./, (first) => first.toUpperCase());

  const edge = (which: BoardEdge, area: string) => (
    <Box sx={{ gridArea: area, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <Typography variant="overline" component="span" sx={{ lineHeight: 1.4 }}>
        {t.edges[which]}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <IconButton
          aria-label={t.shrinkEdge(t.edges[which])}
          disabled={!resizedBoard(draft, which, false)}
          onClick={() => resize(which, false)}
          sx={{ width: 48, height: 48, border: 1, borderColor: "divider", fontSize: 26, lineHeight: 1 }}
        >
          −
        </IconButton>
        <IconButton
          aria-label={t.grow(t.edges[which])}
          disabled={!resizedBoard(draft, which, true)}
          onClick={() => resize(which, true)}
          sx={{ width: 48, height: 48, border: 1, borderColor: "divider", fontSize: 26, lineHeight: 1 }}
        >
          +
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t.intro}</DialogContentText>
        {/* The map beside the controls when there's room (landscape), above them otherwise */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.25fr) minmax(0, 1fr)" }, gap: 2, alignItems: "start" }}>
          <Box sx={{ pointerEvents: "none" }}>{preview}</Box>
          <Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateAreas: '". top ." "left size right" ". bottom ."',
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                justifyItems: "center",
                gap: 1,
                mb: 2,
              }}
            >
              {edge("top", "top")}
              {edge("left", "left")}
              <Typography variant="h6" component="p" sx={{ gridArea: "size", px: 1, textAlign: "center" }} aria-live="polite">
                {t.size(cols, rows)}
              </Typography>
              {edge("right", "right")}
              {edge("bottom", "bottom")}
            </Box>
            <Typography variant="overline" component="h3" sx={{ lineHeight: 1.6 }}>
              {t.fill}: {terrainName(fill)}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))", gap: 0.5, mb: 2 }}>
              {TERRAINS.map((type) => (
                <ToggleButton
                  key={type}
                  value={type}
                  selected={fill === type}
                  onChange={() => setFill(type)}
                  aria-label={terrainName(type)}
                  sx={{ minHeight: 48, p: "4px !important" }}
                >
                  {swatches[type] ? (
                    <Box component="img" src={swatches[type]} alt="" sx={{ width: 36, height: 41, display: "block" }} />
                  ) : (
                    <Box sx={{ width: 36, height: 41 }} />
                  )}
                </ToggleButton>
              ))}
            </Box>
            <Typography variant="body2">{t.shrink}</Typography>
            <Typography variant="body2">{t.onlyPassAndPlay}</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          {t.done}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BoardSizeDialog;
