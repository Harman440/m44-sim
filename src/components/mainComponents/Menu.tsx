import { lazy, Suspense, useMemo, useRef, useState } from "react";
import SettingsDialog from "../SettingsDialog";
import GameIcon from "../GameIcon";
import ScenarioDetails from "./ScenarioDetails";
import ScenarioProblems from "../ScenarioProblems";
import { useMapArt } from "../useMapArt";
import { TEST_MODE_COINS } from "../../data/coinRules";
import { validateScenario } from "../../game-core/scenarioFile";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  List,
  ListItemButton,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Scenario } from "../../types/scenario";
import { Faction, GameSetup, MatchSetup } from "../../types/faction";
import { defineMessages, useLabels, useMessages, useTr } from "../../i18n/useI18n";
import { boardSizeOf, isStandardBoard } from "../../game-core/boardSize";

const TEXT = defineMessages({
  es: {
    title: "Memoir '44 Simultáneo",
    settings: "Ajustes",
    ruleBook: "Reglamento",
    mapEditor: "Editor de mapas",
    scenarios: "Escenarios",
    pickScenario: "Elige escenario:",
    testRules: "Reglas de prueba",
    testRulesInUse: (rules: string) => `Reglas de prueba: ${rules}.`,
    longRangeDieRule: "dado de 8 caras a distancia",
    artilleryCrewRule: "la artillería destruida queda como infantería",
    testModeRule: "modo prueba",
    startWith: (faction: string) => `Empezar con ${faction}`,
    pickSide: "Elige bando",
    bigMap: (cols: number, rows: number) => `Este mapa es más grande que el estándar (${cols} × ${rows}): se juega en Pasar y jugar o contra el ordenador.`,
    passAndPlay: "Pasar y jugar: los dos bandos aquí",
    passAndPlayHelp: (side: string | null) =>
      `Los dos jugadores en este dispositivo, pasándolo en cada turno. ${
        side ? `El mapa se ve siempre desde el lado de: ${side}.` : "Elige antes el bando desde cuyo lado se ve el mapa."
      }`,
    computer: "Contra el ordenador",
    computerHelp: (side: string | null) =>
      side ? `Juegas con ${side}; el ordenador, con el otro bando.` : "Elige antes tu bando: el ordenador juega con el otro.",
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
    myMaps: "Mis mapas",
    noMaps: "Los mapas que hagas en el editor aparecen aquí.",
    newMap: "Nuevo mapa",
    untitled: "Mapa sin nombre",
    unfinished: "Sin terminar",
    notReady: "Todavía no se puede jugar",
    mapActions: "Acciones del mapa",
    edit: "Editar",
    duplicate: "Duplicar",
    delete: "Borrar",
    deleteTitle: (name: string) => `¿Borrar «${name}»?`,
    deleteText: "Se borra de este dispositivo, y no se puede deshacer.",
    cancel: "Cancelar",
  },
  en: {
    title: "Memoir '44 Simultaneous",
    settings: "Settings",
    ruleBook: "Rule book",
    mapEditor: "Map editor",
    scenarios: "Scenarios",
    pickScenario: "Pick a scenario:",
    testRules: "Test rules",
    testRulesInUse: (rules: string) => `Test rules: ${rules}.`,
    longRangeDieRule: "8-sided die at range",
    artilleryCrewRule: "destroyed artillery stays as infantry",
    testModeRule: "test mode",
    startWith: (faction: string) => `Start as the ${faction}`,
    pickSide: "Pick a side",
    bigMap: (cols: number, rows: number) => `This map is bigger than the standard one (${cols} × ${rows}): it's played in Pass and play or against the computer.`,
    passAndPlay: "Pass and play: both sides here",
    passAndPlayHelp: (side: string | null) =>
      `Both players on this device, passing it every turn. ${
        side ? `The map is always seen from this side: ${side}.` : "First pick the side the map is seen from."
      }`,
    computer: "Against the computer",
    computerHelp: (side: string | null) =>
      side ? `You play the ${side}; the computer plays the other side.` : "First pick your side: the computer plays the other.",
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
    myMaps: "My maps",
    noMaps: "The maps you make in the editor show up here.",
    newMap: "New map",
    untitled: "Untitled map",
    unfinished: "Unfinished",
    notReady: "Can't be played yet",
    mapActions: "Map actions",
    edit: "Edit",
    duplicate: "Duplicate",
    delete: "Delete",
    deleteTitle: (name: string) => `Delete "${name}"?`,
    deleteText: "It's deleted from this device, and it can't be undone.",
    cancel: "Cancel",
  },
});

