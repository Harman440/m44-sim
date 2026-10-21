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
    commandZone: "Zona de Mando",
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
    commandZone: "Command Zone",
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
  drawPileCount: number;
  discardPileCount: number;
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
  /** Pass and play: a small map of the armies, in the top bar */
  mapPreview?: ReactNode;
  /** Pass and play: the map shown large in place of the table and the hand when the cards are put away */
  largeMap?: ReactNode;
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
  mapPreview,
  largeMap,
}: CardsViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const lang = useLang();
  /** The command card picked to play; it leaves the hand for the tray */
  const [commandPick, setCommandPick] = useState<CommandCard | null>(null);
  /** The combat cards picked to play with it, in the order picked (two at most) */
  const [combatPicks, setCombatPicks] = useState<readonly CombatCard[]>([]);
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
  /** Pass and play: the cards are put away and the map shows large (the picks stay) */
  const [handAway, setHandAway] = useState(false);
  /** The hand slides back in only after it was put away, not when the view opens */
  const [handMoved, setHandMoved] = useState(false);
  const toggleHand = () => {
    setLooking(null);
    setHandMoved(true);
    setHandAway((away) => !away);
  };
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
    if (card === commandPick) setCommandPick(null);
    setCombatPicks((picks) => picks.filter((picked) => picked !== card));
    if (lookingAt(card)) setLooking(null);
  };

  /** A combat card picked can't be played with the command card (Tactician needs a one-section card) */
  const misfit = (commandPick && combatPicks.find((combat) => !combatCardFits(commandPick, combat))) ?? null;

  /**
   * Plays the cards: the cards in the tray fly to the middle of the table in
   * 3D, then the turn goes on. Straight away without WebGL or with reduced motion.
   */
  const commit = (card: CommandCard, section?: Section) => {
    const combatCards = combatPicks;
    const go = () => onCardClick(card, section, combatCards);
    const table = tableRef.current;
    const command = trayRef.current?.querySelector<HTMLElement>(".cards-tray__card--command .game-card");
    if (!table || !command || !canPlayIn3D()) {
      go();
      return;
    }
    const combat = [...(trayRef.current?.querySelectorAll<HTMLElement>(".cards-tray__card--combat-any .game-card") ?? [])];
    const box = table.getBoundingClientRect();
    played.current = false;
    setLooking(null);
    setPlaying({
      cards: [{ element: command }, ...combat.map((element) => ({ element }))],
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

        {mapPreview && !handAway && <div className="cards-top__map">{mapPreview}</div>}

        {/* Deck and discard */}
        <CardPiles drawPileCount={drawPileCount} discardPileCount={discardPileCount} />
      </div>

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
          {/* The table: the tray with the cards picked to play, and beside it the card looked at */}
          <Box className="cards-table" ref={tableRef}>
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
                          initial={{ y: 24, opacity: 0, scale: 1.2 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          style={{ visibility: flying?.id === `combat-${picked.id}` ? "hidden" : undefined }}
                        >
                          <CombatCardComponent faction={faction} card={picked} onClick={(c) => look({ combat: c })} />
                        </motion.div>
                      )}
                    </div>
                  );
                })}
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
