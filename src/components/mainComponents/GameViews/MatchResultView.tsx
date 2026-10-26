import { useState } from "react";
import { Box, Button, Chip, Divider, IconButton, Stack, Typography } from "@mui/material";
import PassAndPlayMatch, { armyOf, otherSide } from "../../../game-core/passAndPlay";
import { MatchResult } from "../../../game-core/victory";
import { DieFace } from "../../../game-core/dice";
import { UnitType } from "../../../game-core/unit";
import { sideStats } from "../../../game-core/matchStats";
import { FACTIONS, Faction } from "../../../types/faction";
import DieFaceIcon from "../../DieFaceIcon";
import FactionInsignia from "../../FactionInsignia";
import GameIcon from "../../GameIcon";
import MapViewer, { MapOnly } from "../../MapViewer";
import { MedalBreakdown } from "../../MedalTally";
import StatBar from "../../StatBar";
import { VictoryInfo } from "../../VictoryContext";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    victory: { Allies: "Victoria aliada", Axis: "Victoria del Eje" },
    youWon: "¡Has ganado!",
    youLost: "Has perdido.",
    atTurn: (turn: number) => `Al final del turno ${turn}.`,
    wipedOut: { Allies: "Los Aliados se han quedado sin unidades.", Axis: "El Eje se ha quedado sin unidades." },
    lost: "Bajas",
    none: "ninguna",
    exit: "Salir al menú",
    fullMap: "Ver el mapa a pantalla completa",
    stats: "Estadísticas",
    left: (units: number, figures: number) => `Quedan ${units} ${units === 1 ? "unidad" : "unidades"} con ${figures} ${figures === 1 ? "figura" : "figuras"}`,
    dice: (n: number) => `${n} ${n === 1 ? "dado tirado" : "dados tirados"}`,
    face: (face: string, n: number, percent: number) => `${face}: ${n} (${percent} %)`,
    rolls: (shots: number, collisions: number, attacks: number) =>
      [`${shots} ${shots === 1 ? "disparo" : "disparos"}`, `${collisions} ${collisions === 1 ? "choque" : "choques"}`, `${attacks} ${attacks === 1 ? "ataque de carta" : "ataques de carta"}`].join(" · "),
    cards: "Cartas jugadas",
    noCards: "Ninguna",
  },
  en: {
    victory: { Allies: "Allied victory", Axis: "Axis victory" },
    youWon: "You won!",
    youLost: "You lost.",
    atTurn: (turn: number) => `At the end of turn ${turn}.`,
    wipedOut: { Allies: "The Allies have no units left.", Axis: "The Axis has no units left." },
    lost: "Losses",
    none: "none",
    exit: "Back to the menu",
    fullMap: "See the map full screen",
    stats: "Stats",
    left: (units: number, figures: number) => `${units} ${units === 1 ? "unit" : "units"} left with ${figures} ${figures === 1 ? "figure" : "figures"}`,
    dice: (n: number) => `${n} ${n === 1 ? "die rolled" : "dice rolled"}`,
    face: (face: string, n: number, percent: number) => `${face}: ${n} (${percent}%)`,
    rolls: (shots: number, collisions: number, attacks: number) =>
      [`${shots} ${shots === 1 ? "shot" : "shots"}`, `${collisions} ${collisions === 1 ? "collision" : "collisions"}`, `${attacks} card ${attacks === 1 ? "attack" : "attacks"}`].join(" · "),
    cards: "Cards played",
    noCards: "None",
  },
});

const FACES: readonly DieFace[] = Object.values(DieFace);

interface MatchResultViewProps {
  match: PassAndPlayMatch;
  result: MatchResult;
  onExit: () => void;
}

