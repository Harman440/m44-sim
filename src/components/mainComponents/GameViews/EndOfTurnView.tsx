import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { motion } from "motion/react";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { CombatCard } from "../../../game-core/combatCard";
import { Faction } from "../../../types/faction";
import CommandCardComponent from "../../CommandCardComponent";
import CardDialog, { ShownCard } from "../../CardDialog";
import CardHand from "../../CardHand";
import CardPiles from "../../CardPiles";
import Flight, { Box as ScreenBox, boxOf, centredBox } from "../../Flight";
import GameIcon from "../../GameIcon";
import InfoButton from "../../InfoButton";
import EndOfTurnMap from "./EndOfTurnMap";
import { RewardChoice } from "../../../game-core/coins";
import { sortCombatHand, sortCommandHand } from "../../../game-core/handOrder";
import { END_OF_TURN_COINS } from "../../../data/coinRules";
import { MAX_COMBAT_HAND } from "../../../data/combatCards";
import CombatCardComponent from "../../CombatCardComponent";
import { useSound } from "../../../sound";
import "./EndOfTurnView.css";
import { DieFaceIcon } from "../../DiceResult";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    newCard: "Nueva",
    extraCard: "Extra",
    pendingKeep: "Elige la carta de mando que te quedas para empezar el siguiente turno.",
    pendingDraw: "Roba tu carta de mando para empezar el siguiente turno.",
    pendingRoll: "Tira el dado de refuerzos para empezar el siguiente turno.",
    pendingPlace: "Coloca el refuerzo en el mapa para empezar el siguiente turno.",
    pendingReward: "Confirma suministros o carta de combate para empezar el siguiente turno.",
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
    drawChoiceInfo: (card: string, n: number) => `${card}: robas ${n} cartas de tu mazo y te quedas con 1.`,
    drawInfo:
      "Al empezar la fase final robas una carta de tu mazo, que va a tu mano. Puedes descartarla una vez y robar otra, pero entonces te quedas la nueva.",
    extraDrawInfo: (turns: number) =>
      `En este escenario robas además una carta extra, que va directa a la mano, al final de tus ${turns} primeros turnos. `,
    tapCard: "Toca una carta para ver su texto.",
    drawCards: (n: number) => `Robar ${n} cartas`,
    drawCard: "Robar carta",
    drew: (card: string) => `Has robado ${card}.`,
    drewAgain: (card: string) => `Has descartado la primera y robado ${card}: te la quedas.`,
    pickOne: "Elige la que te quedas; la otra va al descarte.",
    drawAgain: "Descartar y robar otra",
    chooseLabel: (card: string) => `Elegir ${card}`,
    choose: "Elegir",
    rewardTitle: "Suministros o carta de combate",
    noRewardInfo: "En el turno extra no hay recompensa: ni suministros ni carta de combate.",
    cardRewardInfo: (card: string, coins: number, combatCard: boolean) =>
      `${card} da +${coins} suministros${combatCard ? " y una carta de combate" : ""}, en lugar de elegir. Los suministros ya están sumados al contador.`,
    rewardInfo: (coins: number, maxHand: number) =>
      `Cada turno te llevas ${coins} suministros, o una carta de combate en su lugar. Cambia entre las dos todo lo que quieras y pulsa «Confirmar»: entonces ya no se puede cambiar. Puedes tener ${maxHand} cartas de combate como máximo.`,
    noReward: "Sin recompensa en el turno extra.",
    cardReward: (coins: number, combatCard: boolean) =>
      `+${coins} suministros${combatCard ? " y una carta de combate" : ""}.`,
    coinsOption: (coins: number) => `${coins} suministros`,
    combatCardOption: "Carta de combate",
    confirm: "Confirmar",
    tookCoins: (coins: number) => `Te llevas ${coins} suministros.`,
    drawCombatCard: "Robar carta de combate",
    drewCombatCard: (card: string) => `Has robado ${card}.`,
    tooManyCombatCards: (n: number) => `Máximo ${n} cartas de combate: descarta una (puede ser la nueva).`,
    discardLabel: (card: string) => `Descartar ${card}`,
    discard: "Descartar",
    startTurn: (n: number) => `Empezar turno ${n}`,
    card: "Carta",
    hand: "Tu mano",
    handCount: (command: number, combat: number) => `Cartas de mando (${command}) · Cartas de combate (${combat})`,
  },
  en: {
    newCard: "New",
    extraCard: "Extra",
    pendingKeep: "Choose the command card you keep to start the next turn.",
    pendingDraw: "Draw your command card to start the next turn.",
    pendingRoll: "Roll the reinforcements die to start the next turn.",
    pendingPlace: "Place the reinforcement on the map to start the next turn.",
    pendingReward: "Confirm supplies or a combat card to start the next turn.",
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
    drawChoiceInfo: (card: string, n: number) => `${card}: you draw ${n} cards from your deck and keep 1.`,
    drawInfo:
      "As the final phase starts you draw a card from your deck, into your hand. You can discard it once and draw another, but then you keep the new one.",
    extraDrawInfo: (turns: number) =>
      `In this scenario you also draw an extra card, straight into your hand, at the end of your first ${turns} turns. `,
    tapCard: "Tap a card to see its text.",
    drawCards: (n: number) => `Draw ${n} cards`,
    drawCard: "Draw a card",
    drew: (card: string) => `You drew ${card}.`,
    drewAgain: (card: string) => `You discarded the first one and drew ${card}: you keep it.`,
    pickOne: "Choose the one you keep; the other goes to the discard pile.",
    drawAgain: "Discard and draw another",
    chooseLabel: (card: string) => `Choose ${card}`,
    choose: "Choose",
    rewardTitle: "Supplies or combat card",
    noRewardInfo: "There's no reward in the extra turn: no supplies and no combat card.",
    cardRewardInfo: (card: string, coins: number, combatCard: boolean) =>
      `${card} gives +${coins} supplies${combatCard ? " and a combat card" : ""}, instead of choosing. The supplies are already added to the counter.`,
    rewardInfo: (coins: number, maxHand: number) =>
      `Each turn you get ${coins} supplies, or a combat card instead. Switch between them as much as you like and tap “Confirm”: then it can't be changed. You can hold at most ${maxHand} combat cards.`,
    noReward: "No reward in the extra turn.",
    cardReward: (coins: number, combatCard: boolean) =>
      `+${coins} supplies${combatCard ? " and a combat card" : ""}.`,
    coinsOption: (coins: number) => `${coins} supplies`,
    combatCardOption: "Combat card",
    confirm: "Confirm",
    tookCoins: (coins: number) => `You get ${coins} supplies.`,
    drawCombatCard: "Draw combat card",
    drewCombatCard: (card: string) => `You drew ${card}.`,
    tooManyCombatCards: (n: number) => `At most ${n} combat cards: discard one (it can be the new one).`,
    discardLabel: (card: string) => `Discard ${card}`,
    discard: "Discard",
    startTurn: (n: number) => `Start turn ${n}`,
    card: "Card",
    hand: "Your hand",
    handCount: (command: number, combat: number) => `Command cards (${command}) · Combat cards (${combat})`,
  },
});

