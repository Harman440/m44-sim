import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import CommandCard, { SECTIONS, Section } from "../../../game-core/commandCard";
import { defineMessages, useLabels, useLang, useMessages, useTr } from "../../../i18n/useI18n";
import { motion } from "motion/react";
import CommandCardComponent from "../../CommandCardComponent";
import CombatCardComponent from "../../CombatCardComponent";
import CardHand from "../../CardHand";
import CardDetails from "../../CardDetails";
import CardFlip from "../../CardFlip";
import CardPlay, { canPlayIn3D } from "../../CardPlay";
import type { PlayedCard3D } from "../../card3d/CardPlay3D";
import GameIcon from "../../GameIcon";
import { ruleTags } from "../../CommandCardComponent";
import { CombatCard } from "../../../game-core/combatCard";
import { useSound } from "../../../sound";
import "./CardsView.css";

const TEXT = defineMessages({
  es: {
    noCombatInExtraTurn: "En el turno extra no se juegan cartas de combate.",
    playedInBattle: "Se juega durante la batalla.",
    shortOfCoins: (cost: string, have: string) => `Te faltan suministros: cuesta ${cost} y tienes ${have}.`,
    commandZone: "Zona de Mando",
    pickToPlay: "Selecciona una carta para jugarla",
    deck: (n: number) => `Cartas (${n})`,
    discard: (n: number) => `Descarte (${n})`,
    willPlay: (name: string, cost: number) =>
      `Jugarás ${name} (${cost} ${cost === 1 ? "suministro" : "suministros"}) con la carta de mando que elijas.`,
    orderCardsFirst:
      "Para jugar una carta de órdenes este turno, elígela antes que la carta de mando. Las de batalla se juegan en la batalla.",
    tapToSee: "Toca una carta para verla",
    playWith: (name: string) => `Jugar con ${name}`,
    playThis: "Jugar esta carta",
    backToHand: "Devolver a la mano",
    costs: (coins: string) => `Cuesta ${coins}`,
    dontPlay: "No jugarla",
    playWithCommand: "Jugarla con la carta de mando",
    commandCards: "Cartas de mando",
    commandCardsCount: (n: number) => `Cartas de mando (${n})`,
    combatCards: "Cartas de combate",
    combatCardsCount: (n: number) => `Cartas de combate (${n})`,
    noCombatCards: "No tienes cartas de combate.",
    changeSectionTitle: (combat: string, command: string) => `${combat}: ¿a qué sección cambias ${command}?`,
    whichSection: (command: string) => `${command}: ¿en qué sección?`,
    cancel: "Cancelar",
    misfitTitle: (combat: string, command: string) => `${combat} no sirve con ${command}`,
    changeSectionOnly: (combat: string) => `${combat} solo cambia la sección de una carta que da órdenes en una sola sección. `,
    playAloneText: (command: string, combat: string) => `Si juegas ${command} sola, ${combat} se queda en la mano y no se paga.`,
    playWithout: (combat: string) => `Jugar sin ${combat}`,
  },
  en: {
    noCombatInExtraTurn: "No combat cards are played in the extra turn.",
    playedInBattle: "It's played during the battle.",
    shortOfCoins: (cost: string, have: string) => `Not enough supplies: it costs ${cost} and you have ${have}.`,
    commandZone: "Command Zone",
    pickToPlay: "Pick a card to play it",
    deck: (n: number) => `Cards (${n})`,
    discard: (n: number) => `Discard (${n})`,
    willPlay: (name: string, cost: number) =>
      `You'll play ${name} (${cost} ${cost === 1 ? "supply" : "supplies"}) with the command card you pick.`,
    orderCardsFirst:
      "To play an order card this turn, pick it before the command card. Battle cards are played in the battle.",
    tapToSee: "Tap a card to see it",
    playWith: (name: string) => `Play with ${name}`,
    playThis: "Play this card",
    backToHand: "Back to the hand",
    costs: (coins: string) => `Costs ${coins}`,
    dontPlay: "Don't play it",
    playWithCommand: "Play it with the command card",
    commandCards: "Command cards",
    commandCardsCount: (n: number) => `Command cards (${n})`,
    combatCards: "Combat cards",
    combatCardsCount: (n: number) => `Combat cards (${n})`,
    noCombatCards: "You have no combat cards.",
    changeSectionTitle: (combat: string, command: string) => `${combat}: which section do you move ${command} to?`,
    whichSection: (command: string) => `${command}: in which section?`,
    cancel: "Cancel",
    misfitTitle: (combat: string, command: string) => `${combat} doesn't work with ${command}`,
    changeSectionOnly: (combat: string) => `${combat} only changes the section of a card that orders units in a single section. `,
    playAloneText: (command: string, combat: string) => `If you play ${command} alone, ${combat} stays in your hand and isn't paid for.`,
    playWithout: (combat: string) => `Play without ${combat}`,
  },
});

