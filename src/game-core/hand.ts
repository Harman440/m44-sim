// game-core/Hand.js

import CommandCard from "./commandCard";

class Hand {
  cards: CommandCard[];
  constructor(cards: CommandCard[] = []) {
    this.cards = [...cards];
  }

  add(card: CommandCard) {
    this.cards.push(card);
  }

  addMultiple(cards: CommandCard[]) {
    this.cards.push(...cards);
  }

  pickCard(index: number) {
    if (index < 0 || index >= this.cards.length) {
      console.warn("pickCard: index out of bounds");
      return null;
    }
    return this.cards[index];
  }

  remove(cardToRemove: CommandCard) {
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