interface EndOfTurnViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  /** Command cards already shown in the hand (GameView keeps them for the next turn's Command Zone) */
  dealtCardIds: ReadonlySet<string>;
  onCardDealt: (card: CommandCard) => void;
  /** Only for a save from before the card was drawn as the phase starts */
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

/** A supply crate flying to the counter */
const CRATE_SIZE = 40;
/** Cards arriving together leave one after the other */
const STAGGER_MS = 180;

/** A card or crate in the air (see Flight) */
interface FlightState {
  id: string;
  node: ReactNode;
  from: ScreenBox;
  to: ScreenBox;
  delay: number;
  fade?: boolean;
  onDone: () => void;
}

/** Where a combat card's key is in the hand */
const combatKey = (card: CombatCard) => `combat-${card.id}`;

/**
 * Fase final: make the retreats marked in battle on the table and mirror the
 * casualties, retreats and ground taken on the map. The command card is drawn
 * as the phase starts and flies from the deck into the hand, held at the
 * bottom as in the Command Zone; the player may swap it once (it flies to the
 * discard pile and the next one in). After Recon the cards drawn lie on the
 * table and the one chosen flies into the hand. Last, 2 supplies or a combat
 * card: the player switches between them freely and confirms; the supplies fly
 * to the counter, the combat card into the hand. With too many combat cards
 * they come out onto the table, one is discarded and the rest go back.
 */
