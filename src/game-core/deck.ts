// game-core/Deck.js
import { shuffle } from './utils';

class Deck {
    originalCards: string[];//TODO: change to type card
    drawPile: string[];
    discardPile: string[];
    constructor(cards = []) {
        this.originalCards = [...cards]; // in case you want to reset
        this.drawPile = shuffle(cards);
        this.discardPile = [];
    }

    draw(n = 1) {
        const drawn = this.drawPile.splice(0, n);
        return drawn;
    }

    discard(card) {
        this.discardPile.push(card);
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