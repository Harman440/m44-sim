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
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    extraCard: "Carta extra",
    pendingKeep: "Elige la carta de mando que te quedas para empezar el siguiente turno.",
    pendingDraw: "Roba tu carta de mando para empezar el siguiente turno.",
    pendingRoll: "Tira el dado de refuerzos para empezar el siguiente turno.",
    pendingPlace: "Coloca el refuerzo en el mapa para empezar el siguiente turno.",
    pendingReward: "Elige suministros o carta de combate para empezar el siguiente turno.",
    pendingCombatCard: "Roba la carta de combate para empezar el siguiente turno.",
    pendingDiscard: "Descarta una carta de combate para empezar el siguiente turno.",
    finalPhase: "Fase final",
    step1: "1. Retiradas y bajas",
    step1Info:
      "Haz en la mesa las retiradas marcadas en la batalla. Después, en «Actualizar mapa», refleja en el mapa las unidades eliminadas y las que se han movido (retiradas o terreno tomado), de los dos bandos.",
    mapEdits: (n: number) => (n === 1 ? "1 cambio" : `${n} cambios`),
    updateMap: "Actualizar mapa",
    rollPrompt: (card: string) => `${card}: tira el dado para ver qué unidad llega a la casilla de la cruz.`,
    rollReinforcements: "Tirar dado de refuerzos",
    noReinforcements: "no hay refuerzos.",
    reinforcementToPlace: (unit: string) =>
      `llega ${unit.toLowerCase()}. La casilla de la cruz está ocupada: ponla en la mesa y en «Actualizar mapa», en una casilla libre.`,
    reinforcementPlaced: (unit: string) =>
      `llega ${unit.toLowerCase()}, ya en el mapa. Ponla en la mesa en la casilla de la cruz.`,
    step2: "2. Carta de mando",
    drawChoiceInfo: (card: string, n: number) => `${card}: roba ${n} cartas de tu mazo y quédate con 1.`,
    drawInfo:
      "Roba una carta de tu mazo y te la quedas. Puedes descartarla una vez y robar otra, pero entonces te quedas la nueva.",
    extraDrawInfo: (turns: number) =>
      `En este escenario robas además una carta extra, que va directa a la mano, al final de tus ${turns} primeros turnos. `,
    tapCard: "Toca una carta para ver su texto.",
    drawCards: (n: number) => `Robar ${n} cartas`,
    drawCard: "Robar carta",
    drewAgain: "Has descartado la primera y robado esta.",
    kept: "Te la quedas.",
    drawAgain: "Descartar y robar otra",
    chooseLabel: (card: string) => `Elegir ${card}`,
    choose: "Elegir",
    rewardTitle: "Suministros o carta de combate",
    noRewardInfo: "En el turno extra no hay recompensa: ni suministros ni carta de combate.",
    cardRewardInfo: (card: string, coins: number, combatCard: boolean) =>
      `${card} da +${coins} suministros${combatCard ? " y una carta de combate" : ""}, en lugar de elegir. Los suministros ya están sumados al contador.`,
    rewardInfo: (coins: number, maxHand: number) =>
      `Cada turno te llevas ${coins} suministros, o una carta de combate en su lugar. La carta de combate se roba al elegirla, así que ya no se puede cambiar. Puedes tener ${maxHand} cartas de combate como máximo.`,
    noReward: "Sin recompensa en el turno extra.",
    cardReward: (coins: number, combatCard: boolean) =>
      `+${coins} suministros${combatCard ? " y una carta de combate" : ""}.`,
    coinsOption: (coins: number) => `${coins} suministros`,
    combatCardOption: "Carta de combate",
    drawCombatCard: "Robar carta de combate",
    drewCombatCard: "Has robado esta carta.",
    tooManyCombatCards: (n: number) => `Máximo ${n} cartas de combate: descarta una (puede ser la nueva).`,
    discardLabel: (card: string) => `Descartar ${card}`,
    discard: "Descartar",
    startTurn: (n: number) => `Empezar turno ${n}`,
    card: "Carta",
  },
  en: {
    extraCard: "Extra card",
    pendingKeep: "Choose the command card you keep to start the next turn.",
    pendingDraw: "Draw your command card to start the next turn.",
    pendingRoll: "Roll the reinforcements die to start the next turn.",
    pendingPlace: "Place the reinforcement on the map to start the next turn.",
    pendingReward: "Choose supplies or a combat card to start the next turn.",
    pendingCombatCard: "Draw the combat card to start the next turn.",
    pendingDiscard: "Discard a combat card to start the next turn.",
    finalPhase: "Final phase",
    step1: "1. Retreats and casualties",
    step1Info:
      "Carry out on the table the retreats marked in the battle. Then, in “Update map”, show on the map the units removed and the ones that moved (retreats or ground taken), on both sides.",
    mapEdits: (n: number) => (n === 1 ? "1 change" : `${n} changes`),
    updateMap: "Update map",
    rollPrompt: (card: string) => `${card}: roll the die to see which unit arrives on the cross hex.`,
    rollReinforcements: "Roll reinforcements die",
    noReinforcements: "no reinforcements.",
    reinforcementToPlace: (unit: string) =>
      `${unit.toLowerCase()} arrives. The cross hex is taken: put it on the table and, in “Update map”, on a free hex.`,
    reinforcementPlaced: (unit: string) =>
      `${unit.toLowerCase()} arrives, already on the map. Put it on the table on the cross hex.`,
    step2: "2. Command card",
    drawChoiceInfo: (card: string, n: number) => `${card}: draw ${n} cards from your deck and keep 1.`,
    drawInfo:
      "Draw a card from your deck and keep it. You can discard it once and draw another, but then you keep the new one.",
    extraDrawInfo: (turns: number) =>
      `In this scenario you also draw an extra card, straight into your hand, at the end of your first ${turns} turns. `,
    tapCard: "Tap a card to see its text.",
    drawCards: (n: number) => `Draw ${n} cards`,
    drawCard: "Draw a card",
    drewAgain: "You discarded the first one and drew this one.",
    kept: "You keep it.",
    drawAgain: "Discard and draw another",
    chooseLabel: (card: string) => `Choose ${card}`,
    choose: "Choose",
    rewardTitle: "Supplies or combat card",
    noRewardInfo: "There's no reward in the extra turn: no supplies and no combat card.",
    cardRewardInfo: (card: string, coins: number, combatCard: boolean) =>
      `${card} gives +${coins} supplies${combatCard ? " and a combat card" : ""}, instead of choosing. The supplies are already added to the counter.`,
    rewardInfo: (coins: number, maxHand: number) =>
      `Each turn you get ${coins} supplies, or a combat card instead. The combat card is drawn when you choose it, so you can't change your mind. You can hold at most ${maxHand} combat cards.`,
    noReward: "No reward in the extra turn.",
    cardReward: (coins: number, combatCard: boolean) =>
      `+${coins} supplies${combatCard ? " and a combat card" : ""}.`,
    coinsOption: (coins: number) => `${coins} supplies`,
    combatCardOption: "Combat card",
    drawCombatCard: "Draw combat card",
    drewCombatCard: "You drew this card.",
    tooManyCombatCards: (n: number) => `At most ${n} combat cards: discard one (it can be the new one).`,
    discardLabel: (card: string) => `Discard ${card}`,
    discard: "Discard",
    startTurn: (n: number) => `Start turn ${n}`,
    card: "Card",
  },
});

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
/** The scenario's extra card (Pegasus Bridge), already in the hand */
function ExtraCard({ card }: { card: ReactNode }) {
  const t = useMessages(TEXT);
  return (
    <Stack sx={{ alignItems: "center", gap: 0.5 }} data-testid="extra-card">
      {card}
      <Typography variant="body2" color="text.secondary">
        {t.extraCard}
      </Typography>
    </Stack>
  );
}

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
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const { drawnCard, drawOptions, chosenCard } = game;
  const drawChoice = chosenCard?.drawChoice ?? 1;
  const reward = chosenCard?.endOfTurnReward;
  const [showMap, setShowMap] = useState(false);
  const [looking, setLooking] = useState<ShownCard | null>(null);
  /** Tokens the combat cards played put on the physical board (sandbags, camouflage) */
  const tableReminders = [game.orderCombatCard, game.battleCombatCard].flatMap((card) =>
    card?.tableReminder ? [tr(card.tableReminder)] : []
  );
  /** What's still needed before the next turn */
  const pendingStep = !drawnCard
    ? drawOptions.length > 0
      ? t.pendingKeep
      : t.pendingDraw
    : game.reinforcementDue
      ? t.pendingRoll
      : game.reinforcementToPlace
        ? t.pendingPlace
        : game.needsRewardChoice && !game.rewardChoice
          ? t.pendingReward
          : game.combatCardDue
            ? t.pendingCombatCard
            : game.mustDiscardCombatCard
              ? t.pendingDiscard
              : null;

  if (showMap) {
    return (
      <EndOfTurnMap
        faction={faction}
        session={session}
        game={game}
        title={t.finalPhase}
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
          title={t.step1}
          info={<Typography variant="body1">{t.step1Info}</Typography>}
        >
          {game.battleEdits > 0 && (
            <Typography variant="body2" color="text.secondary" data-testid="map-edits">
              {t.mapEdits(game.battleEdits)}
            </Typography>
          )}
          <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
            {t.updateMap}
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
                  {t.rollPrompt(game.orderCombatCard ? tr(game.orderCombatCard.name) : "")}
                </Typography>
                <Button onClick={() => session.rollReinforcements()} startIcon={<GameIcon name="dice" />}>
                  {t.rollReinforcements}
                </Button>
              </Stack>
            ) : (
              game.reinforcement && (
                <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: "none", display: "flex" }}>
                    <DieFaceIcon face={game.reinforcement.face} faction={faction} />
                  </Box>
                  <Typography variant="body1">
                    {labels.dieFaces[game.reinforcement.face]}:{" "}
                    {!game.reinforcement.unitType
                      ? t.noReinforcements
                      : game.reinforcementToPlace
                        ? t.reinforcementToPlace(labels.units[game.reinforcement.unitType])
                        : t.reinforcementPlaced(labels.units[game.reinforcement.unitType])}
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
            title={t.step2}
            info={
              <Typography variant="body1">
                {drawChoice > 1
                  ? t.drawChoiceInfo(tr(chosenCard!.name), drawChoice)
                  : t.drawInfo}{" "}
                {game.drawsExtra && t.extraDrawInfo(session.scenario.extraDraws!.turns)}
                {t.tapCard}
              </Typography>
            }
          >
            {!drawnCard && drawOptions.length === 0 && (
              <Button onClick={onDrawCard} startIcon={<GameIcon name="cards" />}>
                {drawChoice > 1 ? t.drawCards(drawChoice) : t.drawCard}
                {game.drawsExtra && " +1"}
              </Button>
            )}
          </StepHeading>
          {drawnCard ? (
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 2 }}>
              {/* With the scenario's extra card, the two cards side by side and the text under them */}
              <Stack direction="row" sx={{ alignItems: "flex-start", gap: 2 }}>
                {commandCard(drawnCard)}
                {game.extraDrawn && <ExtraCard card={commandCard(game.extraDrawn)} />}
              </Stack>
              <Stack sx={{ gap: 1, alignItems: game.extraDrawn ? "center" : "flex-start", width: game.extraDrawn ? "100%" : undefined }}>
                <Typography variant="body2" color="text.secondary">
                  {game.drewAgain ? t.drewAgain : t.kept}
                </Typography>
                {game.canDrawAgain && (
                  <Button variant="outlined" onClick={onDrawAgain} startIcon={<GameIcon name="cards" />}>
                    {t.drawAgain}
                  </Button>
                )}
              </Stack>
            </Stack>
          ) : (
            drawOptions.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5 }}>
                {game.extraDrawn && <ExtraCard card={commandCard(game.extraDrawn)} />}
                {drawOptions.map((card) => (
                  <Stack key={card.id} sx={{ alignItems: "center", gap: 1 }}>
                    {commandCard(card)}
                    <Button onClick={() => onKeepCard(card)} aria-label={t.chooseLabel(tr(card.name))}>
                      {t.choose}
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
            title={`3. ${reward ? tr(chosenCard!.name) : t.rewardTitle}`}
            info={
              <Typography variant="body1">
                {game.extraTurn
                  ? t.noRewardInfo
                  : reward
                    ? t.cardRewardInfo(tr(chosenCard!.name), reward.coins, !!reward.combatCard)
                    : t.rewardInfo(END_OF_TURN_COINS, MAX_COMBAT_HAND)}
              </Typography>
            }
          />
          {game.extraTurn ? (
            <Typography variant="body1">{t.noReward}</Typography>
          ) : reward ? (
            <Typography variant="body1">
              {t.cardReward(reward.coins, !!reward.combatCard)}
            </Typography>
          ) : (
            <ToggleButtonGroup
              exclusive
              value={game.rewardChoice}
              onChange={(_, choice: RewardChoice | null) => choice && onChooseReward(choice)}
              disabled={game.drawnCombatCard !== null}
              aria-label={t.rewardTitle}
              sx={{ flexWrap: "wrap" }}
            >
              <ToggleButton value="coins" sx={{ minHeight: 48, gap: 1 }}>
                <GameIcon name="coins" /> {t.coinsOption(END_OF_TURN_COINS)}
              </ToggleButton>
              <ToggleButton value="combatCard" sx={{ minHeight: 48, gap: 1 }}>
                <GameIcon name="cards" /> {t.combatCardOption}
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          {game.combatCardDue && (
            <Button onClick={() => session.drawCombatCard()} startIcon={<GameIcon name="cards" />} sx={{ alignSelf: "flex-start" }}>
              {t.drawCombatCard}
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
                {t.drewCombatCard}
              </Typography>
            </Stack>
          )}
          {game.mustDiscardCombatCard && (
            <Box data-testid="discard-combat-card">
              <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                {t.tooManyCombatCards(MAX_COMBAT_HAND)}
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
                      aria-label={t.discardLabel(tr(card.name))}
                    >
                      {t.discard}
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
          {t.startTurn(game.turn + 1)}
        </Button>
        {pendingStep && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            {pendingStep}
          </Typography>
        )}
      </div>

      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label={t.card} />
    </div>
  );
}

export default EndOfTurnView;
