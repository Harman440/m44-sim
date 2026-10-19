import { Button, Stack, Typography } from "@mui/material";
import PassAndPlayMatch, { otherSide } from "../../../game-core/passAndPlay";
import { MatchResult } from "../../../game-core/victory";
import { UnitType } from "../../../game-core/unit";
import { FACTIONS } from "../../../types/faction";
import FactionInsignia from "../../FactionInsignia";
import GameIcon from "../../GameIcon";
import { MedalBreakdown } from "../../MedalTally";
import { VictoryInfo } from "../../VictoryContext";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    victory: { Allies: "Victoria aliada", Axis: "Victoria del Eje" },
    youWon: "¡Has ganado!",
    youLost: "Has perdido.",
    atTurn: (turn: number) => `Al final del turno ${turn}.`,
    wipedOut: { Allies: "Los Aliados se han quedado sin unidades.", Axis: "El Eje se ha quedado sin unidades." },
    lost: { Allies: "Bajas aliadas", Axis: "Bajas del Eje" },
    none: "ninguna",
    exit: "Salir al menú",
  },
  en: {
    victory: { Allies: "Allied victory", Axis: "Axis victory" },
    youWon: "You won!",
    youLost: "You lost.",
    atTurn: (turn: number) => `At the end of turn ${turn}.`,
    wipedOut: { Allies: "The Allies have no units left.", Axis: "The Axis has no units left." },
    lost: { Allies: "Allied losses", Axis: "Axis losses" },
    none: "none",
    exit: "Back to the menu",
  },
});

interface MatchResultViewProps {
  match: PassAndPlayMatch;
  result: MatchResult;
  onExit: () => void;
}

/** The end of a match: who won, the medals, and each side's losses */
function MatchResultView({ match, result, onExit }: MatchResultViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const { winner } = result;
  const person = match.computer ? otherSide(match.computer) : null;
  const victory: VictoryInfo = {
    medals: match.scenario.victory?.medals ?? 0,
    standing: result.medals,
    objectives: match.scenario.victory?.objectives ?? [],
    held: match.getSnapshot().victory?.held ?? { Allies: [], Axis: [] },
  };
  const losses = (lost: UnitType[]) => {
    const counts = Object.values(UnitType)
      .map((type) => ({ type, count: lost.filter((t) => t === type).length }))
      .filter(({ count }) => count > 0);
    return counts.length ? counts.map(({ type, count }) => `${count} × ${labels.units[type].toLowerCase()}`).join(", ") : t.none;
  };

  return (
    <Stack spacing={3} sx={{ alignItems: "center", m: "auto", maxWidth: 560, width: "100%", px: 2, py: 4 }} data-testid="match-result">
      <FactionInsignia faction={winner} size={96} decorative />
      <Stack spacing={0.5} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h3" component="h1">
          {t.victory[winner]}
        </Typography>
        {person && <Typography variant="h5">{person === winner ? t.youWon : t.youLost}</Typography>}
        <Typography variant="body1" color="text.secondary">
          {tr(match.scenario.name)} · {result.wipedOut ? t.wipedOut[otherSide(winner)] : t.atTurn(result.turn)}
        </Typography>
      </Stack>
      <MedalBreakdown victory={victory} />
      <Stack spacing={0.5} sx={{ alignSelf: "stretch" }}>
        {FACTIONS.map((side) => (
          <Typography key={side} variant="body2">
            <strong>{t.lost[side]}:</strong> {losses(result.lost[side])}
          </Typography>
        ))}
      </Stack>
      <Button size="large" onClick={onExit} startIcon={<GameIcon name="exit" />}>
        {t.exit}
      </Button>
    </Stack>
  );
}

export default MatchResultView;
