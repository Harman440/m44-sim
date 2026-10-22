import { ReactNode, useContext, useState } from "react";
import { OpponentContext } from "../../OpponentContext";
import { Button, Paper, Stack, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { Faction } from "../../../types/faction";
import CardDialog, { ShownCard } from "../../CardDialog";
import CardHand from "../../CardHand";
import ActionCardComponent from "../../ActionCardComponent";
import GameIcon from "../../GameIcon";
import InfoButton from "../../InfoButton";
import EndOfTurnMap from "./EndOfTurnMap";
import LargeMap from "./LargeMap";
import HandAwayBar from "./HandAwayBar";
import "./EndOfTurnView.css";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    pendingPlace: "Coloca el refuerzo en el mapa para empezar el siguiente turno.",
    finalPhase: "Fase final",
    step1: "1. Retiradas y bajas",
    step1Info:
      "Haz en la mesa las retiradas marcadas en la batalla. Después, en «Actualizar mapa», refleja en el mapa las unidades eliminadas y las que se han movido (retiradas o terreno tomado), de los dos bandos.",
    reinforcementToPlaceShared: (unit: string) =>
      `llega ${unit.toLowerCase()}. La casilla de la cruz está ocupada: ponla en una casilla libre.`,
    placeReinforcement: "Colocar el refuerzo",
    moveAfterBattle: (name: string) => `Mover: ${name}`,
    reinforcementPlacedShared: (unit: string) => `llega ${unit.toLowerCase()}, en la casilla de la cruz.`,
    mapEdits: (n: number) => (n === 1 ? "1 cambio" : `${n} cambios`),
    updateMap: "Actualizar mapa",
    reinforcementToPlace: (unit: string) =>
      `llega ${unit.toLowerCase()}. La casilla de la cruz está ocupada: ponla en la mesa y en «Actualizar mapa», en una casilla libre.`,
    reinforcementPlaced: (unit: string) =>
      `llega ${unit.toLowerCase()}, ya en el mapa. Ponla en la mesa en la casilla de la cruz.`,
    cardsTitle: "Tus cartas",
    cardsInfo: "No se roba ninguna carta: siguen todas en tu mano. Una carta jugada vuelve cuando acaba de esperar sus turnos.",
    startTurn: (n: number) => `Empezar turno ${n}`,
    card: "Carta",
    hand: "Tu mano",
    handCount: (n: number) => `Cartas de mando (${n})`,
  },
  en: {
    pendingPlace: "Place the reinforcement on the map to start the next turn.",
    finalPhase: "Final phase",
    step1: "1. Retreats and casualties",
    step1Info:
      "Carry out on the table the retreats marked in the battle. Then, in “Update map”, show on the map the units removed and the ones that moved (retreats or ground taken), on both sides.",
    reinforcementToPlaceShared: (unit: string) =>
      `${unit.toLowerCase()} arrives. The cross hex is taken: place it on a free hex.`,
    placeReinforcement: "Place the reinforcement",
    moveAfterBattle: (name: string) => `Move: ${name}`,
    reinforcementPlacedShared: (unit: string) => `${unit.toLowerCase()} arrives, on the cross hex.`,
    mapEdits: (n: number) => (n === 1 ? "1 change" : `${n} changes`),
    updateMap: "Update map",
    reinforcementToPlace: (unit: string) =>
      `${unit.toLowerCase()} arrives. The cross hex is taken: put it on the table and, in “Update map”, on a free hex.`,
    reinforcementPlaced: (unit: string) =>
      `${unit.toLowerCase()} arrives, already on the map. Put it on the table on the cross hex.`,
    cardsTitle: "Your cards",
    cardsInfo: "No card is drawn: they all stay in your hand. A card played comes back once it has waited its turns.",
    startTurn: (n: number) => `Start turn ${n}`,
    card: "Card",
    hand: "Your hand",
    handCount: (n: number) => `Command cards (${n})`,
  },
});

interface EndOfTurnViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onEndTurn: () => void;
}

/** A step's heading on one line: its title, the info button with the explanation, and anything else on the right */
function StepHeading({ title, info, children }: { title: string; info: ReactNode; children?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 1 }}>
      <Typography variant="h6" component="h3">
        {title}
      </Typography>
      <InfoButton title={title.replace(/^\d+\. /, "")}>{info}</InfoButton>
      {children && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, ml: "auto" }}>
          {children}
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Fase final: make the retreats marked in battle on the table and mirror the casualties,
 * retreats and ground taken on the map; the Reinforcements card's unit arrives. Nothing is drawn
 * or handed out: the cards stay in the hand, shown at the bottom as in the Command Zone.
 */
