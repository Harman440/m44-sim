import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import './App.css';
import { scenarios } from './data/scenarios';
import { commandDeckFor } from './data/commandCards';
import { allCombatCards, combatDeckFor } from './data/combatCards';
import GameSession from './game-core/gameSession';
import PassAndPlayMatch from './game-core/passAndPlay';
import GameView from './components/mainComponents/LazyGameView';
import MatchView from './components/mainComponents/MatchView';
import MapEditor from './components/mapEditor/LazyMapEditor';
import Menu from './components/mainComponents/Menu';
import UpdatePrompt from './components/UpdatePrompt';
import OldBrowser from './components/OldBrowser';
import { isBrowserTooOld } from './browserSupport';
import { Faction, GameSetup, MatchSetup } from './types/faction';
import { Scenario } from './types/scenario';
import { validateScenario } from './game-core/scenarioFile';
import { copyDraft, mapIdFor, newDraft, newMapId } from './game-core/scenarioDraft';
import { withBoardArt } from './boardArt/mapArt';
import {
  clearSavedGame,
  clearSavedMatch,
  deleteCustomMap,
  loadCustomMaps,
  loadLastSetup,
  loadSavedGame,
  loadSavedMatch,
  loadSettings,
  saveCustomMap,
  saveGame,
  saveMatch,
  saveLastSetup,
  saveSettings,
  savedGameScenarioId,
  savedMatchScenarioId,
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

/** A new game for one side, as the menu set it up */
const newSession = (scenario: Scenario, faction: Faction, setup: Omit<GameSetup, 'faction'>, figures = false) =>
  new GameSession({
    scenario,
    faction,
    initialHandSize: scenario.initialHandSize[faction === 'Axis' ? 'axis' : 'allies'],
    commandCards: commandDeckFor(scenario, faction),
    combatCards: setup.testMode ? allCombatCards() : combatDeckFor(scenario, faction),
    longRangeDie: setup.longRangeDie,
    testMode: setup.testMode === true,
    artilleryCrew: setup.artilleryCrew === true,
    figures,
  });

interface CurrentGame {
  /** One side's game (one device per side), or a pass and play match (both sides on this device) */
  play: { session: GameSession } | { match: PassAndPlayMatch };
  /** Picked back up from a save rather than started from the menu */
  resumed: boolean;
  /** Keys GameView so every game starts with fresh UI state */
  number: number;
}

/** The match or game in progress, picked back up from its save */
const resumeSaved = (scenarios: readonly Scenario[]): CurrentGame | null => {
  const match = loadSavedMatch(scenarios);
  if (match) return { play: { match }, resumed: true, number: 0 };
  const session = loadSavedGame(scenarios);
  return session && { play: { session }, resumed: true, number: 0 };
};

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

  // A game or match on a map from Mis mapas is picked back up once its board art is drawn
  const [restoring, setRestoring] = useState<Scenario | null>(() => {
    const savedId = savedMatchScenarioId() ?? savedGameScenarioId();
    return customMaps.find(({ id }) => id === savedId) ?? null;
  });
  const [game, setGame] = useState<CurrentGame | null>(() => (restoring ? null : resumeSaved(allScenarios)));
  useEffect(() => {
    if (!restoring) return;
    let current = true;
    void withBoardArt(restoring).then((scenario) => {
      if (!current) return;
      const resumed = resumeSaved([scenario]);
      setRestoring(null);
      if (resumed) setGame(resumed);
    });
    return () => {
      current = false;
    };
  }, [restoring]);

  // Save after every change, so a reload or the tablet dropping the tab resumes here
  useEffect(() => {
    if (!game) return;
    const { play } = game;
    if ('match' in play) {
      saveMatch(play.match);
      return play.match.subscribe(() => saveMatch(play.match));
    }
    saveGame(play.session);
    return play.session.subscribe(() => saveGame(play.session));
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

  /** The scenario picked in the menu, if it can be played (a map from Mis mapas may not be yet) */
  const playable = (id: string) => {
    const scenario = allScenarios.find((s) => s.id === id);
    return scenario && validateScenario(scenario).length === 0 ? scenario : null;
  };

  /** Start on a scenario with its board art: a map from Mis mapas has it drawn first */
  const withArt = (scenario: Scenario, start: (scenario: Scenario) => void) => {
    if (scenario.image) return start(scenario);
    setDrawing(true);
    void withBoardArt(scenario).then((drawn) => {
      setDrawing(false);
      start(drawn);
    });
  };

  const handleStart = (setup: GameSetup) => {
    const scenario = playable(setup.scenarioId);
    if (!scenario) return;
    saveLastSetup(setup);
    withArt(scenario, (drawn) => {
      // Only one game is kept: a new one replaces any other save
      clearSavedMatch();
      const session = newSession(drawn, setup.faction, setup);
      setGame((prev) => ({ play: { session }, resumed: false, number: (prev?.number ?? 0) + 1 }));
    });
  };

  const handlePassAndPlay = (setup: MatchSetup) => {
    const scenario = playable(setup.scenarioId);
    if (!scenario) return;
    withArt(scenario, (drawn) => {
      clearSavedGame();
      const match = new PassAndPlayMatch(drawn, {
        // Both armies are in the app: units have figures and take the hits
        Allies: newSession(drawn, 'Allies', setup, true),
        Axis: newSession(drawn, 'Axis', setup, true),
      }, { mainSide: setup.mainSide });
      setGame((prev) => ({ play: { match }, resumed: false, number: (prev?.number ?? 0) + 1 }));
    });
  };

  const handleExit = () => {
    clearSavedGame();
    clearSavedMatch();
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
              {'match' in game.play ? (
                <MatchView key={game.number} match={game.play.match} resumed={game.resumed} onExit={handleExit} />
              ) : (
                <GameView key={game.number} session={game.play.session} resumed={game.resumed} onExit={handleExit} />
              )}
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
              onPassAndPlay={handlePassAndPlay}
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
