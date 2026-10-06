import { lazy, Suspense, useRef, useState } from "react";
import SettingsDialog from "../SettingsDialog";
import GameIcon from "../GameIcon";
import ScenarioDetails from "./ScenarioDetails";
import { TEST_MODE_COINS } from "../../data/coinRules";
import {
  Box,
  Button,
  FormControlLabel,
  List,
  ListItemButton,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Scenario } from "../../types/scenario";
import { Faction, GameSetup } from "../../types/faction";
import { FACTION_LABELS } from "../../labels";

interface MenuProps {
  scenarios: readonly Scenario[];
  /** Pre-selected choices, e.g. the last game's */
  initialSetup?: Partial<GameSetup>;
  onStart: (setup: GameSetup) => void;
}

const ScenarioPreview = lazy(() => import("./ScenarioPreview"));

/** Start screen: pick a scenario, then which side this device plays */
function Menu({ scenarios, initialSetup, onStart }: MenuProps) {
  // Nothing is picked beforehand: the player taps the scenario and the side
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [faction, setFaction] = useState<Faction | null>(null);

  const [longRangeDie, setLongRangeDie] = useState(initialSetup?.longRangeDie === true);
  const [artilleryCrew, setArtilleryCrew] = useState(initialSetup?.artilleryCrew === true);
  // Not remembered: a real game shouldn't start in test mode by accident
  const [testMode, setTestMode] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const sideBySide = useMediaQuery((theme) => theme.breakpoints.up("md"));
  const scenario = scenarios.find((s) => s.id === scenarioId);
  const testRules = [
    longRangeDie && "dado de 8 caras a distancia",
    artilleryCrew && "la artillería destruida queda como infantería",
    testMode && "modo prueba",
  ].filter(Boolean);

  const pickScenario = (id: string) => {
    setScenarioId(id);
    // In portrait the details open under the list, out of sight
    if (!sideBySide) requestAnimationFrame(() => detailsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  return (
    <Stack spacing={3} sx={{ width: "100%", maxWidth: 1100, py: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, borderBottom: "3px double", borderColor: "divider", pb: 1.5 }}>
        <Typography variant="h3" component="h1" sx={{ flexGrow: 1 }}>
          Memoir '44 Simultáneo
        </Typography>
        <Button variant="outlined" startIcon={<GameIcon name="settings" />} onClick={() => setSettingsOpen(true)}>
          Ajustes
        </Button>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          alignItems: "start",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(240px, 300px) minmax(0, 1fr)" },
        }}
      >
        <Box component="nav" aria-label="Escenarios">
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Elige escenario:
          </Typography>
          <List disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
            {scenarios.map((s, i) => (
              <ListItemButton
                key={s.id}
                selected={s.id === scenarioId}
                aria-pressed={s.id === scenarioId}
                onClick={() => pickScenario(s.id)}
                divider={i < scenarios.length - 1}
                sx={{
                  gap: 1.5,
                  minHeight: 56,
                  borderLeft: 4,
                  borderLeftColor: s.id === scenarioId ? "primary.main" : "transparent",
                }}
              >
                {s.image && (
                  <Box
                    component="img"
                    src={s.image}
                    alt=""
                    sx={{ width: 64, height: 40, objectFit: "cover", borderRadius: 0.5, flex: "none" }}
                  />
                )}
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {s.name}
                </Typography>
              </ListItemButton>
            ))}
          </List>
        </Box>

        {scenario ? (
          <Box
            ref={detailsRef}
            component="section"
            aria-label={scenario.name}
            sx={{ scrollMarginTop: 16, border: 1, borderColor: "divider", borderRadius: 1, p: { xs: 1.5, sm: 2 } }}
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5" component="h2">
                  {scenario.name}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {scenario.description}
                </Typography>
              </Box>
              <Suspense
                fallback={
                  scenario.image && (
                    <Box
                      component="img"
                      src={scenario.image}
                      alt=""
                      sx={{ width: "100%", display: "block", transform: faction === "Axis" ? "rotate(180deg)" : undefined }}
                    />
                  )
                }
              >
                <ScenarioPreview scenario={scenario} faction={faction ?? "Allies"} />
              </Suspense>
              <ScenarioDetails scenario={scenario} faction={faction} onPickFaction={setFaction} />
              {testRules.length > 0 && (
                <Typography variant="body2" color="warning.main">
                  Reglas de prueba: {testRules.join(", ")}.
                </Typography>
              )}
              <Button
                size="large"
                disabled={!faction}
                onClick={() => faction && onStart({ scenarioId: scenario.id, faction, longRangeDie, artilleryCrew, testMode })}
                startIcon={<GameIcon name="battle" />}
                sx={{ fontSize: "1.2rem" }}
              >
                {faction ? `Empezar con ${FACTION_LABELS[faction]}` : "Elige bando"}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Typography variant="body1" color="text.secondary" sx={{ display: { xs: "none", md: "block" }, pt: 6, textAlign: "center" }}>
            Toca un escenario para ver su mapa y sus bandos.
          </Typography>
        )}
      </Box>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Typography variant="h6" component="h3" sx={{ mt: 3, mb: 0.5 }}>
          Reglas de prueba
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Para la próxima partida.
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
          control={<Switch checked={artilleryCrew} onChange={(e) => setArtilleryCrew(e.target.checked)} />}
          label="La artillería destruida queda como infantería"
          sx={{ minHeight: 48, mt: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          Cuando destruyen una de tus artillerías, sus artilleros siguen luchando: en la fase final, al
          eliminarla del mapa, en su casilla queda una unidad de infantería. Pon en la mesa una figura de
          infantería en su lugar.
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
      </SettingsDialog>
    </Stack>
  );
}

export default Menu;
