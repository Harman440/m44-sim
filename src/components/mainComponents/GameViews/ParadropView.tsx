import { Box, Button, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import InfoButton from "../../InfoButton";
import "./PhaseLayout.css";

interface ParadropViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
}

/**
 * Before the first turn, the paratroopers are dropped on the physical table;
 * the player taps the hex where each one landed. Those that missed the board
 * or landed on a unit are lost, so fewer can be placed.
 */
function ParadropView({ faction, session, game }: ParadropViewProps) {
  const { flash, flashInvalid } = useHexFlash();
  const total = game.drops.length + game.dropsLeft;

  const handleTileClick = (position: Position) => {
    if (!session.dropUnit(position)) flashInvalid(position);
  };

  return (
    <div className="phase-layout">
      <div className="phase-layout__board">
        <Board
          onTileClick={handleTileClick}
          unitHexPosition={null}
          possibleMovePositions={[]}
          possibleMoveAndFirePositions={[]}
          boardManager={session.board}
          orders={[]}
          backgroundImage={session.scenario.image}
          invalidFlash={flash}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          Lanzamiento de paracaidistas
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {game.dropsLeft > 0
            ? `Toca la casilla donde ha caído cada uno (quedan ${game.dropsLeft} de ${total})`
            : "Todos los paracaidistas están colocados"}
        </Typography>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {game.drops.length > 0 && (
            <Button variant="outlined" onClick={() => session.undoDrop()} startIcon={<GameIcon name="undo" />}>
              Deshacer
            </Button>
          )}
          <Button onClick={() => session.finishParadrop()} startIcon={<GameIcon name="confirm" />}>
            {game.dropsLeft > 0
              ? `Empezar (${game.dropsLeft} ${game.dropsLeft === 1 ? "perdido" : "perdidos"})`
              : "Empezar la partida"}
          </Button>
        </Stack>
        <Box sx={{ mt: "auto" }}>
          <InfoButton title="Lanzamiento de paracaidistas" label="Instrucciones">
            <Typography variant="body1">
              Deja caer tus {total} paracaidistas sobre el tablero de la mesa. Los que caigan fuera o encima de otra
              unidad se pierden. Después toca en el mapa la casilla donde ha caído cada uno.
            </Typography>
          </InfoButton>
        </Box>
      </div>
    </div>
  );
}

export default ParadropView;
