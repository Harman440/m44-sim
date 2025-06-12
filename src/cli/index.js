// cli-version/index.js
const readline = require('readline');
const Board = require('../game-core/board');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const board = new Board();
let currentPlayer = 'X';

function printBoard() {
  console.log(`
    ${board.cells[0] || '0'} | ${board.cells[1] || '1'} | ${board.cells[2] || '2'}
    -----------
    ${board.cells[3] || '3'} | ${board.cells[4] || '4'} | ${board.cells[5] || '5'}
    -----------
    ${board.cells[6] || '6'} | ${board.cells[7] || '7'} | ${board.cells[8] || '8'}
  `);
}

function playTurn() {
  printBoard();
  rl.question(`Player ${currentPlayer}, enter position (0-8): `, (position) => {
    if (board.makeMove(parseInt(position), currentPlayer)) {
      const winner = board.checkWinner();
      if (winner) {
        printBoard();
        console.log(`🎉 Player ${winner} wins!`);
        rl.close();
      } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        playTurn();
      }
    } else {
      console.log('Invalid move! Try again.');
      playTurn();
    }
  });
}

playTurn();
