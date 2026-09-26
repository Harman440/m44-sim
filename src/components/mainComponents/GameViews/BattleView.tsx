import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { OrderSummary, summarizeOrders } from "../../../game-core/turnSummary";
import TurnSummary from "../../TurnSummary";
import DiceRoller from "../../DiceRoller";
import FireDialog from "../../FireDialog";
import BattleMap from "./BattleMap";

interface BattleViewProps {
  boardSide: string;
  session: GameSession;
  game: GameSnapshot;
  onFinishTurn: () => void;
}

/**
 * Battle phase. The battle is played on the physical board, so by default the
 * map is hidden and the whole screen shows the turn summary and dice. The map
 * is one tap away for syncing casualties and retreats.
 */
function BattleView({ boardSide, session, game, onFinishTurn }: BattleViewProps) {
  const [showMap, setShowMap] = useState(false);
  const [firingUnit, setFiringUnit] = useState<OrderSummary | null>(null);
  const summaries = summarizeOrders(game.orders, session.board);

  return (
    <>
      {showMap && (
        <BattleMap
          boardSide={boardSide}
          session={session}
          game={game}
          onShowSummary={() => setShowMap(false)}
          onFinishTurn={onFinishTurn}
        />
      )}

      {/* Hidden rather than unmounted while the map is open, so the last dice roll survives */}
      <Stack spacing={2} sx={{ width: "100%", display: showMap ? "none" : "flex" }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="h5" component="h2">
              Batalla
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Resuelve la batalla en el tablero físico. Si hay bajas o retiradas, actualízalas en el
              mapa.
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            <Button variant="outlined" onClick={() => setShowMap(true)}>
              Ver mapa
            </Button>
            <Button onClick={onFinishTurn}>Terminar Turno</Button>
          </Stack>
        </Box>

        {/* Two columns on landscape tablets, stacked in portrait */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "start",
          }}
        >
          <TurnSummary card={game.chosenCard} summaries={summaries} onFire={setFiringUnit} />
          <DiceRoller faction={boardSide} />
        </Box>
      </Stack>

      {/* Keyed by unit so every shot starts a fresh questionnaire */}
      <FireDialog
        key={firingUnit?.index ?? "closed"}
        unit={firingUnit}
        card={game.chosenCard}
        faction={boardSide}
        onClose={() => setFiringUnit(null)}
      />
    </>
  );
}

export default BattleView;
