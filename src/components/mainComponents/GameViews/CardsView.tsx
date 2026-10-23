import InfoButton from "../../InfoButton";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import { motion } from "motion/react";
import type { ActionCard } from "../../../game-core/actionCard";
import type { GameSnapshot } from "../../../game-core/gameSession";
import ActionCardComponent from "../../ActionCardComponent";
import CardHand from "../../CardHand";
import Flight, { Box as ScreenBox, boxOf } from "../../Flight";
import CardDetails from "../../CardDetails";
import CardFlip from "../../CardFlip";
import { PLAY_FLIGHT, PLAY_LAYOUT_PREFIX } from "../../PlayedCards";
import GameIcon from "../../GameIcon";
import { useSound } from "../../../sound";
import HandAwayBar from "./HandAwayBar";
import "./CardsView.css";

const TEXT = defineMessages({
  es: {
    shortOfCoins: (cost: string, have: string) => `Te faltan suministros: cuesta ${cost} y tienes ${have}.`,
    cooldown: (n: number) => (n === 1 ? "Se jugó hace poco: vuelve en 1 turno." : `Se jugó hace poco: vuelve en ${n} turnos.`),
    pickCard: "Elige una carta, o juega sin carta",
    yourPlay: "Tu jugada",
    yourUnits: "Tus unidades",
    remove: "Quitar",
    removeCard: (name: string) => `Quitar ${name}`,
    play: "Jugar",
    noCard: "Sin carta",
    howToPick:
      "Puedes jugar una carta por turno, o ninguna. Cada una cuesta suministros y, una vez jugada, tarda unos turnos en volver.",
    pick: "Elegir",
    swapFor: "Cambiar por esta",
    unpick: "Devolver a la mano",
    close: "Cerrar",
    costs: (coins: string) => `Cuesta ${coins}`,
    hand: "Tu mano",
    handCount: (n: number) => `Cartas de mando (${n})`,
  },
  en: {
    shortOfCoins: (cost: string, have: string) => `Not enough supplies: it costs ${cost} and you have ${have}.`,
    cooldown: (n: number) => (n === 1 ? "Played recently: back in 1 turn." : `Played recently: back in ${n} turns.`),
    pickCard: "Pick a card, or play without one",
    yourPlay: "Your play",
    yourUnits: "Your units",
    remove: "Remove",
    removeCard: (name: string) => `Remove ${name}`,
    play: "Play",
    noCard: "No card",
    howToPick: "You can play one card a turn, or none. Each costs supplies and, once played, takes a few turns to come back.",
    pick: "Pick",
    swapFor: "Swap for this one",
    unpick: "Back to the hand",
    close: "Close",
    costs: (coins: string) => `Costs ${coins}`,
    hand: "Your hand",
    handCount: (n: number) => `Command cards (${n})`,
  },
});

// Must be at least the 0.5s slideDown animation in CardsView.css
export const DEAL_ANIMATION_MS = 600;
export const DEAL_GAP_MS = 150;

/** The card looked at on the table: as tall as the table allows, up to 180px wide (see .cards-table) */
const TABLE_CARD_WIDTH = "min(160px, (100cqh - 40px) * 5 / 7)";

type HeldCard = GameSnapshot["cards"][number];

interface CardsViewProps {
  /** The side's cards, with their cost, cooldown and whether they can be played now */
  cards: GameSnapshot["cards"];
  dealtCardIds: ReadonlySet<string>;
  onCardDealt: (card: ActionCard) => void;
  /** Play the card picked, or none (null) */
  onPlay: (card: ActionCard | null) => void;
  /** Supplies to pay for a card */
  coins?: number;
  /**
   * Pass and play: the map, zoomable, on the left of the table (the tray beside it), and
   * alone in place of the table and the hand when the cards are put away
   */
  largeMap?: ReactNode;
  /** This side's units, on the left of the table: what each one has left, to pick the card with */
  units?: ReactNode;
  /**
   * The card played before "Cambiar carta" brought the player back here: it starts in the tray
   * (flying back from the orders screen) and the hand slides up
   */
  initialPick?: ActionCard | null;
}

