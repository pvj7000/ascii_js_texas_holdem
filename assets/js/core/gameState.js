export const createGameState = () => ({
  smallBlind: 10,
  bigBlind: 20,
  players: [],
  dealer: 0,
  board: [],
  burn: [],
  deck: null,
  street: 'preflop',
  current: 0,
  awaiting: null,
  reveal: false,
  handNum: 0,
  handCount: 0,
  currentBet: 0,
  lastRaise: 0,
  lastRaiser: null,
  sbIdx: null,
  bbIdx: null,
  pot() {
    return this.players.reduce((acc, player) => acc + player.totalBet, 0);
  },
});
