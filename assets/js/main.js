import { createGameState } from './core/gameState.js';
import { Player } from './core/player.js';
import { playHand, rotateDealer } from './core/gameFlow.js';
import { createUI } from './ui/ui.js';

// Initialise a fixed table: four AI personas plus the human in seat 5. Stacks
// and blinds stay constant to keep the simulator focused on decision quality.
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

const resetGameState = () => {
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
  state.currentBet = 0;
  state.lastRaise = 0;
  state.lastRaiser = null;
  state.street = 'preflop';
  state.current = 0;
  state.awaiting = null;
  state.sbIdx = null;
  state.bbIdx = null;
};

// Endless loop of hands until the human busts. The UI exposes promises for user
// actions so the async flow reads like procedural poker logic.
(async function run() {
  while (true) {
    const keepGoing = await playHand(state, {
      render: ui.render,
      log: ui.log,
      waitHumanAction: ui.waitHumanAction,
    });
    if (keepGoing === false) {
      const survivors = state.players.filter((player) => !player.out);
      const humanWon = survivors.length === 1 && survivors[0] === state.players[4];
      if (humanWon) {
        ui.setNextHandLabel('New Game');
        ui.setNextHandEnabled(true);
        await ui.waitForNextHand();
        ui.setNextHandLabel('Next Hand');
        resetGameState();
        ui.render();
        continue;
      }
      break;
    }
    const you = state.players[4];
    if (you.out || you.stack <= 0) {
      ui.showRestart(true);
      ui.setNextHandEnabled(false);
      ui.log('You are out. Click Restart to play again.');
      await ui.waitForRestart();
      resetGameState();
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
