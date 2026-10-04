import { useState } from "react";
import SettingsDialog from "../SettingsDialog";
import FactionInsignia from "../FactionInsignia";
import GameIcon from "../GameIcon";
import ScenarioDetails from "./ScenarioDetails";
import { TEST_MODE_COINS } from "../../data/coinRules";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  FormControlLabel,
  Stack,
  Switch,
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

  const [longRangeDie, setLongRangeDie] = useState(initialSetup?.longRangeDie === true);
  // Not remembered: a real game shouldn't start in test mode by accident
  const [testMode, setTestMode] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const scenario = scenarios.find((s) => s.id === scenarioId);
  const handSize = scenario && faction ? scenario.initialHandSize[faction === "Axis" ? "axis" : "allies"] : null;

  return (
    <Stack spacing={3} sx={{ width: "100%", maxWidth: 900, py: 2 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box sx={{ flexGrow: 1, borderBottom: "3px double", borderColor: "divider", pb: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Orden de operaciones
          </Typography>
          <Typography variant="h3" component="h1">
            Memoir '44 · Turnos simultáneos
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Cada jugador usa su propio dispositivo junto al tablero: elige carta, da órdenes y
            resuelve la batalla en la mesa.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<GameIcon name="settings" />} onClick={() => setSettingsOpen(true)}>
          Ajustes
        </Button>
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
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Ataca: {FACTION_LABELS[s.attacker]}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
        {scenario && (
          <Box sx={{ mt: 2 }}>
            <ScenarioDetails scenario={scenario} />
          </Box>
        )}
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
            <ToggleButton key={f} value={f} sx={{ minWidth: 160, minHeight: 56, fontSize: "1.1rem", gap: 1.5 }}>
              <FactionInsignia faction={f} size={30} decorative />
              {FACTION_LABELS[f]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {scenario && faction && handSize !== null && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Empiezas con {handSize} cartas de mando.{" "}
            {scenario.attacker === faction
              ? "Atacas: juegas un turno extra al empezar, antes de que el rival pueda responder."
              : "Defiendes: el rival juega primero un turno extra y tú empiezas en el turno 2."}
          </Typography>
        )}
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Reglas de prueba
        </Typography>
        <FormControlLabel
          control={<Switch checked={longRangeDie} onChange={(e) => setLongRangeDie(e.target.checked)} />}
          label="Dado de 8 caras a distancia"
          sx={{ minHeight: 48 }}
        />
        <Typography variant="body2" color="text.secondary">
          Los disparos a una unidad no adyacente se tiran con un dado de 8 caras: 3 infantería, 2 tanques,
          bandera y 2 suministros. El tanque impacta a blindados y artillería. Actívalo en los dos
          dispositivos.
        </Typography>
        <FormControlLabel
          control={<Switch checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />}
          label="Modo prueba: todas las cartas de combate"
          sx={{ minHeight: 48, mt: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          Para probar las cartas: empiezas con una de cada carta de combate en la mano, sin límite, las
          que juegas vuelven a la mano al acabar el turno y cada turno empieza con al menos{" "}
          {TEST_MODE_COINS} suministros.
        </Typography>
      </Box>

      <Button
        size="large"
        disabled={!scenarioId || !faction}
        onClick={() => scenarioId && faction && onStart({ scenarioId, faction, longRangeDie, testMode })}
        startIcon={<GameIcon name="battle" />}
        sx={{ alignSelf: "flex-start", minWidth: 240, fontSize: "1.2rem" }}
      >
        Empezar partida
      </Button>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Stack>
  );
}

export default Menu;
