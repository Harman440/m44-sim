import { Box, Button, Dialog, Stack, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { Faction } from "../../../types/faction";
import { FACTION_LABELS } from "../../../labels";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import "./PhaseLayout.css";

interface OpponentMapProps {
  open: boolean;
  onClose: () => void;
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
}

const noop = () => {};

/**
 * The orders full screen, to turn the tablet round and show the opponent
 * (house rules: both players show their maps at the start of the movement
 * phase). Read-only: arrows are moves, the red crosshair marks units that fire.
 */
function OpponentMap({ open, onClose, faction, session, game }: OpponentMapProps) {
  return (
    <Dialog fullScreen open={open} onClose={onClose} aria-labelledby="opponent-map-title">
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", p: 1.5, gap: 1, bgcolor: "background.default" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Box>
            <Typography id="opponent-map-title" variant="h6" component="h2">
              Órdenes de {FACTION_LABELS[faction]} · Turno {game.turn}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Flecha: movimiento · Diana roja: dispara
            </Typography>
          </Box>
          <Button variant="outlined" onClick={onClose} startIcon={<GameIcon name="cancel" />}>
            Cerrar
          </Button>
        </Stack>
        <Box className="opponent-map">
          <Board
            onTileClick={noop}
            unitHexPosition={null}
            possibleMovePositions={[]}
            possibleMoveAndFirePositions={[]}
            boardManager={session.board}
            orders={game.orders}
            backgroundImage={session.scenario.image}
            faction={faction}
          />
        </Box>
      </Box>
    </Dialog>
  );
}

export default OpponentMap;
