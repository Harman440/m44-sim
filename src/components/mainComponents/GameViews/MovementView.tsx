import { Box, Button, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import PlayedCards from "../../PlayedCards";
import InfoButton from "../../InfoButton";
import { coinsText } from "../../../labels";
import "./PhaseLayout.css";

interface MovementViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
}

const noop = () => {};

/**
 * Movement phase: both players show their maps, then move the pieces on the
 * table. The map here is read-only; it shows what to move, and the cards
 * played this turn sit above the instructions for the opponent to read.
 */
function MovementView({ faction, session, game }: MovementViewProps) {
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
          markers={game.markers}
          markerKind={game.orderCombatCard?.marker?.kind}
          backgroundImage={session.scenario.image}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" component="h2" sx={{ textAlign: "center" }}>
          Fase Movimiento
        </Typography>
        <PlayedCards
          faction={faction}
          command={game.chosenCard}
          section={game.chosenSection}
          combat={game.orderCombatCard}
        />
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          Enseña el mapa al rival y mueve en la mesa las unidades con flecha
        </Typography>
        <Button onClick={() => session.startBattle()} startIcon={<GameIcon name="battle" />}>
          Fase Batalla
        </Button>
        <Box sx={{ mt: "auto" }}>
          <InfoButton title="Fase Movimiento" label="Instrucciones">
            <Box component="ol" sx={{ m: 0, pl: 3, display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="li" variant="body1">
                Enseña esta pantalla al rival, con el mapa y las cartas, y mira la suya. Toca una carta para leerla entera.
              </Typography>
              {game.orderCombatCard && (
                <Typography component="li" variant="body1" data-testid="order-combat-card">
                  Juegas <strong>{game.orderCombatCard.name}</strong> (coste: {coinsText(game.orderCombatCard.cost)}, ya
                  restado del contador): {game.orderCombatCard.description}
                </Typography>
              )}
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
          </InfoButton>
        </Box>
      </div>
    </div>
  );
}

export default MovementView;
