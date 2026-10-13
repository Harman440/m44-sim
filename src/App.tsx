import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import './App.css';
import { scenarios } from './data/scenarios';
import { commandDeckFor } from './data/commandCards';
import { allCombatCards, combatDeckFor } from './data/combatCards';
import GameSession from './game-core/gameSession';
import GameView from './components/mainComponents/LazyGameView';
import MapEditor from './components/mapEditor/LazyMapEditor';
import Menu from './components/mainComponents/Menu';
import UpdatePrompt from './components/UpdatePrompt';
import OldBrowser from './components/OldBrowser';
import { isBrowserTooOld } from './browserSupport';
import { GameSetup } from './types/faction';
import { Scenario } from './types/scenario';
import { validateScenario } from './game-core/scenarioFile';
import { copyDraft, mapIdFor, newDraft, newMapId } from './game-core/scenarioDraft';
import { withBoardArt } from './boardArt/mapArt';
import {
  clearSavedGame,
  deleteCustomMap,
  loadCustomMaps,
  loadLastSetup,
  loadSavedGame,
  loadSettings,
  saveCustomMap,
  saveGame,
  saveLastSetup,
  saveSettings,
  savedGameScenarioId,
  settleMapIds,
} from './storage';
import { Settings, SettingsContext } from './settings';
import { LOOKS } from './looks/looks';
import { createLookTheme } from './looks/theme';

const TITLES = { es: "Memoir '44 Simultáneo", en: "Memoir '44 Simultaneous" } as const;
const LOADING = { es: 'Cargando partida', en: 'Loading the game' } as const;
const LOADING_EDITOR = { es: 'Cargando el editor de mapas', en: 'Loading the map editor' } as const;
const DRAWING_MAP = { es: 'Preparando el mapa', en: 'Getting the map ready' } as const;

const BUILT_IN_IDS = scenarios.map(({ id }) => id);

/** Mis mapas, each map that has left the editor with a name given its id from the name first */
const loadMaps = () => {
  const renamed = settleMapIds(BUILT_IN_IDS);
  return { maps: loadCustomMaps(), renamed };
};

interface CurrentGame {
  session: GameSession;
  /** Picked back up from a save rather than started from the menu */
  resumed: boolean;
  /** Keys GameView so every game starts with fresh UI state */
  number: number;
}

