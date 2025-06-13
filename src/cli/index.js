// cli/index.js
import commandCards from '../game-core/commandCards.js';
import Deck from '../game-core/deck.js';

const commandDeck = new Deck(commandCards);

console.log(`Shuffled Deck (${commandCards.length} cards):\n`);
commandDeck.printDeck();

//TODO: set up board function
//TODO: deal Cards and coins function
//TODO: create and place units in initial positions function