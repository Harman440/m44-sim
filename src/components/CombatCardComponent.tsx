import { ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { CombatCard } from "../game-core/combatCard";
import { COMBAT_PHASE_LABELS } from "../labels";
import GameIcon from "./GameIcon";

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
}

/** A combat card: name band, cost in coins, when it's played and its text */
function CombatCardComponent({ card, onClick, selected = false, disabled = false, children }: CombatCardProps) {
  const face = (
    <>
      <Box sx={{ px: 1.25, py: 0.75, bgcolor: "var(--m44-ink)", color: "var(--m44-paper)" }}>
        <Typography
          component="h3"
          sx={{ fontFamily: "var(--m44-font-display)", fontSize: "0.95rem", lineHeight: 1.15, textTransform: "uppercase" }}
        >
          {card.name}
        </Typography>
      </Box>
      <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 0.75, flex: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ border: "1px solid var(--m44-border)", borderRadius: "var(--m44-radius)", px: 0.75 }}
          >
            {COMBAT_PHASE_LABELS[card.phase]}
          </Typography>
          <Typography
            sx={{ display: "flex", alignItems: "center", gap: 0.5, fontWeight: 700 }}
            aria-label={`Cuesta ${card.cost} ${card.cost === 1 ? "moneda" : "monedas"}`}
          >
            <GameIcon name="coins" /> {card.cost}
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
    minHeight: 180,
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
