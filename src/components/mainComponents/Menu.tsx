import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Scenario } from "../../types/scenario";
import { FACTIONS, Faction, GameSetup, isFaction } from "../../types/faction";
import { FACTION_LABELS } from "../../labels";

interface MenuProps {
  scenarios: readonly Scenario[];
  /** Pre-selected choices, e.g. the last game's */
  initialSetup?: Partial<GameSetup>;
  onStart: (setup: GameSetup) => void;
}

/** Start screen: pick a scenario and which side this device plays */
function Menu({ scenarios, initialSetup, onStart }: MenuProps) {
  const [scenarioId, setScenarioId] = useState(
    initialSetup?.scenarioId && scenarios.some((s) => s.id === initialSetup.scenarioId)
      ? initialSetup.scenarioId
      : scenarios[0]?.id
  );
  // The remembered setup comes from storage, so check it's still a real side
  const [faction, setFaction] = useState<Faction | null>(
    isFaction(initialSetup?.faction) ? initialSetup.faction : null
  );

  const scenario = scenarios.find((s) => s.id === scenarioId);
  const handSize = scenario && faction ? scenario.initialHandSize[faction === "Axis" ? "axis" : "allies"] : null;

  return (
    <Stack spacing={3} sx={{ width: "100%", maxWidth: 900, py: 2 }}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Memoir '44 · Turnos simultáneos
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Cada jugador usa su propio dispositivo junto al tablero: elige carta, da órdenes y
          resuelve la batalla en la mesa.
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Escenario
        </Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {scenarios.map((s) => (
            <Card
              key={s.id}
              variant="outlined"
              sx={{
                borderWidth: 2,
                borderColor: s.id === scenarioId ? "primary.main" : "divider",
              }}
            >
              <CardActionArea onClick={() => setScenarioId(s.id)} aria-pressed={s.id === scenarioId}>
                {s.image && <CardMedia component="img" image={s.image} alt="" sx={{ height: 140 }} />}
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {s.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {s.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          ¿Qué bando juegas en este dispositivo?
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={faction}
          onChange={(_, value: Faction | null) => value && setFaction(value)}
          aria-label="Bando"
        >
          {FACTIONS.map((f) => (
            <ToggleButton key={f} value={f} sx={{ minWidth: 140, minHeight: 56, fontSize: "1.1rem" }}>
              {FACTION_LABELS[f]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {handSize !== null && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Empiezas con {handSize} cartas de mando.
          </Typography>
        )}
      </Box>

      <Button
        size="large"
        disabled={!scenarioId || !faction}
        onClick={() => scenarioId && faction && onStart({ scenarioId, faction })}
        sx={{ alignSelf: "flex-start", minWidth: 240 }}
      >
        Empezar partida
      </Button>
    </Stack>
  );
}

export default Menu;
