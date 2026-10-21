import { ReactNode, useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import CommandCard, { SECTIONS, Section } from "../../../game-core/commandCard";
import { defineMessages, useLabels, useLang, useMessages, useTr } from "../../../i18n/useI18n";
import { motion } from "motion/react";
import CommandCardComponent from "../../CommandCardComponent";
import CombatCardComponent from "../../CombatCardComponent";
import CardHand from "../../CardHand";
import Flight, { Box as ScreenBox, boxOf } from "../../Flight";
import CardDetails from "../../CardDetails";
import CardFlip from "../../CardFlip";
import { PLAY_FLIGHT, PLAY_LAYOUT_PREFIX } from "../../PlayedCards";
import GameIcon from "../../GameIcon";
import { ruleTags } from "../../CommandCardComponent";
import { CombatCard, templateOf } from "../../../game-core/combatCard";
import { MAX_COMBAT_CARDS_PER_TURN } from "../../../data/combatCards";
import { sortCombatHand, sortCommandHand } from "../../../game-core/handOrder";
import { useSound } from "../../../sound";
import HandAwayBar from "./HandAwayBar";
import "./CardsView.css";

const TEXT = defineMessages({
  es: {
    noCombatInExtraTurn: "En el turno extra no se juegan cartas de combate.",
    shortOfCoins: (cost: string, have: string) => `Te faltan suministros: cuesta ${cost} y tienes ${have}.`,
    twoAlready: (max: number) => `Ya juegas ${max} cartas de combate: quita una para jugar esta.`,
    sameCard: "Ya juegas esta carta: no se juegan dos copias a la vez.",
    pickCommand: "Elige una carta de mando",
    addCombat: (max: number) => `Añade hasta ${max} cartas de combate si quieres, y juega`,
    readyToPlay: "Listo: pulsa Jugar",
    yourPlay: "Tu jugada",
    commandSlot: "Mando",
    combatSlot: "Combate",
    noCommandYet: "Sin elegir",
    noCombatYet: "Opcional",
    noCombatInHand: "No tienes cartas de combate",
    sectionOnPlay: "sección al jugar",
    remove: "Quitar",
    removeCard: (name: string) => `Quitar ${name}`,
    play: "Jugar",
    howToPick: (max: number) =>
      `Elige una carta de mando y, si quieres, hasta ${max} cartas de combate distintas, en el orden que quieras. Todas se juegan ahora, con las órdenes.`,
    tapToSee: "Toca una carta para verla",
    pick: "Elegir",
    swapFor: "Cambiar por esta",
    unpick: "Devolver a la mano",
    close: "Cerrar",
    costs: (coins: string) => `Cuesta ${coins}`,
    hand: "Tu mano",
    handCount: (command: number, combat: number) => `Cartas de mando (${command}) · Cartas de combate (${combat})`,
    combatCount: (combat: number) => `Cartas de combate (${combat})`,
    ordersSlot: "Órdenes",
    changeSectionTitle: (combat: string, command: string) => `${combat}: ¿a qué sección cambias ${command}?`,
    whichSection: (command: string) => `${command}: ¿en qué sección?`,
    cancel: "Cancelar",
    misfit: (combat: string, command: string) => `${combat} no sirve con ${command}: quita una de las dos.`,
    changeSectionOnly: (combat: string) => `${combat} solo cambia la sección de una carta que da órdenes en una sola sección.`,
  },
  en: {
    noCombatInExtraTurn: "No combat cards are played in the extra turn.",
    shortOfCoins: (cost: string, have: string) => `Not enough supplies: it costs ${cost} and you have ${have}.`,
    twoAlready: (max: number) => `You're already playing ${max} combat cards: remove one to play this one.`,
    sameCard: "You're already playing this card: two copies aren't played together.",
    pickCommand: "Pick a command card",
    addCombat: (max: number) => `Add up to ${max} combat cards if you like, and play`,
    readyToPlay: "Ready: tap Play",
    yourPlay: "Your play",
    commandSlot: "Command",
    combatSlot: "Combat",
    noCommandYet: "Not picked",
    noCombatYet: "Optional",
    noCombatInHand: "You have no combat cards",
    sectionOnPlay: "section when played",
    remove: "Remove",
    removeCard: (name: string) => `Remove ${name}`,
    play: "Play",
    howToPick: (max: number) =>
      `Pick a command card and, if you like, up to ${max} different combat cards, in any order. They're all played now, with the orders.`,
    tapToSee: "Tap a card to see it",
    pick: "Pick",
    swapFor: "Swap for this one",
    unpick: "Back to the hand",
    close: "Close",
    costs: (coins: string) => `Costs ${coins}`,
    hand: "Your hand",
    handCount: (command: number, combat: number) => `Command cards (${command}) · Combat cards (${combat})`,
    combatCount: (combat: number) => `Combat cards (${combat})`,
    ordersSlot: "Orders",
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
const TABLE_CARD_WIDTH = "min(160px, (100cqh - 40px) * 5 / 7)";

interface CardsViewProps {
  handCards: readonly CommandCard[];
  dealtCardIds: ReadonlySet<string>;
  onCardDealt: (card: CommandCard) => void;
  /** Play the card; `section` for a card whose section the player picks, `combatCards` to play with it */
  onCardClick: (card: CommandCard, section: Section | undefined, combatCards: readonly CombatCard[]) => void;
  /** The card orders units in a section the player picks when playing it (or Tactician changes it) */
  needsSection?: (card: CommandCard, combatCards: readonly CombatCard[]) => boolean;
  /** The combat card does something with this command card (Tactician needs a one-section card) */
  combatCardFits?: (card: CommandCard, combatCard: CombatCard) => boolean;
  combatHand?: readonly CombatCard[];
  /** Combat cards can be played this turn (not in the attacker's extra turn) */
  canPlayCombatCards?: boolean;
  /** Coins to pay for a combat card */
  coins?: number;
  /** Whose unit tokens the card art shows */
  faction?: Faction;
  /**
   * Pass and play: the map, zoomable, on the left of the table (the tray beside it), and
   * alone in place of the table and the hand when the cards are put away
   */
  largeMap?: ReactNode;
  /**
   * The cards played before "Cambiar carta" brought the player back here: they
   * start in the tray (flying back from the orders screen) and the hand slides up
   */
  initialPicks?: { command: CommandCard; combat: readonly CombatCard[] } | null;
  /**
   * The sections variant: no command cards. This card (the side's only one) is always the one
   * played, said in words rather than shown, and only combat cards are picked
   */
  fixedCommand?: CommandCard | null;
}

function CardsView({
  handCards,
  dealtCardIds,
  onCardDealt,
  onCardClick,
  needsSection = () => false,
  combatCardFits = () => true,
  combatHand = [],
  canPlayCombatCards = false,
  coins = 0,
  faction = "Allies",
  largeMap,
  initialPicks = null,
  fixedCommand = null,
}: CardsViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const lang = useLang();
  /** The command card picked to play; it leaves the hand for the tray */
  const [commandPick, setCommandPick] = useState<CommandCard | null>(() =>
    fixedCommand ?? (initialPicks && handCards.includes(initialPicks.command) ? initialPicks.command : null)
  );
  /** The combat cards picked to play with it, in the order picked (two at most) */
  const [combatPicks, setCombatPicks] = useState<readonly CombatCard[]>(() =>
    initialPicks ? initialPicks.combat.filter((card) => combatHand.includes(card)) : []
  );
  /** Back from the orders: the cards fly back to the tray on their own (layoutId), with no entrance of their own */
  const [returned] = useState(() => new Set<unknown>(initialPicks ? [initialPicks.command, ...initialPicks.combat] : []));
  /** The picked card waiting for its section to be picked */
  const [choosingSection, setChoosingSection] = useState<CommandCard | null>(null);
  const [animatingCard, setAnimatingCard] = useState<CommandCard | null>(null);
  /** The card being looked at on the table, from the hand or the tray */
  const [looking, setLooking] = useState<{ command: CommandCard } | { combat: CombatCard } | null>(null);
  /** Pass and play: the cards are put away and the map shows large (the picks stay) */
  const [handAway, setHandAway] = useState(false);
  /** The hand slides (back) in after it was put away, or back from the orders; not when the view opens */
  const [handMoved, setHandMoved] = useState(initialPicks !== null);
  const toggleHand = () => {
    setLooking(null);
    setHandMoved(true);
    setHandAway((away) => !away);
  };
  /** A card tapped in the hand, flying to its empty slot in the tray */
  const [flying, setFlying] = useState<{ id: string; node: ReactNode; from: ScreenBox; to: ScreenBox } | null>(null);
  const handRef = useRef<HTMLElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  const play = useSound();

  // The sections variant's card isn't dealt nor shown in the hand
  const dealtHand = fixedCommand ? [] : handCards;
  const visibleHand = dealtHand.filter((card) => dealtCardIds.has(card.id));
  const nextCardToDeal = dealtHand.find((card) => !dealtCardIds.has(card.id));
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

  const pickedCost = combatPicks.reduce((sum, card) => sum + card.cost, 0);
  /** Why a combat card can't be added to the ones picked now, or null if it can */
  const cantPlay = (card: CombatCard): string | null => {
    if (!canPlayCombatCards) return t.noCombatInExtraTurn;
    if (combatPicks.length >= MAX_COMBAT_CARDS_PER_TURN) return t.twoAlready(MAX_COMBAT_CARDS_PER_TURN);
    if (combatPicks.some((picked) => templateOf(picked) === templateOf(card))) return t.sameCard;
    const left = coins - pickedCost;
    if (card.cost > left) return t.shortOfCoins(labels.coins(card.cost), labels.coins(left));
    return null;
  };
  const handCombat = sortCombatHand(
    combatHand.filter((card) => !combatPicks.includes(card)),
    (card) => cantPlay(card) === null
  );

  /** A card picked straight from the hand flies from its place there to its slot in the tray */
  const flyToTray = (handKey: string, slot: string, node: ReactNode) => {
    const from = boxOf(handRef.current?.querySelector(`[data-card-key="${handKey}"] .game-card`));
    const to = boxOf(trayRef.current?.querySelector(`.cards-tray__card--${slot}`));
    if (from && to) setFlying({ id: handKey, node, from, to });
  };

  /**
   * Picking a card puts it in the tray (in place of the one there), where its
   * text shows, so the table clears: the card isn't shown twice
   */
  const pickCommand = (card: CommandCard, fromHand = false) => {
    if (fromHand) flyToTray(card.id, "command", <CommandCardComponent faction={faction} cardData={card} />);
    setCommandPick(card);
    setLooking(null);
    play("cardDeal");
  };
  const pickCombat = (card: CombatCard, fromHand = false) => {
    const slot = combatPicks.length === 0 ? "combat" : "combat-2";
    if (fromHand) flyToTray(`combat-${card.id}`, slot, <CombatCardComponent faction={faction} card={card} />);
    setCombatPicks((picks) => [...picks, card]);
    setLooking(null);
    play("cardDeal");
  };

  /**
   * Tapping a card in the hand puts it straight in its slot when that is
   * empty (a combat card only if it can be played now); otherwise it goes on
   * the table to be looked at, and swapped from there
   */
  const tapCommand = (card: CommandCard) => (commandPick ? look({ command: card }) : pickCommand(card, true));
  const tapCombat = (card: CombatCard) => (cantPlay(card) === null ? pickCombat(card, true) : look({ combat: card }));
  const landedInTray = (id: string) => setFlying((current) => (current?.id === id ? null : current));
  const unpick = (card: CommandCard | CombatCard) => {
    if (card === commandPick && !fixedCommand) setCommandPick(null);
    setCombatPicks((picks) => picks.filter((picked) => picked !== card));
    if (lookingAt(card)) setLooking(null);
  };

  /** A combat card picked can't be played with the command card (Tactician needs a one-section card) */
  const misfit = (commandPick && combatPicks.find((combat) => !combatCardFits(commandPick, combat))) ?? null;

  /** Plays the cards: the turn goes on to the orders, where the cards in the tray fly to (their layoutId) */
  const commit = (card: CommandCard, section?: Section) => {
    setLooking(null);
    onCardClick(card, section, combatPicks);
  };

  const playPicked = () => {
    if (!commandPick || misfit) return;
    if (needsSection(commandPick, combatPicks)) {
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

  const canAddCombat = canPlayCombatCards && handCombat.some((card) => cantPlay(card) === null);
  const prompt = !commandPick ? t.pickCommand : misfit ? null : canAddCombat ? t.addCombat(MAX_COMBAT_CARDS_PER_TURN) : t.readyToPlay;
  const tactician = combatPicks.find((card) => card.effect?.kind === "changeSection");

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
          {/* The table: pass and play's map on the left; the tray with the cards picked to play, and the card looked at */}
          <Box className={`cards-table${largeMap ? " cards-table--with-map" : ""}`}>
            {largeMap && <div className="cards-table__map">{largeMap}</div>}
            <div className="cards-table__side">
              {/* The tray: the cards picked to play, stacked, each with its line and its text */}
              <section className="cards-tray" ref={trayRef} aria-label={t.yourPlay}>
                <div className="cards-tray__stack">
                  {[0, 1].map((i) => {
                    const picked = combatPicks[i];
                    // The second slot shows only once the first is taken
                    if (i === 1 && !combatPicks[0]) return null;
                    return (
                      <div
                        key={i}
                        className={`cards-tray__card cards-tray__card--combat-any cards-tray__card--${i === 0 ? "combat" : "combat-2"}${picked ? "" : " cards-tray__card--empty"}`}
                      >
                        {picked && (
                          <motion.div
                            key={picked.id}
                            layoutId={`${PLAY_LAYOUT_PREFIX}combat-${picked.id}`}
                            initial={returned.has(picked) ? false : { y: 24, opacity: 0, scale: 1.2 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ layout: PLAY_FLIGHT }}
                            style={{ visibility: flying?.id === `combat-${picked.id}` ? "hidden" : undefined }}
                          >
                            <CombatCardComponent faction={faction} card={picked} onClick={(c) => look({ combat: c })} />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                  {!fixedCommand && (
                    <div className={`cards-tray__card cards-tray__card--command${commandPick ? "" : " cards-tray__card--empty"}`}>
                      {commandPick && (
                        <motion.div
                          key={commandPick.id}
                          layoutId={`${PLAY_LAYOUT_PREFIX}${commandPick.id}`}
                          initial={returned.has(commandPick) ? false : { y: 24, opacity: 0, scale: 1.2 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          transition={{ layout: PLAY_FLIGHT }}
                          style={{ visibility: flying?.id === commandPick.id ? "hidden" : undefined }}
                        >
                          <CommandCardComponent faction={faction} cardData={commandPick} onClick={(c) => look({ command: c })} />
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                <Stack className="cards-tray__lines">
                  {prompt && (
                    <Typography variant="body2" color={commandPick ? "primary" : "text.secondary"} className="cards-tray__prompt">
                      {prompt}
                    </Typography>
                  )}
                  <div className="cards-tray__line">
                    <Typography variant="overline" className="cards-tray__slot">
                      {fixedCommand ? t.ordersSlot : t.commandSlot}
                    </Typography>
                    <div className="cards-tray__name">
                      <Typography sx={{ fontWeight: 600 }} color={commandPick ? "text.primary" : "text.secondary"}>
                        {commandPick ? tr(commandPick.name) : t.noCommandYet}
                        {commandPick?.choosesSection && (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {` · ${t.sectionOnPlay}`}
                          </Typography>
                        )}
                      </Typography>
                      {commandPick && (
                        <Typography variant="body2" color="text.secondary">
                          {tr(commandPick.description)}
                        </Typography>
                      )}
                    </div>
                    {commandPick && !fixedCommand && (
                      <Button variant="text" size="small" aria-label={t.removeCard(tr(commandPick.name))} onClick={() => unpick(commandPick)}>
                        {t.remove}
                      </Button>
                    )}
                  </div>
                  <div className="cards-tray__line">
                    <Typography variant="overline" className="cards-tray__slot">
                      {t.combatSlot}
                    </Typography>
                    {combatPicks.length === 0 ? (
                      <Typography className="cards-tray__name" color="text.secondary">
                        {!canPlayCombatCards ? t.noCombatInExtraTurn : combatHand.length === 0 ? t.noCombatInHand : t.noCombatYet}
                      </Typography>
                    ) : (
                      <Stack className="cards-tray__name">
                        {combatPicks.map((picked) => (
                          <Stack key={picked.id} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 600 }}>
                                {tr(picked.name)}
                                <Typography component="span" variant="body2" color="text.secondary">
                                  {` · ${labels.coins(picked.cost)}`}
                                </Typography>
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {tr(picked.description)}
                              </Typography>
                            </Box>
                            <Button variant="text" size="small" aria-label={t.removeCard(tr(picked.name))} onClick={() => unpick(picked)}>
                              {t.remove}
                            </Button>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </div>
                  {!commandPick && combatPicks.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {canPlayCombatCards ? t.howToPick(MAX_COMBAT_CARDS_PER_TURN) : t.tapToSee}
                    </Typography>
                  )}
                  {misfit && commandPick && (
                    <Typography variant="body2" color="error" role="alert">
                      {misfit.effect?.kind === "changeSection" ? `${t.changeSectionOnly(tr(misfit.name))} ` : ""}
                      {t.misfit(tr(misfit.name), tr(commandPick.name))}
                    </Typography>
                  )}
                </Stack>

                <Button size="large" className="cards-tray__play" disabled={!commandPick || !!misfit} onClick={playPicked} startIcon={<GameIcon name="cards" />}>
                  {t.play}
                </Button>
              </section>

              {/* Picking a card from here puts it in the tray, and the table clears */}
              {looking !== null && (
                <div className="cards-table__look">
                  {"command" in looking ? (
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
                      tags={[t.costs(labels.coins(looking.combat.cost))]}
                      text={tr(looking.combat.description)}
                    >
                      {combatPicks.includes(looking.combat) ? (
                        <Button variant="outlined" onClick={() => unpick(looking.combat)}>
                          {t.unpick}
                        </Button>
                      ) : cantPlay(looking.combat) ? (
                        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                          {cantPlay(looking.combat)}
                        </Typography>
                      ) : (
                        <Button size="large" onClick={() => pickCombat(looking.combat)} startIcon={<GameIcon name="confirm" />}>
                          {t.pick}
                        </Button>
                      )}
                      <Button variant="text" onClick={() => setLooking(null)}>
                        {t.close}
                      </Button>
                    </CardDetails>
                  )}
                </div>
              )}
            </div>
          </Box>

          {/* One hand: the command cards sorted by section, then the combat cards, the playable order cards first; picked cards are in the tray */}
          <motion.section
            className="cards-hands"
            aria-labelledby="hand-title"
            ref={handRef}
            initial={handMoved ? { y: 120, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <Typography variant="overline" component="h3" id="hand-title" className="hand-group__title">
              {fixedCommand ? t.combatCount(combatHand.length) : t.handCount(visibleHand.length, combatHand.length)}
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
                  // Any combat card can be looked at; only one that can be added and paid for is picked
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
          </motion.section>
        </>
      )}

      {largeMap && <HandAwayBar away={handAway} onToggle={toggleHand} />}

      <Dialog open={choosingSection !== null} onClose={() => setChoosingSection(null)}>
        <DialogTitle>
          {tactician && !choosingSection?.choosesSection
            ? t.changeSectionTitle(tr(tactician.name), choosingSection ? tr(choosingSection.name) : "")
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
