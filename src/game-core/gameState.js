//game-core/gameState.js
class GameState {
    board = null;
    units = [];
    currentTurn = null;
    phase = 'command';
    commandCards = [];
    combatCards = [];
    commandCardsDeck = [];
    combatCardsDeck = [];
    totalCommandCoins = 0;
}