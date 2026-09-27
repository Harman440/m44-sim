import { ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { CombatCard } from "../game-core/combatCard";
import { COMBAT_PHASE_LABELS } from "../labels";
import GameIcon from "./GameIcon";
import { Faction } from "../types/faction";
import { CombatCardArt } from "./CardArt";

interface CombatCardProps {
  card: CombatCard;
  /** Tapping the card (e.g. to pick it); without it the card is only shown */
  onClick?: (card: CombatCard) => void;
  /** Picked to be played */
  selected?: boolean;
  /** Shown faded: it can't be played now */
  disabled?: boolean;
  /** Buttons under the text */
  children?: ReactNode;
  /** Whose unit tokens the art shows */
  faction?: Faction;
}

/**
 * A combat card: name band with its cost in coins, art showing what it does,
 * when it's played and its text. Order cards are tinted like section cards,
 * battle (reaction) cards like tactic cards.
 */
function CombatCardComponent({ card, onClick, selected = false, disabled = false, children, faction = "Allies" }: CombatCardProps) {
  const face = (
    <>
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 1,
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
            fontSize: "0.95rem",
            lineHeight: 1.15,
            textTransform: "uppercase",
            // Long single words (Reposicionamiento) break instead of running under the coin
            hyphens: "auto",
            overflowWrap: "anywhere",
          }}
        >
          {card.name}
        </Typography>
        {/* The cost as a coin */}
        <Box
          component="span"
          aria-label={`Cuesta ${card.cost} ${card.cost === 1 ? "moneda" : "monedas"}`}
          sx={{
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #f3d98b, #c9a227 60%, #9a7a17)",
            color: "#3b2f0b",
            fontFamily: "var(--m44-font-display)",
            fontSize: "1rem",
            fontWeight: 700,
            boxShadow: "inset 0 0 0 2px #a8871f, 0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {card.cost}
        </Box>
      </Box>
      <Box sx={{ px: 1, pt: 1 }}>
        <CombatCardArt card={card} faction={faction} />
      </Box>
      <Box sx={{ p: 1.25, pt: 1, display: "flex", flexDirection: "column", gap: 0.75, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <GameIcon name={card.phase === "order" ? "battle" : "fire"} size="1.1em" />
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {COMBAT_PHASE_LABELS[card.phase]}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "var(--m44-ink)" }}>
          {card.description}
        </Typography>
        {children && <Box sx={{ mt: "auto", pt: 0.5, display: "flex", flexWrap: "wrap", gap: 1 }}>{children}</Box>}
      </Box>
    </>
  );

  const frame = {
    width: 200,
    minHeight: 230,
    "--card-accent": card.phase === "order" ? "var(--m44-primary)" : "var(--m44-accent)",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    textAlign: "left",
    overflow: "hidden",
    bgcolor: "var(--m44-paper)",
    color: "var(--m44-ink)",
    border: selected ? "3px solid var(--m44-primary)" : "calc(var(--m44-border-width) + 1px) solid var(--m44-border)",
    borderRadius: "var(--m44-radius)",
    boxShadow: "var(--m44-shadow)",
    opacity: disabled ? 0.55 : 1,
  } as const;

  if (onClick) {
    return (
      <ButtonBase
        onClick={() => onClick(card)}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`${card.name}, ${card.cost} ${card.cost === 1 ? "moneda" : "monedas"}`}
        sx={{ ...frame, "&:focus-visible": { outline: "3px solid var(--m44-primary)", outlineOffset: 3 } }}
      >
        {face}
      </ButtonBase>
    );
  }
  return (
    <Box component="article" sx={frame} data-testid="combat-card">
      {face}
    </Box>
  );
}

export default CombatCardComponent;
