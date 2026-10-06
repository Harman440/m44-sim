import { Box, ButtonBase, Typography } from "@mui/material";
import { CombatCard } from "../game-core/combatCard";
import { COMBAT_PHASE_LABELS, DECK_REASON_LABELS } from "../labels";
import GameIcon, { DECK_REASON_ICONS } from "./GameIcon";
import { Faction } from "../types/faction";
import { CombatCardArt } from "./CardArt";
import "./CommandCard.css";

interface CombatCardProps {
  card: CombatCard;
  /** Tapping the card (e.g. to pick it); without it the card is only shown */
  onClick?: (card: CombatCard) => void;
  /** Picked to be played */
  selected?: boolean;
  /** Shown faded: it can't be played now (it can still be tapped to look at it) */
  disabled?: boolean;
  /** Whose unit tokens the art shows */
  faction?: Faction;
}

/**
 * A combat card: name band with its cost in coins, art showing what it does,
 * and when it's played. Order cards are tinted like section cards, battle
 * (reaction) cards like tactic cards. Its text is in its details
 * (CardDetails), shown when it is tapped.
 */
function CombatCardComponent({ card, onClick, selected = false, disabled = false, faction = "Allies" }: CombatCardProps) {
  const reasonIcon = card.reason && DECK_REASON_ICONS[card.reason];
  const face = (
    <>
      <Box
        sx={{
          flex: "none",
          px: "0.7em",
          py: "0.45em",
          display: "flex",
          alignItems: "center",
          gap: "0.5em",
          bgcolor: "var(--m44-ink)",
          color: "var(--m44-paper)",
          borderBottom: "3px solid var(--card-accent)",
        }}
      >
        <Typography
          component="h3"
          lang="es"
          sx={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--m44-font-display)",
            fontSize: "0.9em",
            lineHeight: 1.15,
            textTransform: "uppercase",
            // Long single words (Reposicionamiento) break instead of running under the coin
            hyphens: "auto",
            overflowWrap: "anywhere",
          }}
        >
          {card.name}
        </Typography>
        {/* The cost on a supply crate */}
        <Box
          component="span"
          aria-label={`Cuesta ${card.cost} ${card.cost === 1 ? "suministro" : "suministros"}`}
          sx={{
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            width: "1.8em",
            height: "1.8em",
            borderRadius: "0.15em",
            // Planks, with a darker frame round them
            background:
              "repeating-linear-gradient(0deg, #b98a4e 0 0.36em, #a2743c 0.36em 0.4em), #b98a4e",
            color: "#fff6e0",
            textShadow: "0 1px 1px rgba(0,0,0,0.6)",
            fontFamily: "var(--m44-font-display)",
            fontSize: "1em",
            fontWeight: 700,
            boxShadow: "inset 0 0 0 0.14em #6b4521, 0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {card.cost}
        </Box>
      </Box>
      <Box className="game-card__art" sx={{ position: "relative" }}>
        <CombatCardArt card={card} faction={faction} />
        {card.reason && reasonIcon && (
          // Why the deck has it (offensive, defensive, the side's tanks…), as on its group in the deck
          <Box
            component="span"
            role="img"
            aria-label={DECK_REASON_LABELS[card.reason]}
            data-reason={card.reason}
            sx={{
              position: "absolute",
              top: "0.25em",
              left: "0.25em",
              display: "grid",
              placeItems: "center",
              width: "2em",
              height: "2em",
              borderRadius: "50%",
              bgcolor: "var(--m44-ink)",
              color: "var(--m44-paper)",
              border: "0.12em solid var(--card-accent)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}
          >
            <GameIcon name={reasonIcon} size="1.3em" />
          </Box>
        )}
      </Box>
      <Box
        sx={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4em",
          py: "0.35em",
          bgcolor: "var(--card-accent)",
          color: "var(--m44-paper)",
        }}
      >
        <GameIcon name={card.phase === "order" ? "battle" : "fire"} size="1em" />
        <Typography
          component="span"
          sx={{ fontSize: "0.68em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {COMBAT_PHASE_LABELS[card.phase]}
        </Typography>
      </Box>
    </>
  );

  // The face is laid out at 180px and scaled (.game-card in CommandCard.css); its look is set here
  const faceStyle = {
    "--card-accent": card.phase === "order" ? "var(--m44-primary)" : "var(--m44-accent)",
    textAlign: "left",
    fontFamily: "var(--m44-font-body)",
    ...(selected && { border: "3px solid var(--m44-primary)" }),
  } as const;
  const faceBox = (
    <Box component="span" className="game-card__face" sx={faceStyle}>
      {face}
    </Box>
  );
  const rootStyle = { display: "block", opacity: disabled ? 0.55 : 1 } as const;

  if (onClick) {
    return (
      <ButtonBase
        // Faded but still tappable, to look at a card that can't be played now
        onClick={() => onClick(card)}
        aria-pressed={selected}
        aria-label={`${card.name}, ${card.cost} ${card.cost === 1 ? "suministro" : "suministros"}`}
        className="game-card combat-card"
        sx={{ ...rootStyle, "&:focus-visible": { outline: "3px solid var(--m44-primary)", outlineOffset: 3 } }}
      >
        {faceBox}
      </ButtonBase>
    );
  }
  return (
    <Box component="article" className="game-card combat-card" sx={rootStyle} data-testid="combat-card">
      {faceBox}
    </Box>
  );
}

export default CombatCardComponent;