function EndOfTurnView({ faction, session, game, onEndTurn }: EndOfTurnViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const [showMap, setShowMap] = useState(false);
  /** Pass and play: the steps and the hand are put away and the map shows large */
  const [handAway, setHandAway] = useState(false);
  const [looking, setLooking] = useState<ShownCard | null>(null);
  // Pass and play: there's no table, the app's map is the game
  const shared = useContext(OpponentContext) !== null;

  /** What's still needed before the next turn */
  const pendingStep = game.reinforcementToPlace ? t.pendingPlace : null;
  /** The Reinforcements card played this turn, and the unit it brings */
  const played = game.playedCard;
  const reinforcementUnit = played?.effect.kind === "reinforcements" ? played.effect.unitType : null;

  if (showMap) {
    return <EndOfTurnMap faction={faction} session={session} game={game} title={t.finalPhase} onDone={() => setShowMap(false)} />;
  }

  /** Pass and play: the map work left after the battle (a reinforcement to place, a move after the battle) */
  const mapButton = !shared ? null : game.reinforcementToPlace ? (
    <Button onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
      {t.placeReinforcement}
    </Button>
  ) : game.finalMove ? (
    <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
      {t.moveAfterBattle(tr(game.finalMove.name))}
    </Button>
  ) : null;

  const reinforcementLine = played && reinforcementUnit && (
    <Typography variant="body1" sx={{ mt: 1 }} data-testid="reinforcements">
      {tr(played.name)}:{" "}
      {game.reinforcementToPlace
        ? (shared ? t.reinforcementToPlaceShared : t.reinforcementToPlace)(labels.units[reinforcementUnit])
        : (shared ? t.reinforcementPlacedShared : t.reinforcementPlaced)(labels.units[reinforcementUnit])}
    </Typography>
  );

  const steps = (
    <div className="end-of-turn__steps">
      {shared && (mapButton || reinforcementLine) && (
        <Paper variant="outlined" className="end-of-turn__step">
          {mapButton}
          {reinforcementLine}
        </Paper>
      )}
      <Paper variant="outlined" className="end-of-turn__step" data-testid="end-of-turn-cards">
        <StepHeading title={t.cardsTitle} info={<Typography variant="body1">{t.cardsInfo}</Typography>} />
        <Typography variant="body2" color="text.secondary">
          {t.cardsInfo}
        </Typography>
      </Paper>
    </div>
  );

  return (
    <div className={`end-of-turn${shared && handAway ? " end-of-turn--away" : ""}`}>
      {shared && handAway && <LargeMap session={session} faction={faction} />}
      {!shared && (
        <Paper variant="outlined" sx={{ px: 2, py: 1 }} className="end-of-turn__map-step">
          <StepHeading title={t.step1} info={<Typography variant="body1">{t.step1Info}</Typography>}>
            {game.battleEdits > 0 && (
              <Typography variant="body2" color="text.secondary" data-testid="map-edits">
                {t.mapEdits(game.battleEdits)}
              </Typography>
            )}
            <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
              {t.updateMap}
            </Button>
          </StepHeading>
          {reinforcementLine}
        </Paper>
      )}

      {shared ? (
        // Pass and play: the map on the left (no title: the header shows the phase), the steps on its right
        <div className="end-of-turn__main">
          {!handAway && (
            <div className="end-of-turn__map">
              <LargeMap session={session} faction={faction} />
            </div>
          )}
          {steps}
        </div>
      ) : (
        steps
      )}

      {/* The hand, as in the Command Zone */}
      <section className="end-of-turn__hand" aria-labelledby="end-hand-title">
        {/* Its title, and the next turn button on the same line, always in sight */}
        <div className="end-of-turn__hand-bar">
          <Typography variant="overline" component="h3" id="end-hand-title" className="hand-group__title">
            {t.handCount(game.cards.length)}
          </Typography>
          <div className="end-of-turn__footer">
            <Button size="large" onClick={onEndTurn} disabled={!!pendingStep} startIcon={<GameIcon name="endTurn" />}>
              {t.startTurn(game.turn + 1)}
            </Button>
            {pendingStep && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                {pendingStep}
              </Typography>
            )}
          </div>
        </div>
        <CardHand
          label={t.hand}
          fit
          cards={game.cards.map(({ card, cost, turnsLeft }) => ({
            key: card.id,
            node: (
              <ActionCardComponent
                card={card}
                cost={cost}
                turnsLeft={turnsLeft}
                onClick={() => setLooking({ action: card, cost, turnsLeft })}
              />
            ),
          }))}
        />
      </section>

      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label={t.card} />
      {shared && <HandAwayBar away={handAway} onToggle={() => setHandAway((away) => !away)} />}
    </div>
  );
}

export default EndOfTurnView;
