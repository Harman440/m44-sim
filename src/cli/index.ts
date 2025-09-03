// cli/index.js
import commandCards from '../data/commandCards.js';
import Deck from '../game-core/deck.js';
import GameState from '../game-core/gameState.js';
import TurnState from '../game-core/turnState.js';

const gameState = new GameState({
  commandCardsDeck: new Deck(commandCards),
  initNumCommandCards: 3
});

gameState.commandCardsPlayer.printHand();
gameState.commandCardsDeck.printDeck();

//TODO: set up board function
//TODO: deal Cards and coins function
//TODO: create and place units in initial positions function

//TODO: demo turn:  set in gameState, simulate ok, 

//create turn,
const turn1 = new TurnState();
//pick card, 
turn1.commandCard = gameState.commandCardsPlayer.pickCard(0);

//TODO: units will be moved and orders saved in turnState

//print state,
//TODO: this will be shown in ui in the future
turn1.printTurnInfo();

//TODO: user would now press ok/save
//TODO: update GameState with currentTurn

//--------------------Next Turn-----------------------
//discard card, draw card
gameState.discardAndDrawCommandCard(turn1.commandCard);

gameState.commandCardsPlayer.printHand();
gameState.commandCardsDeck.printDeck();
