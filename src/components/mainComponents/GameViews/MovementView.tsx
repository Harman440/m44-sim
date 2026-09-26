import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import OpponentMap from "./OpponentMap";
import "./PhaseLayout.css";

interface MovementViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
}

const noop = () => {};

/**
 * Movement phase: both players show their maps, then move the pieces on the
 * table. The map here is read-only; it shows what to move.
 */
function MovementView({ faction, session, game }: MovementViewProps) {
  const [showingOpponent, setShowingOpponent] = useState(false);
  const firing = game.orders.filter((order) => order.canFire).length;

  return (
    <div className="phase-layout">
      <div className="phase-layout__board">
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
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" component="h2" sx={{ textAlign: "center" }}>
          Fase Movimiento
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 3, display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography component="li" variant="body1">
            Enseña tu mapa al rival y mira el suyo.
          </Typography>
          <Typography component="li" variant="body1">
            Mueve en la mesa las unidades con flecha.
          </Typography>
          {firing > 0 && (
            <Typography component="li" variant="body1">
              Pon un marcador de batalla en{" "}
              {firing === 1 ? "la unidad que dispara" : `las ${firing} unidades que disparan`}.
            </Typography>
          )}
        </Box>
        <Button variant="outlined" onClick={() => setShowingOpponent(true)} startIcon={<GameIcon name="map" />}>
          Mostrar al rival
        </Button>
        <Button onClick={() => session.startBattle()} startIcon={<GameIcon name="battle" />}>
          Fase Batalla
        </Button>
      </div>

      <OpponentMap
        open={showingOpponent}
        onClose={() => setShowingOpponent(false)}
        faction={faction}
        session={session}
        game={game}
      />
    </div>
  );
}

export default MovementView;
