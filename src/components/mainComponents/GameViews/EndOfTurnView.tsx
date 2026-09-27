import { useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { Faction } from "../../../types/faction";
import CommandCardComponent from "../../CommandCardComponent";
import GameIcon from "../../GameIcon";
import EndOfTurnMap from "./EndOfTurnMap";

interface EndOfTurnViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onDrawCard: () => void;
  onEndTurn: () => void;
}

/**
 * Fase final: make the retreats marked in battle on the table and mirror the
 * casualties, retreats and ground taken on the map, then draw a command card
 */
function EndOfTurnView({ faction, session, game, onDrawCard, onEndTurn }: EndOfTurnViewProps) {
  const { drawnCard } = game;
  const [showMap, setShowMap] = useState(false);

  if (showMap) {
    return <EndOfTurnMap faction={faction} session={session} game={game} onDone={() => setShowMap(false)} />;
  }

  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 640, mx: "auto" }}>
      <Typography variant="h5" component="h2">
        Fase final
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h3">
          1. Retiradas y bajas
        </Typography>
        <Typography variant="body1">
          Haz en la mesa las retiradas marcadas en la batalla. Después refleja en el mapa las unidades
          eliminadas y las que se han movido (retiradas o terreno tomado), de los dos bandos.
        </Typography>
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5, mt: 1.5 }}>
          <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
            Actualizar mapa
          </Button>
          {game.battleEdits > 0 && (
            <Typography variant="body2" color="text.secondary" data-testid="map-edits">
              {game.battleEdits === 1 ? "1 cambio" : `${game.battleEdits} cambios`} en el mapa
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box>
          <Typography variant="h6" component="h3">
            2. Carta de mando
          </Typography>
          <Typography variant="body1">Roba una carta de tu mazo.</Typography>
        </Box>
        {drawnCard ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Has robado:
            </Typography>
            <CommandCardComponent cardData={drawnCard} />
          </Box>
        ) : (
          <Button onClick={onDrawCard} startIcon={<GameIcon name="cards" />} sx={{ alignSelf: "flex-start" }}>
            Robar carta
          </Button>
        )}
      </Paper>

      {drawnCard && (
        <Button size="large" onClick={onEndTurn} startIcon={<GameIcon name="endTurn" />} sx={{ alignSelf: "center" }}>
          Empezar turno {game.turn + 1}
        </Button>
      )}
    </Stack>
  );
}

export default EndOfTurnView;