function EndOfTurnView({
  faction,
  session,
  game,
  dealtCardIds,
  onCardDealt,
  onDrawCard,
  onKeepCard,
  onDrawAgain,
  onChooseReward,
  onEndTurn,
}: EndOfTurnViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const play = useSound();
  const { drawnCard, drawOptions, chosenCard } = game;
  const drawChoice = chosenCard?.drawChoice ?? 1;
  const reward = chosenCard?.endOfTurnReward;
  const [showMap, setShowMap] = useState(false);
  const [looking, setLooking] = useState<ShownCard | null>(null);
  /** The reward the player is weighing; taken with Confirmar */
  const [selection, setSelection] = useState<RewardChoice>("coins");
  const [flights, setFlights] = useState<readonly FlightState[]>([]);
  /** Combat cards shown in the hand; the ones drawn later fly in. The hand at the start is already there */
  const [landedCombat, setLandedCombat] = useState<ReadonlySet<string>>(
    () => new Set(game.combatHand.map((card) => card.id))
  );
  /** Where a card arriving in the hand starts from, by hand key, when it's not the deck */
  const origins = useRef(new Map<string, ScreenBox>());
  const deckRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const rewardRef = useRef<HTMLDivElement>(null);
  /** The latest hand, for a flight that lands after the card has left it */
  const handNow = useRef(game.hand);
  handNow.current = game.hand;

  const busy = flights.length > 0;
  const discarding = game.mustDiscardCombatCard;
  const handCommand = sortCommandHand(game.hand);
  const handCombat = discarding ? [] : sortCombatHand(game.combatHand, () => true);
  /** Cards in the hand that haven't flown in yet, the drawn card before the extra one */
  const arriving = [
    ...[drawnCard, game.extraDrawn, ...handCommand]
      .filter((card, i, all): card is CommandCard => !!card && all.indexOf(card) === i && game.hand.includes(card))
      .filter((card) => !dealtCardIds.has(card.id))
      .map((card) => ({ key: card.id, command: card as CommandCard | null, combat: null as CombatCard | null })),
    ...handCombat
      .filter((card) => !landedCombat.has(card.id))
      .map((card) => ({ key: combatKey(card), command: null, combat: card as CombatCard | null })),
  ];
  const arrivingKeys = new Set(arriving.map(({ key }) => key));

  const addFlight = useCallback((flight: FlightState) => {
    setFlights((prev) => (prev.some((f) => f.id === flight.id) ? prev : [...prev, flight]));
  }, []);
  const removeFlight = useCallback((id: string) => setFlights((prev) => prev.filter((f) => f.id !== id)), []);

  const slotBox = (key: string) => boxOf(handRef.current?.querySelector(`[data-card-key="${key}"]`));

  // Send every card still to arrive to its place in the hand: from the deck,
  // or from where it was on the table or the reward
  const arrivingList = arriving.map(({ key }) => key).join(" ");
  useEffect(() => {
    let started = 0;
    arriving.forEach(({ key, command, combat }) => {
      if (flights.some((f) => f.id === key)) return;
      const land = () => {
        removeFlight(key);
        origins.current.delete(key);
        if (command) {
          // A card swapped away mid-flight isn't in the hand any more
          if (handNow.current.includes(command)) onCardDealt(command);
        } else if (combat) {
          setLandedCombat((prev) => new Set(prev).add(combat.id));
        }
        play("cardDeal");
      };
      const slot = handRef.current?.querySelector<HTMLElement>(`[data-card-key="${key}"]`);
      slot?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      const to = boxOf(slot);
      const from =
        origins.current.get(key) ??
        (command ? boxOf(deckRef.current) : to && rewardBox(to));
      if (!to || !from) {
        land();
        return;
      }
      addFlight({
        id: key,
        node: command ? (
          <CommandCardComponent faction={faction} cardData={command} />
        ) : (
          <CombatCardComponent faction={faction} card={combat!} />
        ),
        from,
        to,
        delay: started++ * STAGGER_MS,
        onDone: land,
      });
    });
    // `arriving` is rebuilt every render; its keys say when it changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivingList, flights]);

  /** A combat card won comes out of the reward box, half the size it lands at */
  const rewardBox = (to: ScreenBox): ScreenBox | null => {
    const box = boxOf(rewardRef.current);
    return box && centredBox(box, to.width / 2, to.height / 2);
  };

  /** A card leaving the hand or the table for the discard pile */
  const sendToDiscard = (id: string, node: ReactNode, from: ScreenBox | null, fade = false) => {
    const to = boxOf(discardRef.current);
    if (!from || !to) return;
    const flightId = `out-${id}`;
    addFlight({ id: flightId, node, from, to, delay: 0, fade, onDone: () => removeFlight(flightId) });
  };

  const drawAgain = () => {
    if (drawnCard) {
      sendToDiscard(drawnCard.id, <CommandCardComponent faction={faction} cardData={drawnCard} />, slotBox(drawnCard.id));
    }
    onDrawAgain();
  };

  /** Recon: the card kept flies from the table into the hand, the others to the discard pile */
  const keepCard = (card: CommandCard) => {
    drawOptions.forEach((option) => {
      const box = boxOf(tableRef.current?.querySelector(`[data-option-id="${option.id}"] .game-card`));
      if (option === card) {
        if (box) origins.current.set(option.id, box);
      } else {
        sendToDiscard(option.id, <CommandCardComponent faction={faction} cardData={option} />, box);
      }
    });
    onKeepCard(card);
  };

  /** Takes the reward: the supplies fly to the counter and are counted as they land; a combat card is drawn and flies into the hand */
  const confirmReward = () => {
    if (selection === "combatCard") {
      onChooseReward("combatCard");
      return;
    }
    const start = boxOf(rewardRef.current?.querySelector('[aria-pressed="true"]') ?? rewardRef.current);
    const counter = boxOf(document.querySelector('[data-testid="coin-counter"]'));
    if (!start || !counter) {
      onChooseReward("coins");
      return;
    }
    for (let i = 0; i < END_OF_TURN_COINS; i++) {
      const id = `coin-${i}`;
      const last = i === END_OF_TURN_COINS - 1;
      addFlight({
        id,
        node: (
          <Box sx={{ color: "primary.main", display: "flex" }}>
            <GameIcon name="coins" size={CRATE_SIZE} />
          </Box>
        ),
        from: centredBox(start, CRATE_SIZE),
        to: centredBox(counter, CRATE_SIZE),
        delay: i * STAGGER_MS,
        onDone: () => {
          removeFlight(id);
          if (last) onChooseReward("coins");
        },
      });
    }
  };

  /** The combat card thrown away goes to the discard pile; the others fly back into the hand */
  const discardCombatCard = (card: CombatCard) => {
    const boxes = new Map(
      game.combatHand.map((c) => [c, boxOf(tableRef.current?.querySelector(`[data-discard-id="${c.id}"] .game-card`))])
    );
    game.combatHand.forEach((c) => {
      if (c === card) return;
      const box = boxes.get(c);
      if (box) origins.current.set(combatKey(c), box);
    });
    sendToDiscard(combatKey(card), <CombatCardComponent faction={faction} card={card} />, boxes.get(card) ?? null, true);
    setLandedCombat(new Set());
    session.discardCombatCard(card);
  };

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
            : discarding
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

  const coinsFlying = flights.some((f) => f.id.startsWith("coin-"));
  /** A card still in the air keeps its place empty; a card drawn this phase glows */
  const slotClass = (key: string, isNew: boolean) =>
    [arrivingKeys.has(key) && "card-hand__slot--incoming", isNew && "hand-card--new"].filter(Boolean).join(" ") || undefined;

  return (
    <div className="end-of-turn">
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

      <div className="end-of-turn__steps" ref={tableRef}>
        <Paper variant="outlined" className="end-of-turn__step" data-testid="end-of-turn-draw">
          <StepHeading
            title={t.step2}
            info={
              <Typography variant="body1">
                {drawChoice > 1 ? t.drawChoiceInfo(tr(chosenCard!.name), drawChoice) : t.drawInfo}{" "}
                {game.drawsExtra && t.extraDrawInfo(session.scenario.extraDraws!.turns)}
                {t.tapCard}
              </Typography>
            }
          >
            <CardPiles
              drawPileCount={game.drawPileCount}
              discardPileCount={game.discardPileCount}
              deckRef={deckRef}
              discardRef={discardRef}
            />
          </StepHeading>
          {drawOptions.length > 0 ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {t.pickOne}
              </Typography>
              <Box className="end-of-turn__cards">
                {drawOptions.map((card, i) => (
                  <motion.div
                    key={card.id}
                    data-option-id={card.id}
                    className="end-of-turn__table-card"
                    initial={{ y: -40, opacity: 0, rotate: -6 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    transition={{ delay: i * (STAGGER_MS / 1000) }}
                  >
                    <CommandCardComponent faction={faction} cardData={card} onClick={() => setLooking({ command: card })} />
                    <Button onClick={() => keepCard(card)} disabled={busy} aria-label={t.chooseLabel(tr(card.name))}>
                      {t.choose}
                    </Button>
                  </motion.div>
                ))}
              </Box>
            </>
          ) : drawnCard ? (
            <Stack sx={{ gap: 1, alignItems: "flex-start" }}>
              <Typography variant="body1" data-testid="drawn-card">
                {game.drewAgain ? t.drewAgain(tr(drawnCard.name)) : t.drew(tr(drawnCard.name))}
              </Typography>
              {game.canDrawAgain && (
                <Button variant="outlined" onClick={drawAgain} disabled={busy} startIcon={<GameIcon name="cards" />}>
                  {t.drawAgain}
                </Button>
              )}
            </Stack>
          ) : (
            <Button onClick={onDrawCard} startIcon={<GameIcon name="cards" />} sx={{ alignSelf: "flex-start" }}>
              {drawChoice > 1 ? t.drawCards(drawChoice) : t.drawCard}
              {game.drawsExtra && " +1"}
            </Button>
          )}
        </Paper>

        <Paper variant="outlined" className="end-of-turn__step" data-testid="end-of-turn-reward" ref={rewardRef}>
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
            <Typography variant="body1">{t.cardReward(reward.coins, !!reward.combatCard)}</Typography>
          ) : game.rewardChoice === null ? (
            <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <ToggleButtonGroup
                exclusive
                value={selection}
                onChange={(_, choice: RewardChoice | null) => choice && setSelection(choice)}
                disabled={coinsFlying}
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
              <Button onClick={confirmReward} disabled={coinsFlying} startIcon={<GameIcon name="confirm" />}>
                {t.confirm}
              </Button>
            </Stack>
          ) : (
            game.rewardChoice === "coins" && <Typography variant="body1">{t.tookCoins(END_OF_TURN_COINS)}</Typography>
          )}
          {game.combatCardDue && (
            <Button
              onClick={() => session.drawCombatCard()}
              startIcon={<GameIcon name="cards" />}
              sx={{ alignSelf: "flex-start" }}
            >
              {t.drawCombatCard}
            </Button>
          )}
          {game.drawnCombatCard && !discarding && (
            <Typography variant="body1">{t.drewCombatCard(tr(game.drawnCombatCard.name))}</Typography>
          )}
          {discarding && (
            <Box data-testid="discard-combat-card">
              <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                {t.tooManyCombatCards(MAX_COMBAT_HAND)}
              </Alert>
              {/* The combat cards come up out of the hand to pick the one to throw away */}
              <Box className="end-of-turn__cards">
                {game.combatHand.map((card, i) => (
                  <motion.div
                    key={card.id}
                    data-discard-id={card.id}
                    className="end-of-turn__table-card"
                    initial={{ y: 120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <CombatCardComponent
                      faction={faction}
                      card={card}
                      selected={card === game.drawnCombatCard}
                      onClick={(c) => setLooking({ combat: c })}
                    />
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => discardCombatCard(card)}
                      disabled={busy}
                      aria-label={t.discardLabel(tr(card.name))}
                    >
                      {t.discard}
                    </Button>
                  </motion.div>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      </div>

      {/* The hand, as in the Command Zone: command cards by section, then the combat cards */}
      <section className="end-of-turn__hand" aria-labelledby="end-hand-title" ref={handRef}>
        {/* Its title, and the next turn button on the same line, always in sight */}
        <div className="end-of-turn__hand-bar">
          <Typography variant="overline" component="h3" id="end-hand-title" className="hand-group__title">
            {t.handCount(game.hand.length, game.combatHand.length)}
          </Typography>
        <div className="end-of-turn__footer">
          <Button
            size="large"
            onClick={onEndTurn}
            disabled={!!pendingStep || busy}
            startIcon={<GameIcon name="endTurn" />}
          >
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
          cards={[
            ...handCommand.map((card) => ({
              key: card.id,
              label: card === drawnCard ? t.newCard : card === game.extraDrawn ? t.extraCard : undefined,
              className: slotClass(card.id, card === drawnCard || card === game.extraDrawn),
              node: <CommandCardComponent faction={faction} cardData={card} onClick={(c) => setLooking({ command: c })} />,
            })),
            ...handCombat.map((card, i) => ({
              key: combatKey(card),
              groupStart: i === 0,
              label: card === game.drawnCombatCard ? t.newCard : undefined,
              className: slotClass(combatKey(card), card === game.drawnCombatCard),
              node: <CombatCardComponent faction={faction} card={card} onClick={(c) => setLooking({ combat: c })} />,
            })),
          ]}
        />
      </section>

      {flights.map((flight) => (
        <Flight
          key={flight.id}
          from={flight.from}
          to={flight.to}
          delay={flight.delay}
          fade={flight.fade}
          onDone={flight.onDone}
        >
          {flight.node}
        </Flight>
      ))}

      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label={t.card} />
    </div>
  );
}

export default EndOfTurnView;
