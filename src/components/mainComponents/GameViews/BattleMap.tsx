import { Button, Stack, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import "./PhaseLayout.css";

interface BattleMapProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onShowSummary: () => void;
  onEndBattle: () => void;
}

const noop = () => {};

/**
 * Read-only map of the battle phase: the orders and which units have fired.
 * Casualties and retreats are mirrored on the map in the final phase, once
 * the battle is over on the table.
 */
function BattleMap({ faction, session, game, onShowSummary, onEndBattle }: BattleMapProps) {
  // Units that have used all their shots get a check badge on the map
  const firedUnits = new Set(
    game.orders
      .filter((order, i) => game.shots.filter((s) => s.orderIndex === i).length >= order.shots)
      .map((order) => order.unit)
  );

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
          firedUnits={firedUnits}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          Fase Batalla
        </Typography>
        <Typography variant="body1" sx={{ textAlign: "center" }}>
          Las bajas y retiradas se reflejan en el mapa en la fase final.
        </Typography>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          <Button variant="outlined" onClick={onShowSummary}>
            Volver al resumen
          </Button>
          <Button onClick={onEndBattle} startIcon={<GameIcon name="endTurn" />}>
            Terminar batalla
          </Button>
        </Stack>
      </div>
    </div>
  );
}

export default BattleMap;
