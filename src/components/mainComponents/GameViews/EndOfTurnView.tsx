import { ReactNode, useState } from "react";
import { Alert, Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { Faction } from "../../../types/faction";
import CommandCardComponent from "../../CommandCardComponent";
import CardDialog, { ShownCard } from "../../CardDialog";
import GameIcon from "../../GameIcon";
import InfoButton from "../../InfoButton";
import EndOfTurnMap from "./EndOfTurnMap";
import { RewardChoice } from "../../../game-core/coins";
import { END_OF_TURN_COINS } from "../../../data/coinRules";
import { MAX_COMBAT_HAND } from "../../../data/combatCards";
import CombatCardComponent from "../../CombatCardComponent";
import "./EndOfTurnView.css";
import { DieFaceIcon } from "../../DiceResult";
import { DIE_FACE_LABELS, UNIT_LABELS } from "../../../labels";

interface EndOfTurnViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onDrawCard: () => void;
  onKeepCard: (card: CommandCard) => void;
  onDrawAgain: () => void;
  onChooseReward: (choice: RewardChoice) => void;
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

/** Cards in the final phase: small enough for the three steps to fit on the screen */
const CARD_WIDTH = "clamp(120px, 36cqh, 190px)";

/**
 * Fase final: make the retreats marked in battle on the table and mirror the
 * casualties, retreats and ground taken on the map, then draw a command card,
 * which is kept unless the player swaps it once for the next one (Recon: draw
 * 3 and keep 1). Last, 2 coins, or a combat card instead (Preparations gives
 * both, in its own amounts). Each step is one line; its explanation is behind
 * an info button, and tapping a card shows its full text.
 */
function EndOfTurnView({
  faction,
  session,
  game,
  onDrawCard,
  onKeepCard,
  onDrawAgain,
  onChooseReward,
  onEndTurn,
}: EndOfTurnViewProps) {
  const { drawnCard, drawOptions, chosenCard } = game;
  const drawChoice = chosenCard?.drawChoice ?? 1;
  const reward = chosenCard?.endOfTurnReward;
  const [showMap, setShowMap] = useState(false);
  const [looking, setLooking] = useState<ShownCard | null>(null);
  /** Tokens the combat cards played put on the physical board (sandbags, camouflage) */
  const tableReminders = [game.orderCombatCard, game.battleCombatCard].flatMap((card) =>
    card?.tableReminder ? [card.tableReminder] : []
  );
  /** What's still needed before the next turn */
  const pendingStep = !drawnCard
    ? drawOptions.length > 0
      ? "Elige la carta de mando que te quedas para empezar el siguiente turno."
      : "Roba tu carta de mando para empezar el siguiente turno."
    : game.reinforcementDue
      ? "Tira el dado de refuerzos para empezar el siguiente turno."
      : game.reinforcementToPlace
        ? "Coloca el refuerzo en el mapa para empezar el siguiente turno."
        : game.needsRewardChoice && !game.rewardChoice
          ? "Elige suministros o carta de combate para empezar el siguiente turno."
          : game.combatCardDue
            ? "Roba la carta de combate para empezar el siguiente turno."
            : game.mustDiscardCombatCard
              ? "Descarta una carta de combate para empezar el siguiente turno."
              : null;

  if (showMap) {
    return (
      <EndOfTurnMap
        faction={faction}
        session={session}
        game={game}
        title="Fase final"
        onDone={() => setShowMap(false)}
      />
    );
  }

  const commandCard = (card: CommandCard) => (
    <Box sx={{ "--card-width": CARD_WIDTH }}>
      <CommandCardComponent faction={faction} cardData={card} onClick={() => setLooking({ command: card })} />
    </Box>
  );

  return (
    <div className="end-of-turn">
      <Paper variant="outlined" sx={{ px: 2, py: 1 }} className="end-of-turn__table">
        <StepHeading
          title="1. Retiradas y bajas"
          info={
            <Typography variant="body1">
              Haz en la mesa las retiradas marcadas en la batalla. Después, en «Actualizar mapa», refleja en el mapa
              las unidades eliminadas y las que se han movido (retiradas o terreno tomado), de los dos bandos.
            </Typography>
          }
        >
          {game.battleEdits > 0 && (
            <Typography variant="body2" color="text.secondary" data-testid="map-edits">
              {game.battleEdits === 1 ? "1 cambio" : `${game.battleEdits} cambios`}
            </Typography>
          )}
          <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
            Actualizar mapa
          </Button>
        </StepHeading>
        {tableReminders.map((reminder) => (
          <Alert
            key={reminder}
            severity="warning"
            icon={<GameIcon name="cards" />}
            sx={{ mt: 1, py: 0 }}
            data-testid="table-reminder"
          >
            {reminder}
          </Alert>
        ))}
        {(game.reinforcementDue || game.reinforcement) && (
          <Box sx={{ mt: 1 }} data-testid="reinforcements">
            {game.reinforcementDue ? (
              <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                <Typography variant="body1">
                  {game.orderCombatCard?.name}: tira el dado para ver qué unidad llega a la casilla de la cruz.
                </Typography>
                <Button onClick={() => session.rollReinforcements()} startIcon={<GameIcon name="dice" />}>
                  Tirar dado de refuerzos
                </Button>
              </Stack>
            ) : (
              game.reinforcement && (
                <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: "none", display: "flex" }}>
                    <DieFaceIcon face={game.reinforcement.face} faction={faction} />
                  </Box>
                  <Typography variant="body1">
                    {DIE_FACE_LABELS[game.reinforcement.face]}:{" "}
                    {!game.reinforcement.unitType
                      ? "no hay refuerzos."
                      : game.reinforcementToPlace
                        ? `llega ${UNIT_LABELS[game.reinforcement.unitType].toLowerCase()}. La casilla de la cruz está ocupada: ponla en la mesa y en «Actualizar mapa», en una casilla libre.`
                        : `llega ${UNIT_LABELS[game.reinforcement.unitType].toLowerCase()}, ya en el mapa. Ponla en la mesa en la casilla de la cruz.`}
                  </Typography>
                </Stack>
              )
            )}
          </Box>
        )}
      </Paper>

      <div className="end-of-turn__steps">
        <Paper variant="outlined" sx={{ px: 2, py: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <StepHeading
            title="2. Carta de mando"
            info={
              <Typography variant="body1">
                {drawChoice > 1
                  ? `${chosenCard!.name}: roba ${drawChoice} cartas de tu mazo y quédate con 1.`
                  : "Roba una carta de tu mazo y te la quedas. Puedes descartarla una vez y robar otra, pero entonces te quedas la nueva."}{" "}
                Toca una carta para ver su texto.
              </Typography>
            }
          >
            {!drawnCard && drawOptions.length === 0 && (
              <Button onClick={onDrawCard} startIcon={<GameIcon name="cards" />}>
                {drawChoice > 1 ? `Robar ${drawChoice} cartas` : "Robar carta"}
              </Button>
            )}
          </StepHeading>
          {drawnCard ? (
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 2 }}>
              {commandCard(drawnCard)}
              <Stack sx={{ gap: 1, alignItems: "flex-start" }}>
                <Typography variant="body2" color="text.secondary">
                  {game.drewAgain ? "Has descartado la primera y robado esta." : "Te la quedas."}
                </Typography>
                {game.canDrawAgain && (
                  <Button variant="outlined" onClick={onDrawAgain} startIcon={<GameIcon name="cards" />}>
                    Descartar y robar otra
                  </Button>
                )}
              </Stack>
            </Stack>
          ) : (
            drawOptions.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5 }}>
                {drawOptions.map((card) => (
                  <Stack key={card.id} sx={{ alignItems: "center", gap: 1 }}>
                    {commandCard(card)}
                    <Button onClick={() => onKeepCard(card)} aria-label={`Elegir ${card.name}`}>
                      Elegir
                    </Button>
                  </Stack>
                ))}
              </Box>
            )
          )}
        </Paper>

        <Paper
          variant="outlined"
          sx={{ px: 2, py: 1, display: "flex", flexDirection: "column", gap: 1 }}
          data-testid="end-of-turn-reward"
        >
          <StepHeading
            title={`3. ${reward ? chosenCard!.name : "Suministros o carta de combate"}`}
            info={
              <Typography variant="body1">
                {game.extraTurn
                  ? "En el turno extra no hay recompensa: ni suministros ni carta de combate."
                  : reward
                    ? `${chosenCard!.name} da +${reward.coins} suministros${reward.combatCard ? " y una carta de combate" : ""}, en lugar de elegir. Los suministros ya están sumados al contador.`
                    : `Cada turno te llevas ${END_OF_TURN_COINS} suministros, o una carta de combate en su lugar. La carta de combate se roba al elegirla, así que ya no se puede cambiar. Puedes tener ${MAX_COMBAT_HAND} cartas de combate como máximo.`}
              </Typography>
            }
          />
          {game.extraTurn ? (
            <Typography variant="body1">Sin recompensa en el turno extra.</Typography>
          ) : reward ? (
            <Typography variant="body1">
              +{reward.coins} suministros{reward.combatCard ? " y una carta de combate" : ""}.
            </Typography>
          ) : (
            <ToggleButtonGroup
              exclusive
              value={game.rewardChoice}
              onChange={(_, choice: RewardChoice | null) => choice && onChooseReward(choice)}
              disabled={game.drawnCombatCard !== null}
              aria-label="Suministros o carta de combate"
              sx={{ flexWrap: "wrap" }}
            >
              <ToggleButton value="coins" sx={{ minHeight: 48, gap: 1 }}>
                <GameIcon name="coins" /> {END_OF_TURN_COINS} suministros
              </ToggleButton>
              <ToggleButton value="combatCard" sx={{ minHeight: 48, gap: 1 }}>
                <GameIcon name="cards" /> Carta de combate
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          {game.combatCardDue && (
            <Button onClick={() => session.drawCombatCard()} startIcon={<GameIcon name="cards" />} sx={{ alignSelf: "flex-start" }}>
              Robar carta de combate
            </Button>
          )}
          {game.drawnCombatCard && !game.mustDiscardCombatCard && (
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "center", gap: 2 }}>
              <Box sx={{ "--card-width": CARD_WIDTH }}>
                <CombatCardComponent
                  faction={faction}
                  card={game.drawnCombatCard}
                  onClick={(card) => setLooking({ combat: card })}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Has robado esta carta.
              </Typography>
            </Stack>
          )}
          {game.mustDiscardCombatCard && (
            <Box data-testid="discard-combat-card">
              <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                Máximo {MAX_COMBAT_HAND} cartas de combate: descarta una (puede ser la nueva).
              </Alert>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5 }}>
                {game.combatHand.map((card) => (
                  <Stack key={card.id} sx={{ alignItems: "center", gap: 1, "--card-width": CARD_WIDTH }}>
                    <CombatCardComponent
                      faction={faction}
                      card={card}
                      selected={card === game.drawnCombatCard}
                      onClick={(c) => setLooking({ combat: c })}
                    />
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => session.discardCombatCard(card)}
                      aria-label={`Descartar ${card.name}`}
                    >
                      Descartar
                    </Button>
                  </Stack>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      </div>

      <div className="end-of-turn__footer">
        <Button size="large" onClick={onEndTurn} disabled={!!pendingStep} startIcon={<GameIcon name="endTurn" />}>
          Empezar turno {game.turn + 1}
        </Button>
        {pendingStep && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            {pendingStep}
          </Typography>
        )}
      </div>

      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label="Carta" />
    </div>
  );
}

export default EndOfTurnView;
