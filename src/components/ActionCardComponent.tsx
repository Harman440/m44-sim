import { Box, ButtonBase, Typography } from "@mui/material";
import type { ActionCard } from "../game-core/actionCard";
import { defineMessages, useLang, useMessages, useTr } from "../i18n/useI18n";
import { PAINTINGS } from "./CardArt";
import { longestWord } from "./CommandCardComponent";
import { cardScaleRef } from "./cardScale";
import generalsArt from "../assets/cards/british-generals.webp";
import "./CommandCard.css";
import "./CardArt.css";

/** A name longer than this, or with a word longer than LONG_WORD, gets a smaller font */
const LONG_NAME = 20;
const LONG_WORD = 11;

const isLongName = (name: string) => name.length > LONG_NAME || longestWord(name) > LONG_WORD;

const TEXT = defineMessages({
  es: {
    costs: (n: number) => `Cuesta ${n} ${n === 1 ? "suministro" : "suministros"}`,
    nameAndCost: (name: string, n: number) => `${name}, ${n} ${n === 1 ? "suministro" : "suministros"}`,
    cooldown: (n: number) => (n === 1 ? "Vuelve en 1 turno" : `Vuelve en ${n} turnos`),
  },
  en: {
    costs: (n: number) => `Costs ${n} ${n === 1 ? "supply" : "supplies"}`,
    nameAndCost: (name: string, n: number) => `${name}, ${n} ${n === 1 ? "supply" : "supplies"}`,
    cooldown: (n: number) => (n === 1 ? "Back in 1 turn" : `Back in ${n} turns`),
  },
});

interface ActionCardProps {
  card: ActionCard;
  /** What it costs this side (the scenario may make it cheaper); the card's own cost when left out */
  cost?: number;
  /** Turns before it can be played again: a badge on the painting while above 0 */
  turnsLeft?: number;
  /** Tapping the card (e.g. to pick it); without it the card is only shown */
  onClick?: (card: ActionCard) => void;
  /** Picked to be played */
  selected?: boolean;
  /** Shown faded: it can't be played now (it can still be tapped to look at it) */
  disabled?: boolean;
}

/**
 * A command card: name band with its cost in supplies over its painting, and, while it waits out
 * its cooldown, the turns left. Its text is in its details (CardDialog), shown when it is tapped.
 */
function ActionCardComponent({ card, cost = card.cost, turnsLeft = 0, onClick, selected = false, disabled = false }: ActionCardProps) {
  const t = useMessages(TEXT);
  const tr = useTr();
  const lang = useLang();
  const name = tr(card.name);
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
          lang={lang}
          sx={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--m44-font-display)",
            fontSize: isLongName(name) ? "0.8em" : "0.9em",
            lineHeight: 1.15,
            textTransform: "uppercase",
            hyphens: "auto",
            overflowWrap: "anywhere",
          }}
        >
          {name}
        </Typography>
        {/* The cost on a supply crate */}
        <Box
          component="span"
          aria-label={t.costs(cost)}
          sx={{
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            width: "1.8em",
            height: "1.8em",
            borderRadius: "0.15em",
            background: "repeating-linear-gradient(0deg, #b98a4e 0 0.36em, #a2743c 0.36em 0.4em), #b98a4e",
            color: "#fff6e0",
            textShadow: "0 1px 1px rgba(0,0,0,0.6)",
            fontFamily: "var(--m44-font-display)",
            fontSize: "1em",
            fontWeight: 700,
            boxShadow: "inset 0 0 0 0.14em #6b4521, 0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {cost}
        </Box>
      </Box>
      <Box className="game-card__art" sx={{ position: "relative" }}>
        <span className="combat-art">
          <span className="combat-art__painting-frame">
            <img className="combat-art__painting" src={PAINTINGS[card.painting] ?? generalsArt} alt="" draggable={false} />
          </span>
        </span>
        {turnsLeft > 0 && (
          <Box
            component="span"
            data-testid="card-cooldown"
            aria-label={t.cooldown(turnsLeft)}
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(0, 0, 0, 0.45)",
              color: "var(--m44-paper)",
              fontFamily: "var(--m44-font-display)",
              fontSize: "2.6em",
              fontWeight: 700,
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}
          >
            {turnsLeft}
          </Box>
        )}
      </Box>
    </>
  );

  // The face is laid out at 180px and scaled (.game-card in CommandCard.css); its look is set here
  const faceBox = (
    <Box
      component="span"
      className="game-card__face"
      sx={{
        "--card-accent": "var(--m44-primary)",
        textAlign: "left",
        fontFamily: "var(--m44-font-body)",
        ...(selected && { border: "3px solid var(--m44-primary)" }),
        ...(disabled && { opacity: 0.55 }),
      }}
    >
      {face}
    </Box>
  );
  const rootStyle = {
    display: "block",
    ...(disabled && { bgcolor: "var(--m44-bg)", borderRadius: "calc(var(--m44-radius) * 1.5 * var(--card-scale))" }),
  } as const;

  if (onClick) {
    return (
      <ButtonBase
        // Faded but still tappable, to look at a card that can't be played now
        onClick={() => onClick(card)}
        aria-pressed={selected}
        aria-label={t.nameAndCost(name, cost)}
        ref={cardScaleRef}
        className="game-card action-card"
        sx={{ ...rootStyle, "&:focus-visible": { outline: "3px solid var(--m44-primary)", outlineOffset: 3 } }}
      >
        {faceBox}
      </ButtonBase>
    );
  }
  return (
    <Box component="article" ref={cardScaleRef} className="game-card action-card" sx={rootStyle} data-testid="action-card">
      {faceBox}
    </Box>
  );
}

export default ActionCardComponent;
