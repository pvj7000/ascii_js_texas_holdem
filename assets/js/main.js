import { createGameState } from './core/gameState.js';
import { Player } from './core/player.js';
import { playHand, rotateDealer } from './core/gameFlow.js';
import { createUI } from './ui/ui.js';

const state = createGameState();
state.players = [
  new Player('Player 1 (Rock)', true, 'rock'),
  new Player('Player 2 (Maniac)', true, 'maniac'),
  new Player('Player 3 (Station)', true, 'station'),
  new Player('Player 4 (Pro)', true, 'pro'),
  new Player('You', false, 'human'),
];

const ui = createUI(state);
ui.render();
ui.log('Welcome! You vs 4 computers. Starting stacks: $1000. Blinds: $10/$20.');

(async function run() {
  while (true) {
    const keepGoing = await playHand(state, {
      render: ui.render,
      log: ui.log,
      waitHumanAction: ui.waitHumanAction,
    });
    if (keepGoing === false) break;
    const you = state.players[4];
    if (you.out || you.stack <= 0) {
      ui.showRestart(true);
      ui.setNextHandEnabled(false);
      ui.log('You are out. Click Restart to play again.');
      await ui.waitForRestart();
      state.players.forEach((player) => {
        player.stack = 1000;
        player.out = false;
        player.folded = false;
        player.allIn = false;
        player.hand = [];
        player.totalBet = 0;
        player.roundBet = 0;
      });
      state.board = [];
      state.burn = [];
      state.reveal = false;
      state.dealer = 0;
      state.handCount = 0;
      state.handNum = 0;
      ui.showRestart(false);
      ui.render();
      continue;
    }
    await ui.waitForNextHand();
    rotateDealer(state);
    ui.render();
  }
  ui.render();
})();
