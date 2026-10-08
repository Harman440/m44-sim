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
import { defineMessages, useLabels, useMessages, useTr } from "../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Memoir '44 Simultáneo",
    settings: "Ajustes",
    scenarios: "Escenarios",
    pickScenario: "Elige escenario:",
    testRules: "Reglas de prueba",
    testRulesInUse: (rules: string) => `Reglas de prueba: ${rules}.`,
    longRangeDieRule: "dado de 8 caras a distancia",
    artilleryCrewRule: "la artillería destruida queda como infantería",
    testModeRule: "modo prueba",
    startWith: (faction: string) => `Empezar con ${faction}`,
    pickSide: "Elige bando",
    tapScenario: "Toca un escenario para ver su mapa y sus bandos.",
    nextGame: "Para la próxima partida.",
    longRangeDie: "Dado de 8 caras a distancia",
    longRangeDieHelp:
      "Los disparos a una unidad no adyacente se tiran con un dado de 8 caras: 3 infantería, 2 tanques, " +
      "bandera y 2 suministros. El tanque impacta a blindados y artillería. Actívalo en los dos dispositivos.",
    artilleryCrew: "La artillería destruida queda como infantería",
    artilleryCrewHelp:
      "Cuando destruyen una de tus artillerías, sus artilleros siguen luchando: en la fase final, al " +
      "eliminarla del mapa, en su casilla queda una unidad de infantería. Pon en la mesa una figura de " +
      "infantería en su lugar.",
    testMode: "Modo prueba: todas las cartas de combate",
    testModeHelp: (coins: number) =>
      "Para probar las cartas: empiezas con una de cada carta de combate en la mano, sin límite, las " +
      `que juegas vuelven a la mano al acabar el turno y cada turno empieza con al menos ${coins} suministros.`,
  },
  en: {
    title: "Memoir '44 Simultaneous",
    settings: "Settings",
    scenarios: "Scenarios",
    pickScenario: "Pick a scenario:",
    testRules: "Test rules",
    testRulesInUse: (rules: string) => `Test rules: ${rules}.`,
    longRangeDieRule: "8-sided die at range",
    artilleryCrewRule: "destroyed artillery stays as infantry",
    testModeRule: "test mode",
    startWith: (faction: string) => `Start as the ${faction}`,
    pickSide: "Pick a side",
    tapScenario: "Tap a scenario to see its map and its sides.",
    nextGame: "For the next game.",
    longRangeDie: "8-sided die at range",
    longRangeDieHelp:
      "Shots at a unit that isn't adjacent are rolled with an 8-sided die: 3 infantry, 2 tanks, " +
      "a flag and 2 supplies. The tank hits armor and artillery. Turn it on on both devices.",
    artilleryCrew: "Destroyed artillery stays as infantry",
    artilleryCrewHelp:
      "When one of your artillery units is destroyed, its crew keeps fighting: in the final phase, when " +
      "you remove it from the map, an infantry unit stays on its hex. Put an infantry figure in its " +
      "place on the table.",
    testMode: "Test mode: every combat card",
    testModeHelp: (coins: number) =>
      "To try out the cards: you start with one of each combat card in your hand, with no limit, the " +
      `ones you play come back to your hand at the end of the turn and each turn starts with at least ${coins} supplies.`,
  },
});

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
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const scenario = scenarios.find((s) => s.id === scenarioId);
  const testRules = [
    longRangeDie && t.longRangeDieRule,
    artilleryCrew && t.artilleryCrewRule,
    testMode && t.testModeRule,
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
          {t.title}
        </Typography>
        <Button variant="outlined" startIcon={<GameIcon name="settings" />} onClick={() => setSettingsOpen(true)}>
          {t.settings}
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
        <Box component="nav" aria-label={t.scenarios}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {t.pickScenario}
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
                  {tr(scenario.description)}
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
                  {t.testRulesInUse(testRules.join(", "))}
                </Typography>
              )}
              <Button
                size="large"
                disabled={!faction}
                onClick={() => faction && onStart({ scenarioId: scenario.id, faction, longRangeDie, artilleryCrew, testMode })}
                startIcon={<GameIcon name="battle" />}
                sx={{ fontSize: "1.2rem" }}
              >
                {faction ? t.startWith(labels.factions[faction]) : t.pickSide}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Typography variant="body1" color="text.secondary" sx={{ display: { xs: "none", md: "block" }, pt: 6, textAlign: "center" }}>
            {t.tapScenario}
          </Typography>
        )}
      </Box>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Typography variant="h6" component="h3" sx={{ mt: 3, mb: 0.5 }}>
          {t.testRules}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t.nextGame}
        </Typography>
        <FormControlLabel
          control={<Switch checked={longRangeDie} onChange={(e) => setLongRangeDie(e.target.checked)} />}
          label={t.longRangeDie}
          sx={{ minHeight: 48 }}
        />
        <Typography variant="body2" color="text.secondary">
          {t.longRangeDieHelp}
        </Typography>
        <FormControlLabel
          control={<Switch checked={artilleryCrew} onChange={(e) => setArtilleryCrew(e.target.checked)} />}
          label={t.artilleryCrew}
          sx={{ minHeight: 48, mt: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          {t.artilleryCrewHelp}
        </Typography>
        <FormControlLabel
          control={<Switch checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />}
          label={t.testMode}
          sx={{ minHeight: 48, mt: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          {t.testModeHelp(TEST_MODE_COINS)}
        </Typography>
      </SettingsDialog>
    </Stack>
  );
}

export default Menu;
