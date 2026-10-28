import { useContext } from "react";
import { Box } from "@mui/material";
import { Faction } from "../../../types/faction";
import GameSession from "../../../game-core/gameSession";
import Board from "../../Board";
import { OpponentContext } from "../../OpponentContext";
import "./LargeMap.css";

interface LargeMapProps {
  session: GameSession;
  faction: Faction;
}

const noop = () => {};

/**
 * Pass and play: the read-only map of both armies as they stand (without this
 * turn's order arrows), zoomable and as large as the space it's given allows:
 * beside the cards to pick in the Command Zone and the final phase, and alone
 * when the cards are put away (see `HandAwayBar`)
 */
function LargeMap({ session, faction }: LargeMapProps) {
  const shared = useContext(OpponentContext);
  const game = session.getSnapshot();
  const opponent = shared ? { ...shared.opponent, orders: [] } : null;
  return (
    <Box className="large-map" data-testid="large-map">
      <div className="large-map__fit">
        <Board
          zoomable
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
      </div>
    </Box>
  );
}

export default LargeMap;
