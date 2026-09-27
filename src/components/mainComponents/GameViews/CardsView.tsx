import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import CommandCard, { SECTIONS, Section } from "../../../game-core/commandCard";
import { SECTION_LABELS } from "../../../labels";
import { motion } from "motion/react";
import CommandCardComponent from "../../CommandCardComponent";
import { useSound } from "../../../sound";
import "./CardsView.css";

// Must be at least the 0.5s slideDown animation in CardsView.css
export const DEAL_ANIMATION_MS = 600;
export const DEAL_GAP_MS = 150;

interface CardsViewProps {
  handCards: readonly CommandCard[];
  choiceCards: readonly CommandCard[];
  drawPileCount: number;
  discardPileCount: number;
  dealtCardIds: ReadonlySet<string>;
  onCardDealt: (card: CommandCard) => void;
  /** Returns false when the deck doesn't have 2 cards */
  onDrawChoice: () => boolean;
  onChooseCard: (card: CommandCard) => void;
  /** Play the card; `section` for a card whose section the player picks */
  onCardClick: (card: CommandCard, section?: Section) => void;
  /** The card orders units in a section the player picks when playing it */
  needsSection?: (card: CommandCard) => boolean;
  /** Show the "Coge 2 Cartas" debug button (a stand-in for the planned special cards) */
  showDrawChoice?: boolean;
}

function CardsView({
  handCards,
  choiceCards,
  drawPileCount,
  discardPileCount,
  dealtCardIds,
  onCardDealt,
  onDrawChoice,
  onChooseCard,
  onCardClick,
  needsSection = () => false,
  showDrawChoice = import.meta.env.DEV,
}: CardsViewProps) {
  /** A card waiting for its section to be picked */
  const [choosingSection, setChoosingSection] = useState<CommandCard | null>(null);
  const [message, setMessage] = useState('Selecciona una carta para jugarla');
  const [animatingCard, setAnimatingCard] = useState<CommandCard | null>(null);
  const play = useSound();

  const visibleHand = handCards.filter((card) => dealtCardIds.has(card.id));
  const nextCardToDeal = handCards.find((card) => !dealtCardIds.has(card.id));
  const isChoosing = choiceCards.length > 0;

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

  const drawChoice = () => {
    setMessage(
      onDrawChoice()
        ? 'Elige una carta para añadirla a tu mano'
        : 'No hay suficientes cartas en el mazo!'
    );
  };

  const chooseCard = (card: CommandCard) => {
    onChooseCard(card); // the card is then dealt into the hand by the effect above
    setMessage('Carta elegida, selecciona una carta para jugarla');
  };

  const playCard = (card: CommandCard) => {
    if (isChoosing) {
      setMessage('Primero elige una de las dos cartas');
      return;
    }
    if (needsSection(card)) {
      setChoosingSection(card);
      return;
    }
    onCardClick(card);
  };

  const playInSection = (section: Section) => {
    if (!choosingSection) return;
    onCardClick(choosingSection, section);
    setChoosingSection(null);
  };

  return (
    <div className="cards-view">
      {/* Header */}
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
          {message}
        </Typography>
      </Box>

      {/* Choice Cards Area */}
      {isChoosing && (
        <div className="choice-area">
          <Typography variant="h6" sx={{ textAlign: "center", mb: 2 }}>
            Elige una carta:
          </Typography>
          <div className="choice-cards">
            {choiceCards.map((card) => (
              <div key={card.id} className="choice-card">
                <CommandCardComponent cardData={card} onClick={chooseCard} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Area - Deck and Discard */}
      <div className="top-area">
        <Stack sx={{ alignItems: "center" }}>
          <Typography sx={{ mb: 1 }}>
            Cartas ({drawPileCount})
          </Typography>
          <div className="deck-pile">
            <div className="deck-back">M'44</div>
          </div>
          {showDrawChoice && (
            <Button onClick={drawChoice} disabled={isChoosing} sx={{ mt: 2 }}>
              Coge 2 Cartas
            </Button>
          )}
        </Stack>

        <Stack sx={{ alignItems: "center" }}>
          <Typography sx={{ mb: 1 }}>
            Descarte ({discardPileCount})
          </Typography>
          <div className="discard-pile">
            {discardPileCount > 0 && (
              <div className="deck-back">M'44</div>
            )}
          </div>
        </Stack>
      </div>

      {/* Hand */}
      <div className="cards-grid">
        <div className="grid">
          {visibleHand.map((card) => (
            <CommandCardComponent key={card.id} cardData={card} onClick={playCard} />
          ))}
        </div>
      </div>

      <Dialog open={choosingSection !== null} onClose={() => setChoosingSection(null)}>
        <DialogTitle>{choosingSection?.name}: ¿en qué sección?</DialogTitle>
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
          <CommandCardComponent cardData={animatingCard} onClick={() => {}} />
        </motion.div>
      )}
    </div>
  );
}

export default CardsView;
