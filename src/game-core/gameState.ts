// game-core/gameState.js
import BoardManager from './BoardManager.js';
import CommandCard from './commandCard.js';
import Deck from './deck';
import Hand from './hand';
import Unit from './unit';

class GameState {
  faction: string; //TODO: check if needed, what to store. Will the board change during the game?
  board: BoardManager | null;//TODO: check if this is the type. AND check if needed, what to store. Will the board change during the game?
  playingWithCombatCards: boolean; //TODO: check if needed, what to store. Will the board change during the game?
  units: Unit[];
  currentTurn: number;
  phase: string;
  commandCardsDeck: Deck;
  combatCardsDeck: Deck;
  commandCardsPlayer: Hand;
  combatCardsPlayer: string[];//TODO: change to deck of cards later
  totalCommandCoins: number;
  constructor({
    faction = "allies", //Default to Allies
    board = null,
    initNumCommandCards = 6,
    playingWithCombatCards = true,
    units = [],
    currentTurn = 0,
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

    discardAndDrawCommandCard(card: CommandCard) {//TODO: check if this works
        this.commandCardsPlayer.remove(card);
        this.commandCardsDeck.discard(card);
        this.commandCardsPlayer.add(this.commandCardsDeck.draw(1)[0]!);//TODO: drawmight not return a card
    }
}

export default GameState;