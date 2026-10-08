import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import CommandCard, { SECTIONS, Section } from "../../../game-core/commandCard";
import { defineMessages, useLabels, useLang, useMessages, useTr } from "../../../i18n/useI18n";
import { motion } from "motion/react";
import CommandCardComponent from "../../CommandCardComponent";
import CombatCardComponent from "../../CombatCardComponent";
import CardHand from "../../CardHand";
import CardPiles from "../../CardPiles";
import Flight, { Box as ScreenBox, boxOf } from "../../Flight";
import CardDetails from "../../CardDetails";
import CardFlip from "../../CardFlip";
import CardPlay, { canPlayIn3D } from "../../CardPlay";
import type { PlayedCard3D } from "../../card3d/CardPlay3D";
import GameIcon from "../../GameIcon";
import { ruleTags } from "../../CommandCardComponent";
import { CombatCard } from "../../../game-core/combatCard";
import { sortCombatHand, sortCommandHand } from "../../../game-core/handOrder";
import { useSound } from "../../../sound";
import "./CardsView.css";

const TEXT = defineMessages({
  es: {
    noCombatInExtraTurn: "En el turno extra no se juegan cartas de combate.",
    playedInBattle: "Se juega durante la batalla.",
    shortOfCoins: (cost: string, have: string) => `Te faltan suministros: cuesta ${cost} y tienes ${have}.`,
    commandZone: "Zona de Mando",
    pickCommand: "Elige una carta de mando",
    addCombat: "Añade una carta de combate si quieres, y juega",
    readyToPlay: "Listo: pulsa Jugar",
    yourPlay: "Tu jugada",
    commandSlot: "Mando",
    combatSlot: "Combate",
    noCommandYet: "Sin elegir",
    noCombatYet: "Opcional",
    noOrderCombat: "Ninguna se juega en las órdenes",
    sectionOnPlay: "sección al jugar",
    remove: "Quitar",
    removeCard: (name: string) => `Quitar ${name}`,
    play: "Jugar",
    howToPick:
      "Elige una carta de mando y, si quieres, una carta de combate de órdenes, en el orden que quieras. Las de batalla se juegan en la batalla.",
    tapToSee: "Toca una carta para verla",
    pick: "Elegir",
    swapFor: "Cambiar por esta",
    unpick: "Devolver a la mano",
    close: "Cerrar",
    costs: (coins: string) => `Cuesta ${coins}`,
    hand: "Tu mano",
    handCount: (command: number, combat: number) => `Cartas de mando (${command}) · Cartas de combate (${combat})`,
    changeSectionTitle: (combat: string, command: string) => `${combat}: ¿a qué sección cambias ${command}?`,
    whichSection: (command: string) => `${command}: ¿en qué sección?`,
    cancel: "Cancelar",
    misfit: (combat: string, command: string) => `${combat} no sirve con ${command}: quita una de las dos.`,
    changeSectionOnly: (combat: string) => `${combat} solo cambia la sección de una carta que da órdenes en una sola sección.`,
  },
  en: {
    noCombatInExtraTurn: "No combat cards are played in the extra turn.",
    playedInBattle: "It's played during the battle.",
    shortOfCoins: (cost: string, have: string) => `Not enough supplies: it costs ${cost} and you have ${have}.`,
    commandZone: "Command Zone",
    pickCommand: "Pick a command card",
    addCombat: "Add a combat card if you like, and play",
    readyToPlay: "Ready: tap Play",
    yourPlay: "Your play",
    commandSlot: "Command",
    combatSlot: "Combat",
    noCommandYet: "Not picked",
    noCombatYet: "Optional",
    noOrderCombat: "None is played with the orders",
    sectionOnPlay: "section when played",
    remove: "Remove",
    removeCard: (name: string) => `Remove ${name}`,
    play: "Play",
    howToPick:
      "Pick a command card and, if you like, an order combat card, in any order. Battle cards are played in the battle.",
    tapToSee: "Tap a card to see it",
    pick: "Pick",
    swapFor: "Swap for this one",
    unpick: "Back to the hand",
    close: "Close",
    costs: (coins: string) => `Costs ${coins}`,
    hand: "Your hand",
    handCount: (command: number, combat: number) => `Command cards (${command}) · Combat cards (${combat})`,
    changeSectionTitle: (combat: string, command: string) => `${combat}: which section do you move ${command} to?`,
    whichSection: (command: string) => `${command}: in which section?`,
    cancel: "Cancel",
    misfit: (combat: string, command: string) => `${combat} doesn't work with ${command}: remove one of them.`,
    changeSectionOnly: (combat: string) => `${combat} only changes the section of a card that orders units in a single section.`,
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
  /** The command card picked to play; it leaves the hand for the tray */
  const [commandPick, setCommandPick] = useState<CommandCard | null>(null);
  /** The order combat card picked to play with it */
  const [combatPick, setCombatPick] = useState<CombatCard | null>(null);
  /** The picked card waiting for its section to be picked */
  const [choosingSection, setChoosingSection] = useState<CommandCard | null>(null);
  const [animatingCard, setAnimatingCard] = useState<CommandCard | null>(null);
  /** The card being looked at on the table, from the hand or the tray */
  const [looking, setLooking] = useState<{ command: CommandCard } | { combat: CombatCard } | null>(null);
  /** The cards being played, flying to the table in 3D before the turn goes on */
  const [playing, setPlaying] = useState<{
    cards: PlayedCard3D[];
    landing: { x: number; y: number };
    play: () => void;
  } | null>(null);
  /** A card tapped in the hand, flying to its empty slot in the tray */
  const [flying, setFlying] = useState<{ id: string; node: ReactNode; from: ScreenBox; to: ScreenBox } | null>(null);
  const handRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  /** The cards in flight have been played: the flight's end and its time limit both try */
  const played = useRef(false);
  const play = useSound();

  const visibleHand = handCards.filter((card) => dealtCardIds.has(card.id));
  const nextCardToDeal = handCards.find((card) => !dealtCardIds.has(card.id));
  const orderCombatCards = combatHand.filter((card) => card.phase === "order");
  const handCommand = sortCommandHand(visibleHand.filter((card) => card !== commandPick));

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

  /** Tapping a card puts it on the table to look at; tapping it again puts it back */
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
  const handCombat = sortCombatHand(
    combatHand.filter((card) => card !== combatPick),
    (card) => cantPlay(card) === null
  );

  /** A card picked straight from the hand flies from its place there to its slot in the tray */
  const flyToTray = (handKey: string, slot: "command" | "combat", node: ReactNode) => {
    const from = boxOf(handRef.current?.querySelector(`[data-card-key="${handKey}"] .game-card`));
    const to = boxOf(trayRef.current?.querySelector(`.cards-tray__card--${slot}`));
    if (from && to) setFlying({ id: handKey, node, from, to });
  };

  /**
   * Picking a card puts it in the tray (in place of the one there). Picked from
   * the table, the table clears; tapped in the hand, its text stays on the table to read
   */
  const pickCommand = (card: CommandCard, fromHand = false) => {
    if (fromHand) flyToTray(card.id, "command", <CommandCardComponent faction={faction} cardData={card} />);
    setCommandPick(card);
    setLooking(fromHand ? { command: card } : null);
    play("cardDeal");
  };
  const pickCombat = (card: CombatCard, fromHand = false) => {
    if (fromHand) flyToTray(`combat-${card.id}`, "combat", <CombatCardComponent faction={faction} card={card} />);
    setCombatPick(card);
    setLooking(fromHand ? { combat: card } : null);
    play("cardDeal");
  };

  /**
   * Tapping a card in the hand puts it straight in its slot when that is
   * empty (a combat card only if it can be played now); otherwise it goes on
   * the table to be looked at, and swapped from there
   */
  const tapCommand = (card: CommandCard) => (commandPick ? look({ command: card }) : pickCommand(card, true));
  const tapCombat = (card: CombatCard) =>
    !combatPick && cantPlay(card) === null ? pickCombat(card, true) : look({ combat: card });
  const landedInTray = (id: string) => setFlying((current) => (current?.id === id ? null : current));
  const unpick = (card: CommandCard | CombatCard) => {
    if (card === commandPick) setCommandPick(null);
    if (card === combatPick) setCombatPick(null);
    if (lookingAt(card)) setLooking(null);
  };

  /** The two cards picked can't be played together (Tactician needs a one-section card) */
  const misfit = !!commandPick && !!combatPick && !combatCardFits(commandPick, combatPick);

  /**
   * Plays the cards: the cards in the tray fly to the middle of the table in
   * 3D, then the turn goes on. Straight away without WebGL or with reduced motion.
   */
  const commit = (card: CommandCard, section?: Section) => {
    const combatCard = combatPick ?? undefined;
    const go = () => onCardClick(card, section, combatCard);
    const table = tableRef.current;
    const command = trayRef.current?.querySelector<HTMLElement>(".cards-tray__card--command .game-card");
    if (!table || !command || !canPlayIn3D()) {
      go();
      return;
    }
    const combat = combatCard && trayRef.current?.querySelector<HTMLElement>(".cards-tray__card--combat .game-card");
    const box = table.getBoundingClientRect();
    played.current = false;
    setLooking(null);
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

  const playPicked = () => {
    if (!commandPick || misfit) return;
    if (needsSection(commandPick, combatPick ?? undefined)) {
      setChoosingSection(commandPick);
      return;
    }
    commit(commandPick);
  };

  const playInSection = (section: Section) => {
    if (!choosingSection) return;
    commit(choosingSection, section);
    setChoosingSection(null);
  };

  const prompt = !commandPick ? t.pickCommand : misfit ? null : combatPick || orderCombatCards.length === 0 || !canPlayCombatCards ? t.readyToPlay : t.addCombat;

  return (
    <div className="cards-view">
      <div className="cards-top">
        <Box className="cards-header">
          <Typography variant="h4" component="h3">
            {t.commandZone}
          </Typography>
          {prompt && (
            <Typography variant="body2" color={commandPick ? "primary" : "text.secondary"}>
              {prompt}
            </Typography>
          )}
        </Box>

        {/* The tray: the cards picked to play, stacked, each with its line */}
        <section className="cards-tray" ref={trayRef} aria-label={t.yourPlay}>
          <div className="cards-tray__stack">
            <div className={`cards-tray__card cards-tray__card--combat${combatPick ? "" : " cards-tray__card--empty"}`}>
              {combatPick && (
                <motion.div
                  key={combatPick.id}
                  initial={{ y: 24, opacity: 0, scale: 1.2 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  style={{ visibility: flying?.id === `combat-${combatPick.id}` ? "hidden" : undefined }}
                >
                  <CombatCardComponent faction={faction} card={combatPick} onClick={(c) => look({ combat: c })} />
                </motion.div>
              )}
            </div>
            <div className={`cards-tray__card cards-tray__card--command${commandPick ? "" : " cards-tray__card--empty"}`}>
              {commandPick && (
                <motion.div
                  key={commandPick.id}
                  initial={{ y: 24, opacity: 0, scale: 1.2 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  style={{ visibility: flying?.id === commandPick.id ? "hidden" : undefined }}
                >
                  <CommandCardComponent faction={faction} cardData={commandPick} onClick={(c) => look({ command: c })} />
                </motion.div>
              )}
            </div>
          </div>

          <Stack className="cards-tray__lines">
            <div className="cards-tray__line">
              <Typography variant="overline" className="cards-tray__slot">
                {t.commandSlot}
              </Typography>
              <Typography className="cards-tray__name" color={commandPick ? "text.primary" : "text.secondary"}>
                {commandPick ? tr(commandPick.name) : t.noCommandYet}
                {commandPick?.choosesSection && (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {` · ${t.sectionOnPlay}`}
                  </Typography>
                )}
              </Typography>
              {commandPick && (
                <Button variant="text" size="small" aria-label={t.removeCard(tr(commandPick.name))} onClick={() => unpick(commandPick)}>
                  {t.remove}
                </Button>
              )}
            </div>
            <div className="cards-tray__line">
              <Typography variant="overline" className="cards-tray__slot">
                {t.combatSlot}
              </Typography>
              <Typography className="cards-tray__name" color={combatPick ? "text.primary" : "text.secondary"}>
                {combatPick
                  ? tr(combatPick.name)
                  : !canPlayCombatCards
                    ? t.noCombatInExtraTurn
                    : orderCombatCards.length === 0
                      ? t.noOrderCombat
                      : t.noCombatYet}
                {combatPick && (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {` · ${labels.coins(combatPick.cost)}`}
                  </Typography>
                )}
              </Typography>
              {combatPick && (
                <Button variant="text" size="small" aria-label={t.removeCard(tr(combatPick.name))} onClick={() => unpick(combatPick)}>
                  {t.remove}
                </Button>
              )}
            </div>
            {misfit && (
              <Typography variant="body2" color="error" role="alert">
                {combatPick.effect?.kind === "changeSection" ? `${t.changeSectionOnly(tr(combatPick.name))} ` : ""}
                {t.misfit(tr(combatPick.name), tr(commandPick.name))}
              </Typography>
            )}
          </Stack>

          <Button size="large" className="cards-tray__play" disabled={!commandPick || misfit} onClick={playPicked} startIcon={<GameIcon name="cards" />}>
            {t.play}
          </Button>
        </section>

        {/* Deck and discard */}
        <CardPiles drawPileCount={drawPileCount} discardPileCount={discardPileCount} />
      </div>

      {/* The table: the card looked at, picked from there */}
      <Box className="cards-table" ref={tableRef}>
        {looking === null ? (
          <>
            <Typography variant="h6" component="p" color="text.secondary" sx={{ textAlign: "center" }}>
              {t.tapToSee}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: "center", maxWidth: 560 }}>
              {canPlayCombatCards ? t.howToPick : t.noCombatInExtraTurn}
            </Typography>
          </>
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
            {commandPick === looking.command ? (
              <Button variant="outlined" onClick={() => unpick(looking.command)}>
                {t.unpick}
              </Button>
            ) : (
              <Button size="large" onClick={() => pickCommand(looking.command)} startIcon={<GameIcon name="confirm" />}>
                {commandPick ? t.swapFor : t.pick}
              </Button>
            )}
            <Button variant="text" onClick={() => setLooking(null)}>
              {t.close}
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
            {combatPick === looking.combat ? (
              <Button variant="outlined" onClick={() => unpick(looking.combat)}>
                {t.unpick}
              </Button>
            ) : cantPlay(looking.combat) ? (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                {cantPlay(looking.combat)}
              </Typography>
            ) : (
              <Button size="large" onClick={() => pickCombat(looking.combat)} startIcon={<GameIcon name="confirm" />}>
                {combatPick ? t.swapFor : t.pick}
              </Button>
            )}
            <Button variant="text" onClick={() => setLooking(null)}>
              {t.close}
            </Button>
          </CardDetails>
        )}
      </Box>

      {/* One hand: the command cards sorted by section, then the combat cards, the playable order cards first; picked cards are in the tray */}
      <section className="cards-hands" aria-labelledby="hand-title" ref={handRef}>
        <Typography variant="overline" component="h3" id="hand-title" className="hand-group__title">
          {t.handCount(visibleHand.length, combatHand.length)}
        </Typography>
        <CardHand
          label={t.hand}
          fit
          overlap={0.12}
          cards={[
            ...handCommand.map((card, i) => ({
              key: card.id,
              lifted: lookingAt(card),
              label: i === 0 ? t.commandSlot : undefined,
              node: <CommandCardComponent faction={faction} cardData={card} onClick={tapCommand} />,
            })),
            ...handCombat.map((card, i) => ({
              key: `combat-${card.id}`,
              lifted: lookingAt(card),
              groupStart: i === 0,
              label: i === 0 ? t.combatSlot : undefined,
              className: `hand-card--combat${cantPlay(card) === null ? " hand-card--playable" : ""}`,
              // Any combat card can be looked at; only an order card that can be paid is picked
              node: (
                <CombatCardComponent
                  faction={faction}
                  card={card}
                  disabled={cantPlay(card) !== null}
                  onClick={tapCombat}
                />
              ),
            })),
          ]}
        />
      </section>

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

      {flying && (
        <Flight key={flying.id} from={flying.from} to={flying.to} onDone={() => landedInTray(flying.id)}>
          {flying.node}
        </Flight>
      )}

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
