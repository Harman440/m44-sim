import { Button, Paper, Typography } from "@mui/material";
import { Faction } from "../../../types/faction";
import FactionInsignia from "../../FactionInsignia";
import GameIcon from "../../GameIcon";

interface WaitingViewProps {
  /** The side playing the extra first turn */
  attacker: Faction;
  onStart: () => void;
}

/** The defender's screen during the attacker's extra first turn */
function WaitingView({ attacker, onStart }: WaitingViewProps) {
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
        {attacker === "Axis" ? "El Eje ataca primero" : "Los Aliados atacan primero"}
      </Typography>
      <Typography variant="body1">
        El bando atacante juega un turno extra al empezar: elige carta, mueve y dispara sin que puedas
        responder.
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Espera a que termine su turno en la mesa. Tú empiezas en el turno 2.
      </Typography>
      <Button size="large" onClick={onStart} startIcon={<GameIcon name="battle" />} sx={{ minWidth: 240 }}>
        Empezar turno 2
      </Button>
    </Paper>
  );
}

export default WaitingView;
