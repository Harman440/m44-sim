import { lazy, Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { Button, CircularProgress, Stack, Typography } from "@mui/material";
import PassAndPlayMatch from "../../game-core/passAndPlay";
import { Faction } from "../../types/faction";
import GameView from "./LazyGameView";
import { OpponentContext, ViewSideContext } from "../OpponentContext";
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

// The board comes with it, so it loads with the game screen's code
const RevealView = lazy(() => import("./GameViews/RevealView"));
const SharedBattleView = lazy(() => import("./GameViews/SharedBattleView"));

interface MatchViewProps {
  match: PassAndPlayMatch;
  /** Picked back up from a save: both hands were already dealt */
  resumed?: boolean;
  onExit: () => void;
}

/**
 * Pass and play: the game of the side holding the device, with a cover screen whenever the
 * device changes hands, so neither player sees the other's cards and orders
 */
function MatchView(props: MatchViewProps) {
  // Every map is seen from the main side, whoever holds the device
  return (
    <ViewSideContext.Provider value={props.match.mainSide}>
      <MatchScreen {...props} />
    </ViewSideContext.Provider>
  );
}

function MatchScreen({ match, resumed = false, onExit }: MatchViewProps) {
  const { active, covered, revealTurn, canPass, battle } = useSyncExternalStore(match.subscribe, match.getSnapshot);
  // The sides whose hand has been dealt on screen: it isn't dealt again each time the device comes back
  const dealt = useRef(new Set<Faction>(resumed ? ["Allies", "Axis"] : []));
  const onOwnScreen = revealTurn === null && !battle && !covered;
  useEffect(() => {
    if (onOwnScreen) dealt.current.add(active);
  }, [onOwnScreen, active]);
  const t = useMessages(TEXT);
  const loading = <CircularProgress aria-label={t.loading} sx={{ m: "auto" }} />;

  // Both sides' orders are given: both players look
  if (revealTurn !== null) {
    return (
      <Suspense fallback={loading}>
        <RevealView match={match} turn={revealTurn} viewer={match.mainSide} />
      </Suspense>
    );
  }

  // The battle, on one screen for both players
  if (battle) {
    return (
      <Suspense fallback={loading}>
        <SharedBattleView match={match} />
      </Suspense>
    );
  }

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
    <Suspense fallback={loading}>
      {/* The other army on every map: where it stands, and its orders once revealed */}
      <OpponentContext.Provider
        value={{ opponent: match.opponentOf(active), strength: match.activeSession().getSnapshot().strength }}
      >
        {/* Keyed by side: each player's screen starts with its own UI state */}
        <GameView
          key={active}
          session={match.activeSession()}
          onExit={onExit}
          onPass={canPass ? () => match.pass() : undefined}
          handDealt={dealt.current.has(active)}
        />
      </OpponentContext.Provider>
    </Suspense>
  );
}

export default MatchView;
