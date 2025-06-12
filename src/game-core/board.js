// game-core/board.js
class Board {
  constructor() {
    this.cells = Array(9).fill(null); // 3x3 grid
  }

  makeMove(position, player) {
    if (this.cells[position] === null) {
      this.cells[position] = player;
      return true;
    }
    return false;
  }

  checkWinner() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (const [a, b, c] of lines) {
      if (this.cells[a] && this.cells[a] === this.cells[b] && this.cells[a] === this.cells[c]) {
        return this.cells[a]; // winner (X or O)
      }
    }
    return null;
  }
}

module.exports = Board;
