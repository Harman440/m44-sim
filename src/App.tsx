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
import Menu from './components/mainComponents/Menu';
import UpdatePrompt from './components/UpdatePrompt';
import { GameSetup } from './types/faction';
import {
  clearSavedGame,
  loadLastSetup,
  loadSavedGame,
  loadSettings,
  saveGame,
  saveLastSetup,
  saveSettings,
} from './storage';
import { Settings, SettingsContext } from './settings';
import { LOOKS } from './looks/looks';
import { createLookTheme } from './looks/theme';

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

  const [game, setGame] = useState<CurrentGame | null>(() => {
    const session = loadSavedGame(scenarios);
    return session && { session, resumed: true, number: 0 };
  });

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

  const handleStart = (setup: GameSetup) => {
    const scenario = scenarios.find((s) => s.id === setup.scenarioId);
    if (!scenario) return;
    saveLastSetup(setup);
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

  return (
    <SettingsContext.Provider value={settingsContext}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app" data-look={look.id}>
          {game ? (
            <Suspense fallback={<CircularProgress aria-label="Cargando partida" sx={{ m: 'auto' }} />}>
              <GameView key={game.number} session={game.session} resumed={game.resumed} onExit={handleExit} />
            </Suspense>
          ) : (
            <Menu scenarios={scenarios} initialSetup={loadLastSetup()} onStart={handleStart} />
          )}
        </div>
        <UpdatePrompt />
      </ThemeProvider>
    </SettingsContext.Provider>
  );
};

export default App;
