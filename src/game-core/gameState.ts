// game-core/gameState.js
import { GamePhase } from '../types/gameManager.js';
import BoardManager from './BoardManager.js';
import CommandCard from './commandCard.js';
import Deck from './deck';
import Hand from './hand';
import TurnState from './turnState.js';

class GameState {
  faction: string; //TODO: check if needed, what to store. Will the board change during the game?
  board: BoardManager;//NOTE: this will store the units position. Board might also change.
  playingWithCombatCards: boolean; //TODO: check if needed, what to store. Will the board change during the game?
  currentTurn: number;
  phase: GamePhase;
  commandCardsDeck: Deck;
  combatCardsDeck: Deck;
  commandCardsPlayer: Hand;
  combatCardsPlayer: string[];//TODO: change to deck of cards later
  totalCommandCoins: number;
  constructor({
    board = new BoardManager(),//TODO: avoid creating a new board here
    faction = "allies", //Default to Allies
    initNumCommandCards = 6,
    playingWithCombatCards = true,
    currentTurn = 1,
    phase = GamePhase.SETUP,
    commandCardsDeck = new Deck(),
    combatCardsDeck = new Deck(),
    combatCardsPlayer = [],
    totalCommandCoins = 0,
  } = {}) {
    this.faction = faction;
    this.board = board;
    this.playingWithCombatCards = playingWithCombatCards;
    this.currentTurn = currentTurn;
    this.phase = phase;
    this.commandCardsDeck = commandCardsDeck;
    this.combatCardsDeck = combatCardsDeck;
    this.commandCardsPlayer = new Hand(this.commandCardsDeck.draw(initNumCommandCards));
    this.combatCardsPlayer = combatCardsPlayer;
    this.totalCommandCoins = totalCommandCoins;
  }

  update(turnState: TurnState) {
    console.log("updating game state"); //TODO
    //     // Apply all turn changes to game state atomically
    // setGameState(prev => {
    //   const newGameState = { ...prev };
      
    //   // Apply moves
    //   turnState.movesThisTurn.forEach(move => {
    //     const unitIndex = newGameState.units.findIndex(u => u.id === move.unitId);
    //     if (unitIndex !== -1) {
    //       newGameState.units[unitIndex] = {
    //         ...newGameState.units[unitIndex],
    //         x: move.to.x,
    //         y: move.to.y,
    //       };
    //     }
    //   });

    //   // Apply combat damage
    //   turnState.combatResults.forEach(combat => {
    //     const defenderIndex = newGameState.units.findIndex(u => u.id === combat.defenderId);
    //     if (defenderIndex !== -1) {
    //       newGameState.units[defenderIndex] = {
    //         ...newGameState.units[defenderIndex],
    //         health: Math.max(0, newGameState.units[defenderIndex].health - combat.damage),
    //       };
    //     }
    //   });

    //   // Remove dead units
    //   newGameState.units = newGameState.units.filter(unit => unit.health > 0);

    //   // Switch players and increment turn
    //   return {
    //     ...newGameState,
    //     currentPlayer: newGameState.currentPlayer === 1 ? 2 : 1,
    //     turn: newGameState.currentPlayer === 2 ? newGameState.turn + 1 : newGameState.turn,
    //   };
    turnState.startNewTurn();
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