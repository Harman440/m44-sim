import { useEffect, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import CommandCard from "../../../game-core/commandCard";
import CommandCardComponent from "../../CommandCardComponent";
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
  onCardClick: (card: CommandCard) => void;
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
}: CardsViewProps) {
  const [message, setMessage] = useState('Selecciona una carta para jugarla');
  const [animatingCard, setAnimatingCard] = useState<CommandCard | null>(null);

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
    onCardClick(card);
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
          borderBottom: "2px solid rgba(148, 163, 184, 0.1)",
        }}
      >
        <Typography variant="h4" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
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
            <div className="deck-back">?</div>
          </div>
          <Button onClick={drawChoice} disabled={isChoosing} sx={{ mt: 2 }}>
            Coge 2 Cartas
          </Button>
        </Stack>

        <Stack sx={{ alignItems: "center" }}>
          <Typography sx={{ mb: 1 }}>
            Descarte ({discardPileCount})
          </Typography>
          <div className="discard-pile">
            {discardPileCount > 0 && (
              <div className="deck-back">?</div>
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

      {/* Animating Card Overlay */}
      {animatingCard && (
        <div className="animating-card deck" data-testid="animating-card">
          <CommandCardComponent cardData={animatingCard} onClick={() => {}} />
        </div>
      )}
    </div>
  );
}

export default CardsView;