/** One side's game: what's left of it, its losses, its dice and the cards it played */
function SideStatsPanel({ match, side, lost }: { match: PassAndPlayMatch; side: Faction; lost: UnitType[] }) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const session = match.sessions[side];
  const stats = sideStats(session.getSnapshot());
  const army = armyOf(session);
  const figures = army.reduce((sum, { position }) => sum + (session.figuresAt(position) ?? 0), 0);
  const losses = Object.values(UnitType)
    .map((type) => ({ type, count: lost.filter((each) => each === type).length }))
    .filter(({ count }) => count > 0);
  const percent = (n: number) => (stats.dice ? Math.round((n / stats.dice) * 100) : 0);
  // The bars are measured against the face rolled most, so the shares can be told apart
  const most = Math.max(0, ...FACES.map((face) => stats.faces[face]));

  return (
    <Stack spacing={1} sx={{ flex: "1 1 220px", minWidth: 0 }} data-testid={`side-stats-${side}`}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <FactionInsignia faction={side} size={28} decorative />
        <Typography variant="h6" component="h3">
          {labels.factions[side]}
        </Typography>
      </Stack>
      <Typography variant="body2">{t.left(army.length, figures)}</Typography>
      <Typography variant="body2">
        <strong>{t.lost}:</strong>{" "}
        {losses.length ? losses.map(({ type, count }) => `${count} × ${labels.units[type].toLowerCase()}`).join(", ") : t.none}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, pt: 0.5 }}>
        {t.dice(stats.dice)}
      </Typography>
      <Stack spacing={0.5}>
        {FACES.map((face) => (
          <StatBar
            key={face}
            icon={
              <Box sx={{ display: "inline-flex", "& .die": { width: 26, height: 26 } }}>
                <DieFaceIcon face={face} faction={side} />
              </Box>
            }
            value={stats.faces[face]}
            max={most}
            color="secondary"
            text={`${stats.faces[face]} · ${percent(stats.faces[face])}%`}
            label={t.face(labels.dieFaces[face], stats.faces[face], percent(stats.faces[face]))}
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t.rolls(stats.shots, stats.collisions, stats.cardAttacks)}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, pt: 0.5 }}>
        {t.cards}
      </Typography>
      {stats.cardsPlayed.length ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
          {stats.cardsPlayed.map((name, i) => (
            <Chip key={i} size="small" label={tr(name)} />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t.noCards}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * The end of a match: the whole map as the battle left it, with both armies and no fog; who won,
 * the medals, and each side's game in numbers (what's left, losses, dice, cards)
 */
function MatchResultView({ match, result, onExit }: MatchResultViewProps) {
  const t = useMessages(TEXT);
  const tr = useTr();
  const [fullMap, setFullMap] = useState(false);
  const { winner } = result;
  const person = match.computer ? otherSide(match.computer) : null;
  const victory: VictoryInfo = {
    medals: match.scenario.victory?.medals ?? 0,
    standing: result.medals,
    objectives: match.scenario.victory?.objectives ?? [],
    held: match.getSnapshot().victory?.held ?? { Allies: [], Axis: [] },
  };
  // Everything in sight: the match is over
  const map = {
    session: match.sessions[match.mainSide],
    faction: match.mainSide,
    opponent: match.opponentOf(match.mainSide, { fogged: false }),
    fog: null,
    strength: match.sessions[match.mainSide].getSnapshot().strength,
  };

  return (
    <Box
      data-testid="match-result"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "100%",
        maxWidth: 1400,
        mx: "auto",
        "@media (orientation: landscape)": {
          flexDirection: "row",
          alignItems: "stretch",
          height: "calc(100dvh - 2 * var(--app-padding, 0px))",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          flex: "none",
          "@media (orientation: landscape)": { flex: "1 1 auto", minWidth: 0 },
        }}
      >
        <MapOnly {...map} portraitNatural />
        <IconButton
          className="map-viewer__corner"
          aria-label={t.fullMap}
          title={t.fullMap}
          onClick={() => setFullMap(true)}
        >
          <GameIcon name="map" size={26} />
        </IconButton>
      </Box>

      <Stack
        spacing={2}
        sx={{
          px: 1,
          pb: 2,
          "@media (orientation: landscape)": { flex: "0 0 min(440px, 42%)", overflowY: "auto" },
        }}
      >
        <Stack spacing={0.5} sx={{ alignItems: "center", textAlign: "center" }}>
          <FactionInsignia faction={winner} size={72} decorative />
          <Typography variant="h3" component="h1">
            {t.victory[winner]}
          </Typography>
          {person && <Typography variant="h5">{person === winner ? t.youWon : t.youLost}</Typography>}
          <Typography variant="body1" color="text.secondary">
            {tr(match.scenario.name)} · {result.wipedOut ? t.wipedOut[otherSide(winner)] : t.atTurn(result.turn)}
          </Typography>
        </Stack>
        <MedalBreakdown victory={victory} />
        <Divider />
        <Typography variant="h5" component="h2">
          {t.stats}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 3 }}>
          {FACTIONS.map((side) => (
            <SideStatsPanel key={side} match={match} side={side} lost={result.lost[side]} />
          ))}
        </Stack>
        <Button size="large" onClick={onExit} startIcon={<GameIcon name="exit" />} sx={{ alignSelf: "center" }}>
          {t.exit}
        </Button>
      </Stack>

      <MapViewer open={fullMap} onClose={() => setFullMap(false)} {...map} />
    </Box>
  );
}

export default MatchResultView;
