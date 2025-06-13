// cli/index.js
import commandCards from '../game-core/commandCards.js';
import Deck from '../game-core/deck.js';
import GameState from '../game-core/gameState.js';

const gameState = new GameState({
  commandCardsDeck: new Deck(commandCards),
  initNumCommandCards: 3
});

gameState.commandCardsPlayer.printHand();
gameState.commandCardsDeck.printDeck();

//TODO: set up board function
//TODO: deal Cards and coins function
//TODO: create and place units in initial positions function

//TODO: demo turn: create turn, pick card, print state, set in gameState, simulate ok, 
// next turn: discard card, draw card