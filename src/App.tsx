import './App.css';
import { Scenario } from './types/scenario';
import { scenarios } from './data/scenarios';
import GameView from './components/mainComponents/GameView';

const App = () => {
  const BoardSide: string = "Axis"; //TODO: change in main menu. NOTE: this is what is used to render the board
  const scenarioId: string = "foret-decouves";
  const scenario: Scenario | undefined = scenarios.find(s => s.id === scenarioId);//TODO: set in menu
  if (!scenario) {
    console.error(`Scenario '${scenarioId}' not found.`);
    throw new Error(`Scenario '${scenarioId}' not found.`);
  }

  return (
    <div className="app">
      <GameView boardSide={BoardSide} scenario={scenario} />
    </div>
  );
};

export default App;