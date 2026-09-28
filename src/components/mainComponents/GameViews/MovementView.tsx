import { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import CommandCardComponent, { ruleTags } from "../../CommandCardComponent";
import CombatCardComponent from "../../CombatCardComponent";
import CardDetails from "../../CardDetails";
import { COMBAT_PHASE_LABELS, coinsText, SECTION_LABELS } from "../../../labels";
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
 * Tapping a card shows its full text, which the small card fades out.
 */
function MovementView({ faction, session, game }: MovementViewProps) {
  const firing = game.orders.filter((order) => order.canFire).length;
  const [looking, setLooking] = useState<"command" | "combat" | null>(null);
  const { chosenCard, orderCombatCard } = game;

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
        {/* The cards played in the orders phase */}
        <Box className="movement__cards" data-testid="played-cards">
          {game.chosenCard && (
            <Stack sx={{ alignItems: "center", gap: 0.5 }}>
              <CommandCardComponent faction={faction} cardData={game.chosenCard} onClick={() => setLooking("command")} />
              {game.chosenSection && (
                <Typography variant="body2">Sección: {SECTION_LABELS[game.chosenSection]}</Typography>
              )}
            </Stack>
          )}
          {game.orderCombatCard && (
            <CombatCardComponent faction={faction} card={game.orderCombatCard} onClick={() => setLooking("combat")} />
          )}
        </Box>
        <Box component="ol" sx={{ m: 0, pl: 3, display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography component="li" variant="body1">
            Enseña esta pantalla al rival, con el mapa y las cartas, y mira la suya. Toca una carta para leerla entera.
          </Typography>
          {game.orderCombatCard && (
            <Typography component="li" variant="body1" data-testid="order-combat-card">
              Juegas <strong>{game.orderCombatCard.name}</strong> (coste: {coinsText(game.orderCombatCard.cost)}, ya restado
              del contador): {game.orderCombatCard.description}
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
        <Button onClick={() => session.startBattle()} startIcon={<GameIcon name="battle" />}>
          Fase Batalla
        </Button>
      </div>

      <Dialog
        open={looking !== null}
        onClose={() => setLooking(null)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { "aria-label": "Carta jugada" } }}
      >
        <DialogContent>
          {looking === "command" && chosenCard && (
            <CardDetails
              card={<CommandCardComponent faction={faction} cardData={chosenCard} />}
              cardWidth={220}
              name={chosenCard.name}
              tags={[...ruleTags(chosenCard), ...(game.chosenSection ? [`Sección: ${SECTION_LABELS[game.chosenSection]}`] : [])]}
              text={chosenCard.description}
            />
          )}
          {looking === "combat" && orderCombatCard && (
            <CardDetails
              card={<CombatCardComponent faction={faction} card={orderCombatCard} />}
              cardWidth={220}
              name={orderCombatCard.name}
              tags={[COMBAT_PHASE_LABELS[orderCombatCard.phase], `Cuesta ${coinsText(orderCombatCard.cost)}`]}
              text={orderCombatCard.description}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setLooking(null)} startIcon={<GameIcon name="cancel" />}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default MovementView;
