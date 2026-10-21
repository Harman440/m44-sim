import { ButtonBase, Typography } from "@mui/material";
import { defineMessages, useMessages } from "../../../i18n/useI18n";
import "./HandAwayBar.css";

const TEXT = defineMessages({
  es: {
    hide: "Guardar las cartas y ver el mapa",
    show: "Volver a las cartas",
  },
  en: {
    hide: "Put the cards away and see the map",
    show: "Back to the cards",
  },
});

interface HandAwayBarProps {
  /** The cards are put away and the map shows large */
  away: boolean;
  onToggle: () => void;
}

/**
 * Pass and play: a wide, short, see-through bar at the bottom of the screen
 * that slides the cards away so the map shows large, and brings them back
 */
function HandAwayBar({ away, onToggle }: HandAwayBarProps) {
  const t = useMessages(TEXT);
  return (
    <ButtonBase className="hand-away-bar" onClick={onToggle} aria-pressed={away} data-testid="hand-away-bar">
      <span className={`hand-away-bar__chevron${away ? " hand-away-bar__chevron--up" : ""}`} aria-hidden />
      <Typography component="span" variant="button">
        {away ? t.show : t.hide}
      </Typography>
    </ButtonBase>
  );
}

export default HandAwayBar;
