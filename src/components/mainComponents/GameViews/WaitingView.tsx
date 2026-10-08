import { Button, Paper, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import FactionInsignia from "../../FactionInsignia";
import GameIcon from "../../GameIcon";
import { defineMessages, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    axisFirst: "El Eje ataca primero",
    alliesFirst: "Los Aliados atacan primero",
    extraTurn: "El bando atacante juega un turno extra al empezar: elige carta, mueve y dispara sin que puedas responder.",
    wait: "Espera a que termine su turno en la mesa. Tú empiezas en el turno 2.",
    start: "Empezar turno 2",
  },
  en: {
    axisFirst: "The Axis attacks first",
    alliesFirst: "The Allies attack first",
    extraTurn: "The attacking side plays an extra turn at the start: it picks a card, moves and fires before you can respond.",
    wait: "Wait for it to finish its turn at the table. You start on turn 2.",
    start: "Start turn 2",
  },
});

interface WaitingViewProps {
  /** The side playing the extra first turn */
  attacker: Faction;
  onStart: () => void;
}

/** The defender's screen during the attacker's extra first turn */
function WaitingView({ attacker, onStart }: WaitingViewProps) {
  const t = useMessages(TEXT);
  return (
    <Paper
      variant="outlined"
      sx={{
        maxWidth: 640,
        mx: "auto",
        mt: 4,
        p: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 2,
      }}
    >
      <FactionInsignia faction={attacker} size={72} decorative />
      <Typography variant="h4" component="h2">
        {attacker === "Axis" ? t.axisFirst : t.alliesFirst}
      </Typography>
      <Typography variant="body1">
        {t.extraTurn}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {t.wait}
      </Typography>
      <Button size="large" onClick={onStart} startIcon={<GameIcon name="battle" />} sx={{ minWidth: 240 }}>
        {t.start}
      </Button>
    </Paper>
  );
}

export default WaitingView;
