import { Suspense, useSyncExternalStore } from "react";
import { Button, CircularProgress, Stack, Typography } from "@mui/material";
import PassAndPlayMatch from "../../game-core/passAndPlay";
import GameView from "./LazyGameView";
import FactionInsignia from "../FactionInsignia";
import GameIcon from "../GameIcon";
import { defineMessages, useMessages } from "../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    turnOf: { Allies: "Turno de los Aliados", Axis: "Turno del Eje" },
    handOver: {
      Allies: "Pasa el dispositivo al jugador de los Aliados. El otro jugador no debe mirar la pantalla.",
      Axis: "Pasa el dispositivo al jugador del Eje. El otro jugador no debe mirar la pantalla.",
    },
    show: { Allies: "Juego con los Aliados: mostrar", Axis: "Juego con el Eje: mostrar" },
    loading: "Cargando partida",
  },
  en: {
    turnOf: { Allies: "Allies to play", Axis: "Axis to play" },
    handOver: {
      Allies: "Hand the device to the Allies player. The other player shouldn't look at the screen.",
      Axis: "Hand the device to the Axis player. The other player shouldn't look at the screen.",
    },
    show: { Allies: "I play the Allies: show", Axis: "I play the Axis: show" },
    loading: "Loading the game",
  },
});

interface MatchViewProps {
  match: PassAndPlayMatch;
  onExit: () => void;
}

/**
 * Pass and play: the game of the side holding the device, with a cover screen whenever the
 * device changes hands, so neither player sees the other's cards and orders
 */
function MatchView({ match, onExit }: MatchViewProps) {
  const { active, covered } = useSyncExternalStore(match.subscribe, match.getSnapshot);
  const t = useMessages(TEXT);

  if (covered) {
    return (
      <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center", m: "auto", maxWidth: 520, px: 2, py: 6 }}>
        <FactionInsignia faction={active} size={96} decorative />
        <Typography variant="h3" component="h1">
          {t.turnOf[active]}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t.handOver[active]}
        </Typography>
        <Button size="large" onClick={() => match.uncover()} startIcon={<GameIcon name="pass" />} sx={{ fontSize: "1.2rem" }}>
          {t.show[active]}
        </Button>
      </Stack>
    );
  }

  return (
    <Suspense fallback={<CircularProgress aria-label={t.loading} sx={{ m: "auto" }} />}>
      {/* Keyed by side: each player's screen starts with its own UI state */}
      <GameView key={active} session={match.activeSession()} onExit={onExit} onPass={() => match.pass()} />
    </Suspense>
  );
}

export default MatchView;