// Must be at least the 0.5s slideDown animation in CardsView.css
export const DEAL_ANIMATION_MS = 600;
export const DEAL_GAP_MS = 150;

/** The card looked at on the table: as tall as the table allows, up to 180px wide (see .cards-table) */
const TABLE_CARD_WIDTH = "min(180px, (100cqh - 40px) * 5 / 7)";

interface CardsViewProps {
  handCards: readonly CommandCard[];
  drawPileCount: number;
  discardPileCount: number;
  dealtCardIds: ReadonlySet<string>;
  onCardDealt: (card: CommandCard) => void;
  /** Play the card; `section` for a card whose section the player picks, `combatCard` to play with it */
  onCardClick: (card: CommandCard, section?: Section, combatCard?: CombatCard) => void;
  /** The card orders units in a section the player picks when playing it (or Tactician changes it) */
  needsSection?: (card: CommandCard, combatCard?: CombatCard) => boolean;
  /** The order combat card does something with this command card (Tactician needs a one-section card) */
  combatCardFits?: (card: CommandCard, combatCard: CombatCard) => boolean;
  combatHand?: readonly CombatCard[];
  /** Combat cards can be played this turn (not in the attacker's extra turn) */
  canPlayCombatCards?: boolean;
  /** Coins to pay for a combat card */
  coins?: number;
  /** Whose unit tokens the card art shows */
  faction?: Faction;
}

