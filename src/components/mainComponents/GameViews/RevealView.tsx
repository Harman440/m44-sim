import { Box, Button, Stack, Typography } from "@mui/material";
import { MotionConfig } from "motion/react";
import PassAndPlayMatch, { otherSide } from "../../../game-core/passAndPlay";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import PlayedCards from "../../PlayedCards";
import FactionInsignia from "../../FactionInsignia";
import { defineMessages, useLabels, useMessages } from "../../../i18n/useI18n";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    title: (turn: number) => `Turno ${turn}: las órdenes`,
    help: "Las dos cartas jugadas y las órdenes de los dos bandos. Toca una carta para leerla entera.",
    go: { Allies: "Seguir: empiezan los Aliados", Axis: "Seguir: empieza el Eje" },
  },
  en: {
    title: (turn: number) => `Turn ${turn}: the orders`,
    help: "Both cards played and both sides' orders. Tap a card to read all of it.",
    go: { Allies: "Go on: the Allies start", Axis: "Go on: the Axis starts" },
  },
});

interface RevealViewProps {
  match: PassAndPlayMatch;
  turn: number;
  /** The side whose view of the map is shown */
  viewer: Faction;
}

const noop = () => {};

/**
 * Pass and play, once both sides have given their orders: both cards played and both armies'
 * orders on one map, for both players to see before the turn goes on
 */
function RevealView({ match, turn, viewer }: RevealViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const session = match.sessions[viewer];
  const game = session.getSnapshot();

  return (
    <MotionConfig reducedMotion="user">
      <Box className="game-screen" sx={{ width: "100%", maxWidth: 1400 }}>
        <Box component="main" className="game-screen__main">
          <div className="phase-layout">
            <div className="phase-layout__board">
              <Board
                onTileClick={noop}
                unitHexPosition={null}
                possibleMovePositions={[]}
                possibleMoveAndFirePositions={[]}
                boardManager={session.board}
                orders={game.orders}
                markers={game.markers}
                markerKind={game.orderCombatCard?.marker?.kind}
                backgroundImage={session.scenario.image}
                faction={viewer}
                opponent={match.opponentOf(viewer)}
              />
            </div>

            <div className="phase-layout__controls">
              <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                {t.title(turn)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t.help}
              </Typography>
              {[viewer, otherSide(viewer)].map((faction) => {
                const side = match.sessions[faction].getSnapshot();
                return (
                  <Stack key={faction} component="section" className="reveal-side" aria-label={labels.factions[faction]} spacing={0.5}>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                      <FactionInsignia faction={faction} size={28} decorative />
                      <Typography variant="subtitle1" component="h2">
                        {labels.factions[faction]}
                      </Typography>
                    </Stack>
                    <PlayedCards
                      faction={faction}
                      command={side.chosenCard}
                      section={side.chosenSection}
                      combat={side.orderCombatCard}
                    />
                  </Stack>
                );
              })}
              <Button onClick={() => match.finishReveal()} startIcon={<GameIcon name="battle" />} sx={{ mt: "auto" }}>
                {t.go[match.scenario.attacker]}
              </Button>
            </div>
          </div>
        </Box>
      </Box>
    </MotionConfig>
  );
}

export default RevealView;
