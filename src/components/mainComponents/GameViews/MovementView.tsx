import type { ReactNode } from "react";
import { Box, Button, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import PlayedCards from "../../PlayedCards";
import InfoButton from "../../InfoButton";
import { BarbedWireIcon } from "../../BarbedWire";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Fase Movimiento",
    battle: "Fase Batalla",
    instructions: "Instrucciones",
    show: "Enseña esta pantalla al rival, con el mapa y las cartas, y mira la suya. Toca una carta para leerla entera.",
    playing: (name: string, cost: string, description: string): ReactNode => (
      <>
        Juegas <strong>{name}</strong> (coste: {cost}, ya restado del contador): {description}
      </>
    ),
    move: "Mueve en la mesa las unidades con flecha.",
    markers: (n: number) =>
      `Pon un marcador de batalla en ${n === 1 ? "la unidad que dispara" : `las ${n} unidades que disparan`}.`,
    clearedWire: (n: number) =>
      n === 1
        ? "Tu tanque quita la alambrada en la que entra: quítala de la mesa."
        : `Tus tanques quitan las ${n} alambradas en las que entran: quítalas de la mesa.`,
  },
  en: {
    title: "Movement phase",
    battle: "Battle phase",
    instructions: "Instructions",
    show: "Show this screen to your opponent, with the map and the cards, and look at theirs. Tap a card to read all of it.",
    playing: (name: string, cost: string, description: string): ReactNode => (
      <>
        You play <strong>{name}</strong> (cost: {cost}, already taken off the counter): {description}
      </>
    ),
    move: "Move the units with an arrow on the table.",
    markers: (n: number) => `Put a battle marker on ${n === 1 ? "the unit that fires" : `the ${n} units that fire`}.`,
    clearedWire: (n: number) =>
      n === 1
        ? "Your tank removes the barbed wire it enters: take it off the table."
        : `Your tanks remove the ${n} barbed wires they enter: take them off the table.`,
  },
});
import "./PhaseLayout.css";

interface MovementViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
}

const noop = () => {};

/**
 * Movement phase, straight after confirming the orders: both players show
 * their maps, then move the pieces on the table. The map here is read-only;
 * it shows what to move, and the cards played this turn sit above the
 * instructions for the opponent to read.
 */
function MovementView({ faction, session, game }: MovementViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const firing = game.orders.filter((order) => order.canFire).length;
  const clearedWire = game.orders.filter((order) => order.clearedWire).length;

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
          {t.title}
        </Typography>
        <PlayedCards
          faction={faction}
          command={game.chosenCard}
          section={game.chosenSection}
          combat={game.orderCombatCard}
        />
        {clearedWire > 0 && (
          // Something to do on the table, so it isn't tucked away in the instructions
          <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1 }} data-testid="cleared-wire">
            <BarbedWireIcon size={32} />
            {t.clearedWire(clearedWire)}
          </Typography>
        )}
        <Button onClick={() => session.startBattle()} startIcon={<GameIcon name="battle" />}>
          {t.battle}
        </Button>
        <Box sx={{ mt: "auto" }}>
          <InfoButton title={t.title} label={t.instructions}>
            <Box component="ol" sx={{ m: 0, pl: 3, display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="li" variant="body1">
                {t.show}
              </Typography>
              {game.orderCombatCard && (
                <Typography component="li" variant="body1" data-testid="order-combat-card">
                  {t.playing(
                    tr(game.orderCombatCard.name),
                    labels.coins(game.orderCombatCard.cost),
                    tr(game.orderCombatCard.description),
                  )}
                </Typography>
              )}
              <Typography component="li" variant="body1">
                {t.move}
              </Typography>
              {firing > 0 && (
                <Typography component="li" variant="body1">
                  {t.markers(firing)}
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