interface MenuProps {
  /** The built-in scenarios */
  scenarios: readonly Scenario[];
  /** The maps made on this device ("Mis mapas"), playable or not yet */
  customMaps?: readonly Scenario[];
  /** The scenario shown when the menu opens (the map just edited) */
  initialScenarioId?: string;
  /** Pre-selected choices, e.g. the last game's */
  initialSetup?: Partial<GameSetup>;
  onStart: (setup: GameSetup) => void;
  /** Start a pass and play match: both sides on this device */
  onPassAndPlay?: (setup: MatchSetup) => void;
  /** Open the map editor on a new map */
  onOpenEditor?: () => void;
  onEditMap?: (id: string) => void;
  /** Copy a map into Mis mapas; gives the copy's id */
  onDuplicateMap?: (id: string) => string | null;
  onDeleteMap?: (id: string) => void;
}

const ScenarioPreview = lazy(() => import("./ScenarioPreview"));
const RuleBookDialog = lazy(() => import("../RuleBookDialog"));

/** A scenario's map, small, for the list: its painted art, or the art drawn for a map from Mis mapas */
function ScenarioThumbnail({ scenario }: { scenario: Scenario }) {
  const art = useMapArt(scenario);
  const size = { width: 64, height: 40, flex: "none", borderRadius: 0.5 };
  return art ? <Box component="img" src={art} alt="" sx={{ ...size, objectFit: "cover" }} /> : <Box sx={{ ...size, bgcolor: "action.hover" }} />;
}

