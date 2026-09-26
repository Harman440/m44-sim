import { useEffect, useState } from 'react';
import './App.css';
import { scenarios } from './data/scenarios';
import commandCards from './data/commandCards';
import GameSession from './game-core/gameSession';
import GameView from './components/mainComponents/GameView';
import Menu from './components/mainComponents/Menu';
import { GameSetup } from './types/faction';
import { clearSavedGame, loadLastSetup, loadSavedGame, saveGame, saveLastSetup } from './storage';

interface CurrentGame {
  session: GameSession;
  /** Picked back up from a save rather than started from the menu */
  resumed: boolean;
  /** Keys GameView so every game starts with fresh UI state */
  number: number;
}

const App = () => {
  const [game, setGame] = useState<CurrentGame | null>(() => {
    const session = loadSavedGame(scenarios, commandCards);
    return session && { session, resumed: true, number: 0 };
  });

  // Save after every change, so a reload or the tablet dropping the tab resumes here
  useEffect(() => {
    if (!game) return;
    const { session } = game;
    saveGame(session);
    return session.subscribe(() => saveGame(session));
  }, [game]);

  const handleStart = (setup: GameSetup) => {
    const scenario = scenarios.find((s) => s.id === setup.scenarioId);
    if (!scenario) return;
    saveLastSetup(setup);
    const session = new GameSession({
      scenario,
      faction: setup.faction,
      initialHandSize: scenario.initialHandSize[setup.faction === "Axis" ? "axis" : "allies"],
      commandCards,
    });
    setGame((prev) => ({ session, resumed: false, number: (prev?.number ?? 0) + 1 }));
  };

  const handleExit = () => {
    clearSavedGame();
    setGame(null);
  };

  return (
    <div className="app">
      {game ? (
        <GameView key={game.number} session={game.session} resumed={game.resumed} onExit={handleExit} />
      ) : (
        <Menu scenarios={scenarios} initialSetup={loadLastSetup()} onStart={handleStart} />
      )}
    </div>
  );
};

export default App;
