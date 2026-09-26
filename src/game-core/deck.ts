// game-core/Deck.js
import CommandCard from './commandCard';
import { shuffle } from './utils';

class Deck {
    originalCards: CommandCard[];//TODO: change to type card, to have both comandCards and combatCards
    drawPile: CommandCard[];
    discardPile: CommandCard[];
    constructor(cards: CommandCard[] = []) {
        this.originalCards = [...cards]; // in case you want to reset
        this.drawPile = shuffle(cards);
        this.discardPile = [];
    }

    draw(n = 1): CommandCard[] {
        //If there are less than n cards in the draw pile, reshuffle the discard pile
        if (this.drawPile.length < n) {
            this.shuffleDiscardIntoDraw();
        }
        if (this.drawPile.length === 0) {
            return [];
            // throw new Error("Cannot draw: the draw pile is empty.");
        }
        const drawn = this.drawPile.splice(0, n);
        return drawn;
    }

    discard(card: CommandCard) {
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