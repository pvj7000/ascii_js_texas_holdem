// Snapshot of everything the table needs to know for a single hand. State is
// mutated in-place and passed into the UI to render the ASCII board.
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
  // Total pot equals the sum of per-player commitments (no side-pot math here).
  pot() {
    return this.players.reduce((acc, player) => acc + player.totalBet, 0);
  },
});
