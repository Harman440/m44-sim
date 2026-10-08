import { Button, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import { defineMessages, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Asalto cercano",
    prompt: "Toca cada unidad tuya adyacente a una unidad enemiga en la mesa: disparará en asalto cercano.",
    marked: (n: number) => (n === 1 ? "1 unidad marcada" : `${n} unidades marcadas`),
    undo: "Deshacer",
    done: "Listo",
  },
  en: {
    title: "Close assault",
    prompt: "Tap each of your units adjacent to an enemy unit on the table: it will fire in close assault.",
    marked: (n: number) => (n === 1 ? "1 unit marked" : `${n} units marked`),
    undo: "Undo",
    done: "Done",
  },
});
import "./PhaseLayout.css";

interface CloseAssaultMapProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onDone: () => void;
}

/**
 * Close Assault card: no orders were given, so in the battle the player taps
 * each of their units that is adjacent to an enemy unit on the table. Each
 * marked unit then fires once, in close assault.
 */
function CloseAssaultMap({ faction, session, game, onDone }: CloseAssaultMapProps) {
  const t = useMessages(TEXT);
  const { flash, flashInvalid } = useHexFlash();
  const marked = game.orders.length;
  const lastMarkFired = game.shots.some((shot) => shot.orderIndex === marked - 1);

  const handleTileClick = (position: Position) => {
    if (!session.markCloseAssault(position) && session.board.getHex(position)?.hasUnit()) {
      flashInvalid(position);
    }
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
          orders={game.orders}
          backgroundImage={session.scenario.image}
          invalidFlash={flash}
          orderablePositions={game.closeAssaultMarkable}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          {t.title}
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {t.prompt}
        </Typography>
        <Typography variant="body2" sx={{ textAlign: "center" }} data-testid="marked-count">
          {t.marked(marked)}
        </Typography>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {marked > 0 && !lastMarkFired && (
            <Button
              variant="outlined"
              onClick={() => session.undoCloseAssaultMark()}
              startIcon={<GameIcon name="undo" />}
            >
              {t.undo}
            </Button>
          )}
          <Button onClick={onDone} startIcon={<GameIcon name="confirm" />}>
            {t.done}
          </Button>
        </Stack>
      </div>
    </div>
  );
}

export default CloseAssaultMap;