const App = () => {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const updateSettings = useCallback((changes: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      saveSettings(next);
      return next;
    });
  }, []);
  const settingsContext = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
  const look = LOOKS[settings.look];
  const theme = useMemo(() => createLookTheme(look), [look]);

  // Match the Android browser bar to the look
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', look.colors.bg);
  }, [look]);

  // The page's language, for screen readers and the browser's translate offer
  const { language } = settings;
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = TITLES[language];
  }, [language]);

  // On a browser too old for the app, say so up front rather than break off mid-game
  const [oldBrowser, setOldBrowser] = useState(isBrowserTooOld);

  // The maps made on this device (Mis mapas), with the built-ins in the menu
  const [customMaps, setCustomMaps] = useState<Scenario[]>(() => loadMaps().maps);
  const allScenarios = useMemo(() => [...scenarios, ...customMaps], [customMaps]);

  // A game on a map from Mis mapas is picked back up once its board art is drawn
  const [restoring, setRestoring] = useState<Scenario | null>(
    () => customMaps.find(({ id }) => id === savedGameScenarioId()) ?? null,
  );
  const [game, setGame] = useState<CurrentGame | null>(() => {
    if (restoring) return null;
    const session = loadSavedGame(allScenarios);
    return session && { session, resumed: true, number: 0 };
  });
  useEffect(() => {
    if (!restoring) return;
    let current = true;
    void withBoardArt(restoring).then((scenario) => {
      if (!current) return;
      const session = loadSavedGame([scenario]);
      setRestoring(null);
      if (session) setGame({ session, resumed: true, number: 0 });
    });
    return () => {
      current = false;
    };
  }, [restoring]);

  // Save after every change, so a reload or the tablet dropping the tab resumes here
  useEffect(() => {
    if (!game) return;
    const { session } = game;
    saveGame(session);
    return session.subscribe(() => saveGame(session));
  }, [game]);

  // The menu shows first; load the game screen while the player picks a side
  useEffect(() => {
    if (!game) void GameView.preload();
  }, [game]);

  // The map open in the editor, only ever from the menu; and the map to show in the menu afterwards
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [shownMap, setShownMap] = useState<string>();
  // A map from Mis mapas having its board art drawn before its game starts
  const [drawing, setDrawing] = useState(false);

  const handleStart = (setup: GameSetup) => {
    const scenario = allScenarios.find((s) => s.id === setup.scenarioId);
    if (!scenario || validateScenario(scenario).length > 0) return;
    saveLastSetup(setup);
    if (scenario.image) return startGame(scenario, setup);
    setDrawing(true);
    void withBoardArt(scenario).then((drawn) => {
      setDrawing(false);
      startGame(drawn, setup);
    });
  };

  const startGame = (scenario: Scenario, setup: GameSetup) => {
    const session = new GameSession({
      scenario,
      faction: setup.faction,
      initialHandSize: scenario.initialHandSize[setup.faction === "Axis" ? "axis" : "allies"],
      commandCards: commandDeckFor(scenario, setup.faction),
      combatCards: setup.testMode ? allCombatCards() : combatDeckFor(scenario, setup.faction),
      longRangeDie: setup.longRangeDie,
      testMode: setup.testMode === true,
      artilleryCrew: setup.artilleryCrew === true,
    });
    setGame((prev) => ({ session, resumed: false, number: (prev?.number ?? 0) + 1 }));
  };

  const handleExit = () => {
    clearSavedGame();
    setGame(null);
  };

  const closeEditor = (mapId: string) => {
    const { maps, renamed } = loadMaps();
    setCustomMaps(maps);
    setShownMap(renamed.get(mapId) ?? mapId);
    setEditing(null);
  };

  const duplicateMap = (id: string): string | null => {
    const map = customMaps.find((each) => each.id === id);
    if (!map) return null;
    const copy = copyDraft(map, newMapId());
    const taken = new Set(allScenarios.map((each) => each.id));
    const duplicate = { ...copy, id: mapIdFor(copy, (each) => taken.has(each)) };
    saveCustomMap(duplicate);
    setCustomMaps(loadCustomMaps());
    return duplicate.id;
  };

  const deleteMap = (id: string) => {
    deleteCustomMap(id);
    setCustomMaps(loadCustomMaps());
  };

  return (
    <SettingsContext.Provider value={settingsContext}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app" data-look={look.id}>
          {oldBrowser ? (
            <OldBrowser onTryAnyway={() => setOldBrowser(false)} />
          ) : restoring || drawing ? (
            <CircularProgress aria-label={DRAWING_MAP[language]} sx={{ m: 'auto' }} />
          ) : game ? (
            <Suspense fallback={<CircularProgress aria-label={LOADING[language]} sx={{ m: 'auto' }} />}>
              <GameView key={game.number} session={game.session} resumed={game.resumed} onExit={handleExit} />
            </Suspense>
          ) : editing ? (
            // Only from the menu, so a map is never edited during a game
            <Suspense fallback={<CircularProgress aria-label={LOADING_EDITOR[language]} sx={{ m: 'auto' }} />}>
              <MapEditor key={editing.id} map={editing} scenarios={scenarios} onExit={closeEditor} />
            </Suspense>
          ) : (
            <Menu
              scenarios={scenarios}
              customMaps={customMaps}
              initialScenarioId={shownMap}
              initialSetup={loadLastSetup()}
              onStart={handleStart}
              onOpenEditor={() => setEditing(newDraft(newMapId()))}
              onEditMap={(id) => setEditing(customMaps.find((map) => map.id === id) ?? null)}
              onDuplicateMap={duplicateMap}
              onDeleteMap={deleteMap}
            />
          )}
        </div>
        <UpdatePrompt />
      </ThemeProvider>
    </SettingsContext.Provider>
  );
};

export default App;