function CardsView({ cards, dealtCardIds, onCardDealt, onPlay, coins = 0, largeMap, units, initialPick = null }: CardsViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const heldOf = (card: ActionCard) => cards.find((held) => held.card.id === card.id);
  /** The card picked to play; it leaves the hand for the tray */
  const [pick, setPick] = useState<ActionCard | null>(() => (initialPick && heldOf(initialPick) ? initialPick : null));
  /** Back from the orders: the card flies back to the tray on its own (layoutId), with no entrance of its own */
  const [returned] = useState(() => initialPick?.id ?? null);
  const [animatingCard, setAnimatingCard] = useState<ActionCard | null>(null);
  /** The card being looked at on the table, from the hand or the tray */
  const [looking, setLooking] = useState<ActionCard | null>(null);
  /** Pass and play: the cards are put away and the map shows large (the pick stays) */
  const [handAway, setHandAway] = useState(false);
  /** The hand slides (back) in after it was put away, or back from the orders; not when the view opens */
  const [handMoved, setHandMoved] = useState(initialPick !== null);
  const toggleHand = () => {
    setLooking(null);
    setHandMoved(true);
    setHandAway((away) => !away);
  };
  /** A card tapped in the hand, flying to the tray */
  const [flying, setFlying] = useState<{ id: string; node: ReactNode; from: ScreenBox; to: ScreenBox } | null>(null);
  const handRef = useRef<HTMLElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  const play = useSound();

  const visibleHand = cards.filter(({ card }) => dealtCardIds.has(card.id));
  const nextCardToDeal = cards.find(({ card }) => !dealtCardIds.has(card.id))?.card;
  const inHand = visibleHand.filter(({ card }) => card.id !== pick?.id);

  // Deal the cards that haven't been shown yet, one at a time. The dealt ids live in GameView,
  // so remounting this view each turn doesn't deal them again.
  useEffect(() => {
    if (animatingCard) {
      const timer = setTimeout(() => {
        onCardDealt(animatingCard);
        setAnimatingCard(null);
      }, DEAL_ANIMATION_MS);
      return () => clearTimeout(timer);
    }

    if (!nextCardToDeal) return;
    const timer = setTimeout(() => setAnimatingCard(nextCardToDeal), DEAL_GAP_MS);
    return () => clearTimeout(timer);
  }, [animatingCard, nextCardToDeal, onCardDealt]);

  useEffect(() => {
    if (animatingCard) play("cardDeal");
  }, [animatingCard, play]);

  /** Why a card can't be played now, or null if it can */
  const cantPlay = (held: HeldCard): string | null => {
    if (held.playable) return null;
    if (held.turnsLeft > 0) return t.cooldown(held.turnsLeft);
    return t.shortOfCoins(labels.coins(held.cost), labels.coins(coins));
  };

  /** Tapping a card puts it on the table to look at; tapping it again puts it back */
  const look = (card: ActionCard) => setLooking((current) => (current?.id === card.id ? null : card));

  const cardNode = (held: HeldCard, onClick?: (card: ActionCard) => void) => (
    <ActionCardComponent card={held.card} cost={held.cost} turnsLeft={held.turnsLeft} disabled={!held.playable} onClick={onClick} />
  );

  /** Picking a card puts it in the tray (in place of the one there), where its text shows */
  const pickCard = (card: ActionCard, fromHand = false) => {
    const held = heldOf(card);
    if (!held) return;
    if (fromHand) {
      const from = boxOf(handRef.current?.querySelector(`[data-card-key="${card.id}"] .game-card`));
      const to = boxOf(trayRef.current?.querySelector(".cards-tray__card--command"));
      if (from && to) setFlying({ id: card.id, node: cardNode(held), from, to });
    }
    setPick(card);
    setLooking(null);
    play("cardDeal");
  };

  /** Tapping a card in the hand puts it in the tray when that's empty and it can be played; otherwise it goes on the table */
  const tapCard = (card: ActionCard) => {
    const held = heldOf(card);
    if (!pick && held?.playable) pickCard(card, true);
    else look(card);
  };
  const landedInTray = (id: string) => setFlying((current) => (current?.id === id ? null : current));
  const unpick = () => {
    if (looking && looking.id === pick?.id) setLooking(null);
    setPick(null);
  };

  /** Plays the card (or none): the turn goes on to the orders, where the card in the tray flies to (its layoutId) */
  const commit = (card: ActionCard | null) => {
    setLooking(null);
    onPlay(card);
  };

  const pickHeld = pick ? heldOf(pick) : undefined;
  const lookingHeld = looking ? heldOf(looking) : undefined;

  return (
    <div className={`cards-view${largeMap ? " cards-view--with-map" : ""}`}>
      {handAway && largeMap ? (
        <motion.div
          className="cards-view__map"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          {largeMap}
        </motion.div>
      ) : (
        <>
          {/* The table: pass and play's map on the left; the tray with the card picked to play, and the card looked at */}
          <Box className={`cards-table${largeMap ? " cards-table--with-map" : ""}`}>
            {units && (
              <section className="cards-table__units" aria-label={t.yourUnits}>
                {units}
              </section>
            )}
            {largeMap && <div className="cards-table__map">{largeMap}</div>}
            <div className="cards-table__side">
              <section className="cards-tray" ref={trayRef} aria-label={t.yourPlay}>
                <div className="cards-tray__stack">
                  <div className={`cards-tray__card cards-tray__card--command${pickHeld ? "" : " cards-tray__card--empty"}`}>
                    {pickHeld && (
                      <motion.div
                        key={pickHeld.card.id}
                        layoutId={`${PLAY_LAYOUT_PREFIX}${pickHeld.card.id}`}
                        initial={returned === pickHeld.card.id ? false : { y: 24, opacity: 0, scale: 1.2 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ layout: PLAY_FLIGHT }}
                        style={{ visibility: flying?.id === pickHeld.card.id ? "hidden" : undefined }}
                      >
                        {cardNode(pickHeld, look)}
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* One line: what to do, or the card picked; tapping the card shows its text */}
                <div className="cards-tray__lines">
                  {pickHeld ? (
                    <Typography sx={{ fontWeight: 600 }} className="cards-tray__name">
                      {tr(pickHeld.card.name)}
                      <Typography component="span" variant="body2" color="text.secondary">
                        {` · ${labels.coins(pickHeld.cost)}`}
                      </Typography>
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary" className="cards-tray__prompt">
                      {t.pickCard}
                    </Typography>
                  )}
                  {pickHeld ? (
                    <Button variant="text" size="small" aria-label={t.removeCard(tr(pickHeld.card.name))} onClick={unpick}>
                      {t.remove}
                    </Button>
                  ) : (
                    <InfoButton title={t.yourPlay}>
                      <Typography variant="body1">{t.howToPick}</Typography>
                    </InfoButton>
                  )}
                </div>

                {pickHeld ? (
                  <Button size="large" className="cards-tray__play" onClick={() => commit(pick)} startIcon={<GameIcon name="cards" />}>
                    {t.play}
                  </Button>
                ) : (
                  <Button size="large" variant="outlined" onClick={() => commit(null)}>
                    {t.noCard}
                  </Button>
                )}
              </section>

              {/* Picking a card from here puts it in the tray, and the table clears */}
              {lookingHeld && (
                <div className="cards-table__look">
                  <CardDetails
                    card={<CardFlip key={lookingHeld.card.id}>{cardNode(lookingHeld)}</CardFlip>}
                    cardWidth={TABLE_CARD_WIDTH}
                    name={tr(lookingHeld.card.name)}
                    tags={[t.costs(labels.coins(lookingHeld.cost))]}
                    text={tr(lookingHeld.card.description)}
                  >
                    {pick?.id === lookingHeld.card.id ? (
                      <Button variant="outlined" onClick={unpick}>
                        {t.unpick}
                      </Button>
                    ) : cantPlay(lookingHeld) ? (
                      <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                        {cantPlay(lookingHeld)}
                      </Typography>
                    ) : (
                      <Button size="large" onClick={() => pickCard(lookingHeld.card)} startIcon={<GameIcon name="confirm" />}>
                        {pick ? t.swapFor : t.pick}
                      </Button>
                    )}
                    <Button variant="text" onClick={() => setLooking(null)}>
                      {t.close}
                    </Button>
                  </CardDetails>
                </div>
              )}
            </div>
          </Box>

          {/* The hand: every card the side holds, the ones it can't play now faded; the picked card is in the tray */}
          <motion.section
            className="cards-hands"
            aria-labelledby="hand-title"
            ref={handRef}
            initial={handMoved ? { y: 120, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <Typography variant="overline" component="h3" id="hand-title" className="hand-group__title">
              {t.handCount(visibleHand.length)}
            </Typography>
            <CardHand
              label={t.hand}
              fit
              overlap={0.12}
              cards={inHand.map((held) => ({
                key: held.card.id,
                lifted: looking?.id === held.card.id,
                className: held.playable ? "hand-card--playable" : undefined,
                node: cardNode(held, tapCard),
              }))}
            />
          </motion.section>
        </>
      )}

      {largeMap && <HandAwayBar away={handAway} onToggle={toggleHand} />}

      {flying && (
        <Flight key={flying.id} from={flying.from} to={flying.to} onDone={() => landedInTray(flying.id)}>
          {flying.node}
        </Flight>
      )}

      {/* Flies from the deck into the hand; keyed so each card gets its own flight */}
      {animatingCard && (
        <motion.div
          key={animatingCard.id}
          className="animating-card"
          data-testid="animating-card"
          initial={{ x: "-50%", y: "-160%", rotate: -14, scale: 0.85, opacity: 0 }}
          animate={{ x: "-50%", y: "-50%", rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          <ActionCardComponent card={animatingCard} onClick={() => {}} />
        </motion.div>
      )}
    </div>
  );
}

export default CardsView;
