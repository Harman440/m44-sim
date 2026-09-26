import { useState } from 'react';
import './App.css';
import { scenarios } from './data/scenarios';
import GameView from './components/mainComponents/GameView';
import Menu, { GameSetup } from './components/mainComponents/Menu';

const LAST_SETUP_KEY = "m44-sim:last-setup";

// Remember the last scenario and side so the next game on this device starts one tap away
const loadLastSetup = (): Partial<GameSetup> | undefined => {
  try {
    const saved = localStorage.getItem(LAST_SETUP_KEY);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
};

const saveLastSetup = (setup: GameSetup) => {
  try {
    localStorage.setItem(LAST_SETUP_KEY, JSON.stringify(setup));
  } catch {
    // Storage can be unavailable (private mode); the menu just won't pre-select
  }
};

const App = () => {
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [gameNumber, setGameNumber] = useState(0);
  const scenario = setup && scenarios.find((s) => s.id === setup.scenarioId);

  const handleStart = (newSetup: GameSetup) => {
    saveLastSetup(newSetup);
    setSetup(newSetup);
    setGameNumber((n) => n + 1);
  };

  return (
    <div className="app">
      {scenario && setup ? (
        // Keyed so every new game starts from a fresh session
        <GameView
          key={gameNumber}
          boardSide={setup.faction}
          scenario={scenario}
          onExit={() => setSetup(null)}
        />
      ) : (
        <Menu scenarios={scenarios} initialSetup={loadLastSetup()} onStart={handleStart} />
      )}
    </div>
  );
};

export default App;
