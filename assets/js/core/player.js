// Represents a seat at the table. Persona controls AI behaviour; humans share
// the same interface but skip the AI logic path.
export class Player {
  constructor(name, isAI, persona) {
    this.name = name;
    this.isAI = isAI;
    this.persona = persona;
    this.stack = 1000;
    this.hand = [];
    this.folded = false;
    this.allIn = false;
    this.roundBet = 0;
    this.totalBet = 0;
    this.out = false;
  }

  // Prepare the player for a new hand (Texas Hold'em resets private cards and
  // street-level bets, but keeps stack + bust state).
  resetForHand() {
    this.hand = [];
    this.folded = false;
    this.allIn = false;
    this.roundBet = 0;
    this.totalBet = 0;
  }
}
