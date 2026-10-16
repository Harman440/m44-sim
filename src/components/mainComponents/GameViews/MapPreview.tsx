import { useContext, useState } from "react";
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { Faction } from "../../../types/faction";
import GameSession from "../../../game-core/gameSession";
import Board from "../../Board";
import { OpponentContext } from "../../OpponentContext";
import { defineMessages, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Mapa",
    open: "Ver el mapa en grande",
    close: "Cerrar",
  },
  en: {
    title: "Map",
    open: "Show the map large",
    close: "Close",
  },
});

interface MapPreviewProps {
  session: GameSession;
  faction: Faction;
  /** Height of the small map, in px */
  height?: number;
}

const noop = () => {};

/**
 * Pass and play: a small read-only map of both armies as they stand, for picking cards and the
 * final phase; a tap shows it large
 */
function MapPreview({ session, faction, height = 140 }: MapPreviewProps) {
  const t = useMessages(TEXT);
  const [open, setOpen] = useState(false);
  const shared = useContext(OpponentContext);
  const game = session.getSnapshot();
  // Where the armies stand, without this turn's order arrows
  const opponent = shared ? { ...shared.opponent, orders: [] } : null;

  const board = (
    <Board
      onTileClick={noop}
      unitHexPosition={null}
      possibleMovePositions={[]}
      possibleMoveAndFirePositions={[]}
      boardManager={session.board}
      orders={[]}
      backgroundImage={session.scenario.image}
      faction={faction}
      opponent={opponent}
      strength={game.strength}
      camouflaged={game.camouflaged}
    />
  );

  return (
    <>
      <ButtonBase
        onClick={() => setOpen(true)}
        aria-label={t.open}
        data-testid="map-preview"
        sx={{ flex: "none", display: "block", width: height * 1.6, maxWidth: "100%", borderRadius: "var(--m44-radius)" }}
      >
        {/* The board takes no taps here: the whole preview is one button */}
        <Box sx={{ pointerEvents: "none" }}>{board}</Box>
      </ButtonBase>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{t.title}</DialogTitle>
        {/* As large as fits both ways: --board-aspect is set by Board */}
        <DialogContent sx={{ "& .board__svg": { width: "min(100%, calc((100dvh - 200px) * var(--board-aspect)))" } }}>
          {board}
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setOpen(false)}>
            {t.close}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default MapPreview;
