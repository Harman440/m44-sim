import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { GameSnapshot } from "../../../game-core/gameSession";
import CommandCardComponent from "../../CommandCardComponent";
import GameIcon from "../../GameIcon";

interface EndOfTurnViewProps {
  game: GameSnapshot;
  /** This device's side attacks, so it draws first */
  attacking: boolean;
  onDrawCard: () => void;
  onEndTurn: () => void;
}

/** Fase final: finish the retreats on the table, then draw a command card */
function EndOfTurnView({ game, attacking, onDrawCard, onEndTurn }: EndOfTurnViewProps) {
  const { drawnCard } = game;

  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 640, mx: "auto" }}>
      <Typography variant="h5" component="h2">
        Fase final
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h3">
          1. Retiradas
        </Typography>
        <Typography variant="body1">Termina en la mesa las retiradas de la batalla.</Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box>
          <Typography variant="h6" component="h3">
            2. Carta de mando
          </Typography>
          <Typography variant="body1">
            {attacking
              ? "Robas primero: eres el bando atacante."
              : "Roba después del rival: el bando atacante roba primero."}
          </Typography>
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
