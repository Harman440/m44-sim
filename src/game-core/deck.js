// game-core/Deck.js
import { shuffle } from './utils.js';

class Deck {
    constructor(cards = []) {
        this.originalCards = [...cards]; // in case you want to reset
        this.drawPile = shuffle(cards);
        this.discardPile = [];
    }

    draw(n = 1) {
        const drawn = this.drawPile.splice(0, n);
        return drawn;
    }

    discard(cards) {
        this.discardPile.push(...cards);
    }

    shuffleDiscardIntoDraw() {
        this.drawPile = shuffle([...this.drawPile, ...this.discardPile]);
        this.discardPile = [];
    }

    reset() {
        this.drawPile = shuffle([...this.originalCards]);
        this.discardPile = [];
    }

    getDrawPileCount() {
        return this.drawPile.length;
    }

    getDiscardPileCount() {
        return this.discardPile.length;
    }

    printDeck() {
        console.log("Current draw pile:");
        this.drawPile.forEach((card, i) =>
            console.log(`${i + 1}. ${card.toString()}`)
        );
    }
}

export default Deck;