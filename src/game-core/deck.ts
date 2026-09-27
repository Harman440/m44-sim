// game-core/deck.ts
import type CommandCard from './commandCard';
import { shuffle } from './utils';

/** A shuffled draw pile and a discard pile; command cards by default, combat cards too */
class Deck<Card = CommandCard> {
    drawPile: Card[];
    discardPile: Card[];
    constructor(cards: Card[] = []) {
        this.drawPile = shuffle(cards);
        this.discardPile = [];
    }

    draw(n = 1): Card[] {
        //If there are less than n cards in the draw pile, reshuffle the discard pile
        if (this.drawPile.length < n) {
            this.shuffleDiscardIntoDraw();
        }
        return this.drawPile.splice(0, n);
    }

    discard(card: Card) {
        this.discardPile.push(card);
    }

    shuffleDiscardIntoDraw() {
        this.drawPile = shuffle([...this.drawPile, ...this.discardPile]);
        this.discardPile = [];
    }

    /** Put back piles from a saved game, in their saved order */
    restorePiles(drawPile: Card[], discardPile: Card[]) {
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
