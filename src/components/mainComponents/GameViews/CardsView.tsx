import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import CommandCard, { SECTIONS, Section } from "../../../game-core/commandCard";
import { SECTION_LABELS } from "../../../labels";
import { motion } from "motion/react";
import CommandCardComponent from "../../CommandCardComponent";
import CombatCardComponent from "../../CombatCardComponent";
import { CombatCard } from "../../../game-core/combatCard";
import { useSound } from "../../../sound";
import "./CardsView.css";

// Must be at least the 0.5s slideDown animation in CardsView.css
export const DEAL_ANIMATION_MS = 600;
export const DEAL_GAP_MS = 150;

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
  /** The order combat card to play with the command card */
  const [combatPick, setCombatPick] = useState<CombatCard | null>(null);
  /** A card waiting for its section to be picked */
  const [choosingSection, setChoosingSection] = useState<CommandCard | null>(null);
  /** A card the order combat card can't be played with: asks whether to play it alone */
  const [misfit, setMisfit] = useState<CommandCard | null>(null);
  const [animatingCard, setAnimatingCard] = useState<CommandCard | null>(null);
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

  const playCard = (card: CommandCard) => {
    if (combatPick && !combatCardFits(card, combatPick)) {
      setMisfit(card);
      return;
    }
    if (needsSection(card, combatPick ?? undefined)) {
      setChoosingSection(card);
      return;
    }
    onCardClick(card, undefined, combatPick ?? undefined);
  };

  /** Play the card without the combat card, which stays in the hand unpaid */
  const playAlone = () => {
    if (!misfit) return;
    const card = misfit;
    setMisfit(null);
    setCombatPick(null);
    if (needsSection(card)) setChoosingSection(card);
    else onCardClick(card);
  };

  const playInSection = (section: Section) => {
    if (!choosingSection) return;
    onCardClick(choosingSection, section, combatPick ?? undefined);
    setChoosingSection(null);
  };

  return (
    <div className="cards-view">
      <div className="cards-top">
        <Box
          className="cards-header"
          sx={{
            textAlign: "center",
            pb: 2.5,
            mb: 3,
            borderBottom: "3px double",
            borderColor: "divider",
          }}
        >
          <Typography variant="h4" component="h3" sx={{ mb: 1 }}>
            Zona de Mando
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Selecciona una carta para jugarla
          </Typography>
        </Box>

        {/* Deck and discard */}
        <div className="top-area">
          <Stack className="pile" sx={{ alignItems: "center" }}>
            <Typography className="pile__label">Cartas ({drawPileCount})</Typography>
            <div className="deck-pile">
              <div className="deck-back">M'44</div>
            </div>
          </Stack>

          <Stack className="pile" sx={{ alignItems: "center" }}>
            <Typography className="pile__label">Descarte ({discardPileCount})</Typography>
            <div className="discard-pile">{discardPileCount > 0 && <div className="deck-back">M'44</div>}</div>
          </Stack>
        </div>
      </div>

      <div className="cards-body">
        {/* Hand */}
        <div className="cards-grid">
          <div className="grid">
            {visibleHand.map((card) => (
              <CommandCardComponent key={card.id} faction={faction} cardData={card} onClick={playCard} />
            ))}
          </div>
        </div>

        {/* Combat cards: an order card can be played with the command card */}
        <Box
          component="section"
          className="cards-combat"
          sx={{ mt: 3, pt: 2, borderTop: "3px double", borderColor: "divider" }}
          aria-labelledby="combat-hand-title"
        >
          <Typography variant="h6" component="h3" id="combat-hand-title">
            Cartas de combate ({combatHand.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {!canPlayCombatCards
              ? "En el turno extra no se juegan cartas de combate."
              : combatPick
                ? `Jugarás ${combatPick.name} (${combatPick.cost} ${combatPick.cost === 1 ? "moneda" : "monedas"}) con la carta de mando que elijas. Ponla boca abajo en la mesa.`
                : "Para jugar una carta de órdenes este turno, tócala antes de elegir la carta de mando. Las de batalla se juegan en la batalla."}
          </Typography>
          {combatHand.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tienes cartas de combate.
            </Typography>
          ) : (
            <Box className="cards-combat__list" sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {combatHand.map((card) => {
                const playable = canPlayCombatCards && card.phase === "order" && card.cost <= coins;
                return playable ? (
                  <CombatCardComponent
                    key={card.id}
                    faction={faction}
                    card={card}
                    selected={combatPick === card}
                    onClick={(c) => setCombatPick((picked) => (picked === c ? null : c))}
                  />
                ) : (
                  <CombatCardComponent key={card.id} faction={faction} card={card} disabled={card.phase === "order"} />
                );
              })}
            </Box>
          )}
        </Box>
      </div>

      <Dialog open={choosingSection !== null} onClose={() => setChoosingSection(null)}>
        <DialogTitle>
          {combatPick?.effect?.kind === "changeSection" && !choosingSection?.choosesSection
            ? `${combatPick.name}: ¿a qué sección cambias ${choosingSection?.name}?`
            : `${choosingSection?.name}: ¿en qué sección?`}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", pt: 1 }}>
            {SECTIONS.map((section) => (
              <Button key={section} size="large" onClick={() => playInSection(section)} sx={{ flex: "1 1 120px" }}>
                {SECTION_LABELS[section]}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setChoosingSection(null)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={misfit !== null} onClose={() => setMisfit(null)}>
        <DialogTitle>
          {combatPick?.name} no sirve con {misfit?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {combatPick?.effect?.kind === "changeSection"
              ? `${combatPick.name} solo cambia la sección de una carta que da órdenes en una sola sección. `
              : ""}
            Si juegas {misfit?.name} sola, {combatPick?.name} se queda en la mano y no se paga.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setMisfit(null)}>
            Cancelar
          </Button>
          <Button onClick={playAlone}>Jugar sin {combatPick?.name}</Button>
        </DialogActions>
      </Dialog>

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
