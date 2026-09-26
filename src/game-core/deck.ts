// game-core/deck.ts
import CommandCard from './commandCard';
import { shuffle } from './utils';

class Deck {
    drawPile: CommandCard[];
    discardPile: CommandCard[];
    constructor(cards: CommandCard[] = []) {
        this.drawPile = shuffle(cards);
        this.discardPile = [];
    }

    draw(n = 1): CommandCard[] {
        //If there are less than n cards in the draw pile, reshuffle the discard pile
        if (this.drawPile.length < n) {
            this.shuffleDiscardIntoDraw();
        }
        return this.drawPile.splice(0, n);
    }

    discard(card: CommandCard) {
        this.discardPile.push(card);
    }

    shuffleDiscardIntoDraw() {
        this.drawPile = shuffle([...this.drawPile, ...this.discardPile]);
        this.discardPile = [];
    }

    /** Put back piles from a saved game, in their saved order */
    restorePiles(drawPile: CommandCard[], discardPile: CommandCard[]) {
        this.drawPile = [...drawPile];
        this.discardPile = [...discardPile];
    }

    getDrawPileCount() {
        return this.drawPile.length;
    }

    getDiscardPileCount() {
        return this.discardPile.length;
    }
}

export default Deck;
