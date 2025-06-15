// src/App.js
import React, { useEffect, useState } from 'react';
import GameState from './game-core/gameState.js';
import Deck from './game-core/deck.js';
import commandCards from './data/commandCards.js';
import hand from './game-core/hand.js';

function App() {
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    const deck = new Deck(commandCards);
    const state = new GameState({
      commandCardsDeck: deck,
    });

    setGameState(state);
  }, []);

  if (!gameState) return <div>Loading...</div>;

  const hand = gameState.commandCardsPlayer.getCards();

  return (
    <div>
      <h1>M44 Command Cards</h1>
      <ul>
        {hand.map((card, index) => (
          <li key={index}>
            <strong>{card.name}</strong>: {card.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
