import { Box, Button, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import InfoButton from "../../InfoButton";
import { defineMessages, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Lanzamiento de paracaidistas",
    tapEach: (left: number, total: number) => `Toca la casilla donde ha caído cada uno (quedan ${left} de ${total})`,
    allPlaced: "Todos los paracaidistas están colocados",
    undo: "Deshacer",
    startLost: (lost: number) => `Empezar (${lost} ${lost === 1 ? "perdido" : "perdidos"})`,
    startGame: "Empezar la partida",
    instructions: "Instrucciones",
    help: (total: number) =>
      `Deja caer tus ${total} paracaidistas sobre el tablero de la mesa. Los que caigan fuera o encima de otra unidad se pierden. Después toca en el mapa la casilla donde ha caído cada uno.`,
  },
  en: {
    title: "Paratrooper drop",
    tapEach: (left: number, total: number) => `Tap the hex where each one landed (${left} of ${total} left)`,
    allPlaced: "All the paratroopers are placed",
    undo: "Undo",
    startLost: (lost: number) => `Start (${lost} lost)`,
    startGame: "Start the game",
    instructions: "Instructions",
    help: (total: number) =>
      `Drop your ${total} paratroopers onto the board on the table. Those that land off the board or on top of another unit are lost. Then tap on the map the hex where each one landed.`,
  },
});
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
  const t = useMessages(TEXT);
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
          {t.title}
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {game.dropsLeft > 0 ? t.tapEach(game.dropsLeft, total) : t.allPlaced}
        </Typography>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {game.drops.length > 0 && (
            <Button variant="outlined" onClick={() => session.undoDrop()} startIcon={<GameIcon name="undo" />}>
              {t.undo}
            </Button>
          )}
          <Button onClick={() => session.finishParadrop()} startIcon={<GameIcon name="confirm" />}>
            {game.dropsLeft > 0 ? t.startLost(game.dropsLeft) : t.startGame}
          </Button>
        </Stack>
        <Box sx={{ mt: "auto" }}>
          <InfoButton title={t.title} label={t.instructions}>
            <Typography variant="body1">{t.help(total)}</Typography>
          </InfoButton>
        </Box>
      </div>
    </div>
  );
}

export default ParadropView;
