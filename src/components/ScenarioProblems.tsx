import { Box, List, ListItem, ListItemButton, Stack, Typography } from "@mui/material";
import { Position } from "../types/scenario";
import { ScenarioProblem } from "../game-core/scenarioFile";
import GameIcon from "./GameIcon";
import { defineMessages, useMessages, useTr } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    ready: "Se puede jugar",
    notYet: "Para poder jugarlo:",
    showHexes: (problem: string) => `${problem}: ver en el mapa`,
  },
  en: {
    ready: "Ready to play",
    notYet: "Before it can be played:",
    showHexes: (problem: string) => `${problem}: show on the map`,
  },
});

interface ScenarioProblemsProps {
  /** What keeps the map from being played (validateScenario) */
  problems: readonly ScenarioProblem[];
  /** Point a problem's hexes out on the map; without it, no line can be tapped */
  onShowHexes?: (positions: readonly Position[]) => void;
}

/** What's still wrong with a map, a line each; tapping a line about some hexes shows them on the map */
function ScenarioProblems({ problems, onShowHexes }: ScenarioProblemsProps) {
  const t = useMessages(TEXT);
  const tr = useTr();

  if (problems.length === 0) {
    return (
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, color: "success.main" }} role="status">
        <GameIcon name="confirm" size={22} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t.ready}
        </Typography>
      </Stack>
    );
  }

  return (
    <Box role="status">
      <Typography variant="body2" sx={{ fontWeight: 600, color: "warning.main" }}>
        {t.notYet}
      </Typography>
      <List dense disablePadding>
        {problems.map((problem) => {
          const message = tr(problem.message);
          return onShowHexes && problem.positions.length ? (
            <ListItemButton
              key={message}
              onClick={() => onShowHexes(problem.positions)}
              aria-label={t.showHexes(message)}
              sx={{ minHeight: 48, px: 1, gap: 1 }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {message}
              </Typography>
              <GameIcon name="map" size={22} />
            </ListItemButton>
          ) : (
            <ListItem key={message} sx={{ px: 1 }}>
              <Typography variant="body2">{message}</Typography>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

export default ScenarioProblems;
