import { randInt } from '../utils.js';

// Card metadata used across evaluation + rendering. Ranks map to numerical
// values to simplify strength comparisons.
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♣', '♦', '♥', '♠'];
export const RANK_VALUES = Object.fromEntries(RANKS.map((rank, idx) => [rank, idx + 2]));

// Immutable representation of a single card; `v` keeps a numeric value for
// evaluator shortcuts while `toString` keeps the ASCII-friendly look.
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

  // Restore a fresh 52-card deck.
  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(rank, suit));
      }
    }
  }

  // Fisher–Yates shuffle powered by `randInt`, which uses Web Crypto. Keeps the
  // distribution uniform across all 52! possible permutations.
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  // Dealing always pulls from the end of the array, matching the shuffle
  // assumption and keeping the code branchless.
  deal() {
    return this.cards.pop();
  }
}
