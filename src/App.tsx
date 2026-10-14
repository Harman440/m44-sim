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
import Menu from './components/mainComponents/Menu';
import UpdatePrompt from './components/UpdatePrompt';
import OldBrowser from './components/OldBrowser';
import { isBrowserTooOld } from './browserSupport';
import { Faction, GameSetup, MatchSetup } from './types/faction';
import { Scenario } from './types/scenario';
import {
  clearSavedGame,
  clearSavedMatch,
  loadLastSetup,
  loadSavedGame,
  loadSavedMatch,
  loadSettings,
  saveGame,
  saveMatch,
  saveLastSetup,
  saveSettings,
} from './storage';
import { Settings, SettingsContext } from './settings';
import { LOOKS } from './looks/looks';
import { createLookTheme } from './looks/theme';

const TITLES = { es: "Memoir '44 Simultáneo", en: "Memoir '44 Simultaneous" } as const;
const LOADING = { es: 'Cargando partida', en: 'Loading the game' } as const;

/** A new game for one side, as the menu set it up */
const newSession = (scenario: Scenario, faction: Faction, setup: MatchSetup) =>
  new GameSession({
    scenario,
    faction,
    initialHandSize: scenario.initialHandSize[faction === 'Axis' ? 'axis' : 'allies'],
    commandCards: commandDeckFor(scenario, faction),
    combatCards: setup.testMode ? allCombatCards() : combatDeckFor(scenario, faction),
    longRangeDie: setup.longRangeDie,
    testMode: setup.testMode === true,
    artilleryCrew: setup.artilleryCrew === true,
  });

interface CurrentGame {
  /** One side's game (one device per side), or a pass and play match (both sides on this device) */
  play: { session: GameSession } | { match: PassAndPlayMatch };
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

  const [game, setGame] = useState<CurrentGame | null>(() => {
    const match = loadSavedMatch(scenarios);
    if (match) return { play: { match }, resumed: true, number: 0 };
    const session = loadSavedGame(scenarios);
    return session && { play: { session }, resumed: true, number: 0 };
  });

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

  const handleStart = (setup: GameSetup) => {
    const scenario = scenarios.find((s) => s.id === setup.scenarioId);
    if (!scenario) return;
    saveLastSetup(setup);
    // Only one game is kept: a new one replaces any other save
    clearSavedMatch();
    const session = newSession(scenario, setup.faction, setup);
    setGame((prev) => ({ play: { session }, resumed: false, number: (prev?.number ?? 0) + 1 }));
  };

  const handlePassAndPlay = (setup: MatchSetup) => {
    const scenario = scenarios.find((s) => s.id === setup.scenarioId);
    if (!scenario) return;
    clearSavedGame();
    const match = new PassAndPlayMatch(scenario, {
      Allies: newSession(scenario, 'Allies', setup),
      Axis: newSession(scenario, 'Axis', setup),
    });
    setGame((prev) => ({ play: { match }, resumed: false, number: (prev?.number ?? 0) + 1 }));
  };

  const handleExit = () => {
    clearSavedGame();
    clearSavedMatch();
    setGame(null);
  };

  return (
    <SettingsContext.Provider value={settingsContext}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app" data-look={look.id}>
          {oldBrowser ? (
            <OldBrowser onTryAnyway={() => setOldBrowser(false)} />
          ) : game ? (
            <Suspense fallback={<CircularProgress aria-label={LOADING[language]} sx={{ m: 'auto' }} />}>
              {'match' in game.play ? (
                <MatchView key={game.number} match={game.play.match} onExit={handleExit} />
              ) : (
                <GameView key={game.number} session={game.play.session} resumed={game.resumed} onExit={handleExit} />
              )}
            </Suspense>
          ) : (
            <Menu scenarios={scenarios} initialSetup={loadLastSetup()} onStart={handleStart} onPassAndPlay={handlePassAndPlay} />
          )}
        </div>
        <UpdatePrompt />
      </ThemeProvider>
    </SettingsContext.Provider>
  );
};

export default App;
