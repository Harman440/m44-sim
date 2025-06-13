// game-core/Hand.js

class Hand {
  constructor(cards = []) {
    this.cards = [...cards];
  }

  add(card) {
    this.cards.push(card);
  }

  addMultiple(cards) {
    this.cards.push(...cards);
  }

  pickCard(index) {
    if (index < 0 || index >= this.cards.length) {
      console.warn("pickCard: index out of bounds");
      return null;
    }
    return this.cards[index];
  }

  remove(cardToRemove) {
    this.cards = this.cards.filter((card) => card !== cardToRemove);
  }

  printHand() {
    console.log("Player Hand:");
    this.cards.forEach((card, i) => {
      console.log(`${i + 1}. ${card.toString()}`);
    });
  }

  getCards() {
    return [...this.cards];
  }
}

export default Hand;