function CardsView({
  handCards,
  drawPileCount,
  discardPileCount,
  dealtCardIds,
  onCardDealt,
  onCardClick,
  needsSection = () => false,
  combatCardFits = () => true,
  combatHand = [],
  canPlayCombatCards = false,
  coins = 0,
  faction = "Allies",
}: CardsViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const lang = useLang();
  /** The order combat card to play with the command card */
  const [combatPick, setCombatPick] = useState<CombatCard | null>(null);
  /** A card waiting for its section to be picked */
  const [choosingSection, setChoosingSection] = useState<CommandCard | null>(null);
  /** A card the order combat card can't be played with: asks whether to play it alone */
  const [misfit, setMisfit] = useState<CommandCard | null>(null);
  const [animatingCard, setAnimatingCard] = useState<CommandCard | null>(null);
  /** The card being looked at on the table; a command card is played from there */
  const [looking, setLooking] = useState<{ command: CommandCard } | { combat: CombatCard } | null>(null);
  /** The cards being played, flying to the table in 3D before the turn goes on */
  const [playing, setPlaying] = useState<{
    cards: PlayedCard3D[];
    landing: { x: number; y: number };
    play: () => void;
  } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  /** The cards in flight have been played: the flight's end and its time limit both try */
  const played = useRef(false);
  const play = useSound();

  const visibleHand = handCards.filter((card) => dealtCardIds.has(card.id));
  const nextCardToDeal = handCards.find((card) => !dealtCardIds.has(card.id));

  // Deal hand cards that haven't been shown yet, one at a time. The dealt ids
  // live in GameView, so remounting this view each turn only deals new cards.
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

  /** Tapping a card in the hand puts it on the table to look at; tapping it again puts it back */
  const look = (next: { command: CommandCard } | { combat: CombatCard }) =>
    setLooking((current) =>
      current && ("command" in next ? "command" in current && current.command === next.command : "combat" in current && current.combat === next.combat)
        ? null
        : next
    );
  const lookingAt = (card: CommandCard | CombatCard) =>
    !!looking && ("command" in looking ? looking.command === card : looking.combat === card);

  /** Why an order combat card can't be played now, or null if it can */
  const cantPlay = (card: CombatCard): string | null => {
    if (!canPlayCombatCards) return t.noCombatInExtraTurn;
    if (card.phase === "battle") return t.playedInBattle;
    if (card.cost > coins) return t.shortOfCoins(labels.coins(card.cost), labels.coins(coins));
    return null;
  };

  /**
   * Plays the card: the card on the table and the combat card picked fly to
   * the middle of the table in 3D, then the turn goes on. Straight away
   * without WebGL or with reduced motion.
   */
  const commit = (card: CommandCard, section?: Section, combatCard?: CombatCard) => {
    const go = () => onCardClick(card, section, combatCard);
    const table = tableRef.current;
    const command = table?.querySelector<HTMLElement>(".card-details__card .game-card");
    if (!table || !command || !canPlayIn3D()) {
      go();
      return;
    }
    const combat = combatCard && document.querySelector<HTMLElement>(`.hand-group--combat [data-card-key="${combatCard.id}"] .game-card`);
    const box = table.getBoundingClientRect();
    played.current = false;
    setPlaying({
      cards: [{ element: command }, ...(combat ? [{ element: combat }] : [])],
      landing: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      play: go,
    });
  };

  const finishPlaying = useCallback(() => {
    if (played.current || !playing) return;
    played.current = true;
    setPlaying(null);
    playing.play();
  }, [playing]);
  const landed = useCallback(() => play("cardDeal"), [play]);

  const playCard = (card: CommandCard) => {
    if (combatPick && !combatCardFits(card, combatPick)) {
      setMisfit(card);
      return;
    }
    if (needsSection(card, combatPick ?? undefined)) {
      setChoosingSection(card);
      return;
    }
    commit(card, undefined, combatPick ?? undefined);
  };

  /** Play the card without the combat card, which stays in the hand unpaid */
  const playAlone = () => {
    if (!misfit) return;
    const card = misfit;
    setMisfit(null);
    setCombatPick(null);
    if (needsSection(card)) setChoosingSection(card);
    else commit(card);
  };

  const playInSection = (section: Section) => {
    if (!choosingSection) return;
    commit(choosingSection, section, combatPick ?? undefined);
    setChoosingSection(null);
  };

  return (
    <div className="cards-view">
      <div className="cards-top">
        <Box className="cards-header">
          <Typography variant="h4" component="h3">
            {t.commandZone}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t.pickToPlay}
          </Typography>
        </Box>

        {/* Deck and discard */}
        <div className="top-area">
          <Stack className="pile" sx={{ alignItems: "center" }}>
            <Typography className="pile__label">{t.deck(drawPileCount)}</Typography>
            <div className="deck-pile">
              <div className="deck-back">M'44</div>
            </div>
          </Stack>

          <Stack className="pile" sx={{ alignItems: "center" }}>
            <Typography className="pile__label">{t.discard(discardPileCount)}</Typography>
            <div className="discard-pile">{discardPileCount > 0 && <div className="deck-back">M'44</div>}</div>
          </Stack>
        </div>
      </div>

      {/* The table: what the player is about to play */}
      <Box className="cards-table" ref={tableRef}>
        {/* While a card is looked at, its buttons say what will be played */}
        {looking === null && (
          <Typography variant="body1" color={combatPick ? "primary" : "text.secondary"} sx={{ textAlign: "center", maxWidth: 560 }}>
            {!canPlayCombatCards
              ? t.noCombatInExtraTurn
              : combatPick
                ? t.willPlay(tr(combatPick.name), combatPick.cost)
                : t.orderCardsFirst}
          </Typography>
        )}
        {looking === null ? (
          <Typography variant="h6" component="p" color="text.secondary" sx={{ textAlign: "center" }}>
            {t.tapToSee}
          </Typography>
        ) : "command" in looking ? (
          <CardDetails
            card={
              <CardFlip key={looking.command.id}>
                <CommandCardComponent faction={faction} cardData={looking.command} />
              </CardFlip>
            }
            cardWidth={TABLE_CARD_WIDTH}
            name={tr(looking.command.name)}
            tags={ruleTags(looking.command, lang)}
            text={tr(looking.command.description)}
            actionsBeside
          >
            <Button size="large" onClick={() => playCard(looking.command)} startIcon={<GameIcon name="cards" />}>
              {combatPick ? t.playWith(tr(combatPick.name)) : t.playThis}
            </Button>
            <Button variant="text" onClick={() => setLooking(null)}>
              {t.backToHand}
            </Button>
          </CardDetails>
        ) : (
          <CardDetails
            card={
              <CardFlip key={looking.combat.id}>
                <CombatCardComponent faction={faction} card={looking.combat} />
              </CardFlip>
            }
            cardWidth={TABLE_CARD_WIDTH}
            name={tr(looking.combat.name)}
            tags={[labels.combatPhases[looking.combat.phase], t.costs(labels.coins(looking.combat.cost))]}
            text={tr(looking.combat.description)}
            actionsBeside
          >
            {cantPlay(looking.combat) ? (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                {cantPlay(looking.combat)}
              </Typography>
            ) : combatPick === looking.combat ? (
              <Button variant="outlined" onClick={() => setCombatPick(null)}>
                {t.dontPlay}
              </Button>
            ) : (
              <Button
                size="large"
                onClick={() => {
                  setCombatPick(looking.combat);
                  setLooking(null);
                }}
                startIcon={<GameIcon name="cards" />}
              >
                {t.playWithCommand}
              </Button>
            )}
            <Button variant="text" onClick={() => setLooking(null)}>
              {t.backToHand}
            </Button>
          </CardDetails>
        )}
      </Box>

      {/* The hands: command cards, and the combat cards on the right */}
      <div className="cards-hands">
        <section className="cards-grid hand-group" aria-labelledby="command-hand-title">
          <Typography variant="overline" component="h3" id="command-hand-title" className="hand-group__title">
            {t.commandCardsCount(visibleHand.length)}
          </Typography>
          <CardHand
            label={t.commandCards}
            cards={visibleHand.map((card) => ({
              key: card.id,
              lifted: lookingAt(card),
              node: <CommandCardComponent faction={faction} cardData={card} onClick={(c) => look({ command: c })} />,
            }))}
          />
        </section>

        <section className="cards-combat hand-group hand-group--combat" aria-labelledby="combat-hand-title">
          <Typography variant="overline" component="h3" id="combat-hand-title" className="hand-group__title">
            {t.combatCardsCount(combatHand.length)}
          </Typography>
          {combatHand.length === 0 ? (
            <Typography variant="body2" color="text.secondary" className="hand-group__empty">
              {t.noCombatCards}
            </Typography>
          ) : (
            <CardHand
              label={t.combatCards}
              overlap={0.3}
              cards={combatHand.map((card) => ({
                key: card.id,
                lifted: combatPick === card || lookingAt(card),
                // Any combat card can be looked at; only an order card that can be paid is played
                node: (
                  <CombatCardComponent
                    faction={faction}
                    card={card}
                    selected={combatPick === card}
                    disabled={card.phase === "order" && cantPlay(card) !== null}
                    onClick={(c) => look({ combat: c })}
                  />
                ),
              }))}
            />
          )}
        </section>
      </div>

      <Dialog open={choosingSection !== null} onClose={() => setChoosingSection(null)}>
        <DialogTitle>
          {combatPick?.effect?.kind === "changeSection" && !choosingSection?.choosesSection
            ? t.changeSectionTitle(tr(combatPick.name), choosingSection ? tr(choosingSection.name) : "")
            : t.whichSection(choosingSection ? tr(choosingSection.name) : "")}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", pt: 1 }}>
            {SECTIONS.map((section) => (
              <Button key={section} size="large" onClick={() => playInSection(section)} sx={{ flex: "1 1 120px" }}>
                {labels.sections[section]}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setChoosingSection(null)}>
            {t.cancel}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={misfit !== null} onClose={() => setMisfit(null)}>
        <DialogTitle>
          {t.misfitTitle(combatPick ? tr(combatPick.name) : "", misfit ? tr(misfit.name) : "")}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {combatPick?.effect?.kind === "changeSection" ? t.changeSectionOnly(tr(combatPick.name)) : ""}
            {t.playAloneText(misfit ? tr(misfit.name) : "", combatPick ? tr(combatPick.name) : "")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setMisfit(null)}>
            {t.cancel}
          </Button>
          <Button onClick={playAlone}>{t.playWithout(combatPick ? tr(combatPick.name) : "")}</Button>
        </DialogActions>
      </Dialog>

      {playing && <CardPlay cards={playing.cards} landing={playing.landing} onLanded={landed} onDone={finishPlaying} />}

      {/* Animating Card Overlay */}
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
          <CommandCardComponent faction={faction} cardData={animatingCard} onClick={() => {}} />
        </motion.div>
      )}
    </div>
  );
}

export default CardsView;
