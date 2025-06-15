// game-core/gameState.js
import Deck from './deck.js';
import Hand from './hand.js';

class GameState {
  constructor({
    faction = null,
    board = null,
    initNumCommandCards = 6,
    playingWithCombatCards = true,
    units = [],
    currentTurn = null,
    phase = 'command',
    commandCardsDeck = new Deck(),
    combatCardsDeck = new Deck(),
    combatCardsPlayer = [],
    totalCommandCoins = 0,
  } = {}) {
    this.faction = faction;
    this.board = board;
    this.playingWithCombatCards = playingWithCombatCards;
    this.units = units;
    this.currentTurn = currentTurn;
    this.phase = phase;
    this.commandCardsDeck = commandCardsDeck;
    this.combatCardsDeck = combatCardsDeck;
    this.commandCardsPlayer = new Hand(this.commandCardsDeck.draw(initNumCommandCards));
    this.combatCardsPlayer = combatCardsPlayer;
    this.totalCommandCoins = totalCommandCoins;
  }

    updateCommandCardsDeck(newDeck) {
        if (!Array.isArray(newDeck)) {
        throw new Error('updateCommandCardsDeck expects an array');
        }
        this.commandCardsDeck = newDeck;
    }

    discardAndDrawCommandCard(card) {//TODO: check if this works
        this.commandCardsPlayer.remove(card);
        this.commandCardsDeck.discard(card);
        this.commandCardsPlayer.add(this.commandCardsDeck.draw(1)[0]);
    }
}

export default GameState;