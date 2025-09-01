// game-core/gameState.js
import BoardManager from './BoardManager.js';
import Deck from './deck';
import Hand from './hand';
import Unit from './unit';

class GameState {
  faction: string;
  board: BoardManager;//TODO: check if this is the type
  playingWithCombatCards: boolean;
  units: Unit[];
  currentTurn: number;
  phase: string;
  commandCardsDeck: Deck;
  combatCardsDeck: Deck;
  commandCardsPlayer: Hand;
  combatCardsPlayer: string[];//TODO: change to deck of cards later
  totalCommandCoins: number;
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

    updateCommandCardsDeck(newDeck: Deck) {
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