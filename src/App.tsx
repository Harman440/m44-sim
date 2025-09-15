import './App.css';
import { Scenario } from './types/scenario';
import { scenarios } from './data/scenarios';
import GameView from './components/mainComponents/GameView';

const App = () => {
  const BoardSide: string = "Axis"; //TODO: change in main menu. NOTE: this is what is used to render the board
  const scenarioId: string = "forest-blitz";
  const scenario: Scenario | undefined = scenarios.find(s => s.id === scenarioId);//TODO: set in menu
  if (!scenario) {
    console.error(`Scenario '${scenarioId}' not found.`);
    throw new Error(`Scenario '${scenarioId}' not found.`);
  }

  //TODO: add to scenario details
  let initCommandCards: number = 0;
  if (BoardSide === "Axis") {
    initCommandCards = 4;
  } else {
    initCommandCards = 5;
  }

  return (
    <div className="app">
      <GameView boardSide={BoardSide} scenario={scenario} initCommandCards={initCommandCards}/>
    </div>
  );
};

export default App;