import { Box, Button, Stack, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import PlayedCards from "../../PlayedCards";
import InfoButton from "../../InfoButton";
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
 * Read-only map of the battle phase: the orders and which units have fired,
 * laid out like Movimiento, with the cards played this turn. Casualties and
 * retreats are mirrored on the map in the final phase, once the battle is
 * over on the table.
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
          markers={game.markers}
          markerKind={game.orderCombatCard?.marker?.kind}
          backgroundImage={session.scenario.image}
          firedUnits={firedUnits}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" component="h2" sx={{ textAlign: "center" }}>
          Mapa de batalla
        </Typography>
        <PlayedCards
          faction={faction}
          command={game.chosenCard}
          section={game.chosenSection}
          combat={game.orderCombatCard}
        />

        <Stack sx={{ gap: 1, width: "100%" }}>
          <Button variant="outlined" onClick={onShowSummary} startIcon={<GameIcon name="battle" />}>
            Volver a la batalla
          </Button>
          <Button onClick={onEndBattle} startIcon={<GameIcon name="endTurn" />}>
            Terminar batalla
          </Button>
        </Stack>
        <Box sx={{ mt: "auto" }}>
          <InfoButton title="Mapa de batalla" label="Instrucciones">
            <Typography variant="body1">
              El mapa muestra las órdenes y qué unidades ya han disparado. Toca una carta para leerla entera. Las bajas y
              retiradas se reflejan en el mapa en la fase final.
            </Typography>
          </InfoButton>
        </Box>
      </div>
    </div>
  );
}

export default BattleMap;
