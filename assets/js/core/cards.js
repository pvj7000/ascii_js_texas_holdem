import { randInt } from '../utils.js';

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♣', '♦', '♥', '♠'];
export const RANK_VALUES = Object.fromEntries(RANKS.map((rank, idx) => [rank, idx + 2]));

export class Card {
  constructor(rank, suit) {
    this.r = rank;
    this.s = suit;
    this.v = RANK_VALUES[rank];
  }

  toString(faceUp = true) {
    return faceUp ? `[${this.r}${this.s}]` : '[###]';
  }
}

export class Deck {
  constructor() {
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(rank, suit));
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    return this.cards.pop();
  }
}
