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

  resetForHand() {
    this.hand = [];
    this.folded = false;
    this.allIn = false;
    this.roundBet = 0;
    this.totalBet = 0;
  }
}