/** Start screen: pick a scenario (a built-in one or one of Mis mapas), then which side this device plays */
function Menu({
  scenarios,
  customMaps = [],
  initialScenarioId,
  initialSetup,
  onStart,
  onPassAndPlay,
  onOpenEditor,
  onEditMap,
  onDuplicateMap,
  onDeleteMap,
}: MenuProps) {
  // Nothing is picked beforehand, but the map just edited: the player taps the scenario and the side
  const [scenarioId, setScenarioId] = useState<string | null>(initialScenarioId ?? null);
  const [faction, setFaction] = useState<Faction | null>(null);

  const [longRangeDie, setLongRangeDie] = useState(initialSetup?.longRangeDie === true);
  const [artilleryCrew, setArtilleryCrew] = useState(initialSetup?.artilleryCrew === true);
  // Not remembered: a real game shouldn't start in test mode by accident
  const [testMode, setTestMode] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ruleBookOpen, setRuleBookOpen] = useState(false);
  const [deleting, setDeleting] = useState<Scenario | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const sideBySide = useMediaQuery((theme) => theme.breakpoints.up("md"));
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? customMaps.find((s) => s.id === scenarioId);
  const customMap = customMaps.some((s) => s.id === scenarioId);
  // The built-ins are always playable (scenarios.test.ts); a map from Mis mapas may be half made
  const problems = useMemo(() => (scenario && customMap ? validateScenario(scenario) : []), [scenario, customMap]);
  const art = useMapArt(scenario);
  const shown = useMemo(() => scenario && (scenario.image ? scenario : { ...scenario, image: art }), [scenario, art]);
  const nameOf = (s: Scenario) => tr(s.name) || t.untitled;
  const testRules = [
    longRangeDie && t.longRangeDieRule,
    artilleryCrew && t.artilleryCrewRule,
    testMode && t.testModeRule,
  ].filter(Boolean);

  const duplicate = (id: string) => {
    const copy = onDuplicateMap?.(id);
    if (copy) setScenarioId(copy);
  };

  const pickScenario = (id: string) => {
    setScenarioId(id);
    // In portrait the details open under the list, out of sight
    if (!sideBySide) requestAnimationFrame(() => detailsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  const scenarioList = (list: readonly Scenario[]) => (
    <List disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      {list.map((s, i) => (
        <ListItemButton
          key={s.id}
          selected={s.id === scenarioId}
          aria-pressed={s.id === scenarioId}
          onClick={() => pickScenario(s.id)}
          divider={i < list.length - 1}
          sx={{
            gap: 1.5,
            minHeight: 56,
            borderLeft: 4,
            borderLeftColor: s.id === scenarioId ? "primary.main" : "transparent",
          }}
        >
          <ScenarioThumbnail scenario={s} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {nameOf(s)}
            </Typography>
            {list === customMaps && validateScenario(s).length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t.unfinished}
              </Typography>
            )}
          </Box>
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Stack spacing={3} sx={{ width: "100%", maxWidth: 1100, py: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, borderBottom: "3px double", borderColor: "divider", pb: 1.5 }}>
        <Typography variant="h3" component="h1" sx={{ flexGrow: 1 }}>
          {t.title}
        </Typography>
        {onOpenEditor && (
          <Button variant="outlined" startIcon={<GameIcon name="map" />} onClick={onOpenEditor} sx={{ whiteSpace: "nowrap" }}>
            {t.mapEditor}
          </Button>
        )}
        <Button variant="outlined" startIcon={<GameIcon name="ruleBook" />} onClick={() => setRuleBookOpen(true)} sx={{ whiteSpace: "nowrap" }}>
          {t.ruleBook}
        </Button>
        <Button variant="outlined" startIcon={<GameIcon name="settings" />} onClick={() => setSettingsOpen(true)} sx={{ whiteSpace: "nowrap" }}>
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
          {scenarioList(scenarios)}
          <Typography variant="h6" component="h2" sx={{ mt: 3, mb: 1 }}>
            {t.myMaps}
          </Typography>
          {customMaps.length > 0 ? (
            scenarioList(customMaps)
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t.noMaps}
            </Typography>
          )}
          {onOpenEditor && (
            <Button variant="outlined" startIcon={<GameIcon name="map" />} onClick={onOpenEditor} sx={{ mt: 1.5 }}>
              {t.newMap}
            </Button>
          )}
        </Box>

        {scenario ? (
          <Box
            ref={detailsRef}
            component="section"
            aria-label={nameOf(scenario)}
            sx={{ scrollMarginTop: 16, border: 1, borderColor: "divider", borderRadius: 1, p: { xs: 1.5, sm: 2 } }}
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5" component="h2">
                  {nameOf(scenario)}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {tr(scenario.description)}
                </Typography>
              </Box>
              <Suspense
                fallback={
                  shown?.image && (
                    <Box
                      component="img"
                      src={shown.image}
                      alt=""
                      sx={{ width: "100%", display: "block", transform: faction === "Axis" ? "rotate(180deg)" : undefined }}
                    />
                  )
                }
              >
                <ScenarioPreview scenario={shown ?? scenario} faction={faction ?? "Allies"} />
              </Suspense>
              <ScenarioDetails scenario={scenario} faction={faction} onPickFaction={setFaction} />
              {testRules.length > 0 && (
                <Typography variant="body2" color="warning.main">
                  {t.testRulesInUse(testRules.join(", "))}
                </Typography>
              )}
              {problems.length > 0 && <ScenarioProblems problems={problems} />}
              {isStandardBoard(boardSizeOf(scenario)) ? (
                <Button
                  size="large"
                  disabled={!faction || problems.length > 0}
                  onClick={() => faction && onStart({ scenarioId: scenario.id, faction, longRangeDie, artilleryCrew, testMode })}
                  startIcon={<GameIcon name="battle" />}
                  sx={{ fontSize: "1.2rem" }}
                >
                  {problems.length > 0 ? t.notReady : faction ? t.startWith(labels.factions[faction]) : t.pickSide}
                </Button>
              ) : (
                // Own tablets wait: a bigger map is played with both sides on one device for now
                <Typography variant="body2" color="text.secondary">
                  {t.bigMap(boardSizeOf(scenario).cols, boardSizeOf(scenario).rows)}
                </Typography>
              )}
              {onPassAndPlay && (
                <Stack spacing={0.5}>
                  <Button
                    variant="outlined"
                    size="large"
                    disabled={!faction || problems.length > 0}
                    onClick={() =>
                      faction && onPassAndPlay({ scenarioId: scenario.id, mainSide: faction, longRangeDie, artilleryCrew, testMode })
                    }
                    startIcon={<GameIcon name="pass" />}
                  >
                    {t.passAndPlay}
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                    {t.passAndPlayHelp(faction ? labels.factions[faction] : null)}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="large"
                    disabled={!faction || problems.length > 0}
                    onClick={() =>
                      faction &&
                      onPassAndPlay({ scenarioId: scenario.id, mainSide: faction, longRangeDie, artilleryCrew, testMode, computer: true })
                    }
                    startIcon={<GameIcon name="offensive" />}
                  >
                    {t.computer}
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                    {t.computerHelp(faction ? labels.factions[faction] : null)}
                  </Typography>
                </Stack>
              )}
              {customMap && (
                <Stack direction="row" role="group" aria-label={t.mapActions} sx={{ gap: 1, flexWrap: "wrap" }}>
                  {onEditMap && (
                    <Button variant="outlined" startIcon={<GameIcon name="map" />} onClick={() => onEditMap(scenario.id)}>
                      {t.edit}
                    </Button>
                  )}
                  {onDuplicateMap && (
                    <Button variant="outlined" startIcon={<GameIcon name="cards" />} onClick={() => duplicate(scenario.id)}>
                      {t.duplicate}
                    </Button>
                  )}
                  {onDeleteMap && (
                    <Button variant="outlined" color="error" startIcon={<GameIcon name="cancel" />} onClick={() => setDeleting(scenario)}>
                      {t.delete}
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>
        ) : (
          <Typography variant="body1" color="text.secondary" sx={{ display: { xs: "none", md: "block" }, pt: 6, textAlign: "center" }}>
            {t.tapScenario}
          </Typography>
        )}
      </Box>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        {deleting && (
          <>
            <DialogTitle>{t.deleteTitle(nameOf(deleting))}</DialogTitle>
            <DialogContent>
              <DialogContentText>{t.deleteText}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" onClick={() => setDeleting(null)}>
                {t.cancel}
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  onDeleteMap?.(deleting.id);
                  setScenarioId(null);
                  setDeleting(null);
                }}
              >
                {t.delete}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {ruleBookOpen && (
        <Suspense fallback={null}>
          <RuleBookDialog open onClose={() => setRuleBookOpen(false)} />
        </Suspense>
      )}

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
