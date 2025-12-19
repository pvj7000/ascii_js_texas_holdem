import { Deck } from './cards.js';
import { resetRoundBets, postBlinds } from './actions.js';
import { bettingRound } from './betting.js';
import { showdown } from './showdown.js';
import { nextIdx } from './table.js';

// Deal two private cards to every non-busted player, matching live Hold'em
// order (clockwise, one card at a time).
const dealPrivateCards = (state) => {
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (!player.out) player.hand.push(state.deck.deal());
    }
  }
};

// One complete hand flow: reset stacks, shuffle, deal, run betting rounds
// through river, then showdown. Returns `false` to stop the game loop when only
// one player remains.
export const playHand = async (state, deps) => {
  const { render, log, waitHumanAction } = deps;
  state.handNum += 1;
  state.handCount += 1;
  state.reveal = false;
  state.board = [];
  state.burn = [];
  resetRoundBets(state);
  state.players.forEach((player) => {
    const wasOut = player.out;
    if (player.stack === 0) {
      player.out = true;
      if (!wasOut && player.isAI) log(`${player.name} is out.`);
    }
    if (!player.out) player.resetForHand();
  });
  const contenders = state.players.filter((player) => !player.out);
  if (contenders.length <= 1) {
    render();
    const sole = contenders[0];
    if (sole?.name === 'You') log('Congratulations! You won the game.');
    else log(`Game over. Winner: ${sole?.name || 'Nobody'}.`);
    return false;
  }
  state.deck = new Deck();
  state.deck.shuffle();
  dealPrivateCards(state);
  postBlinds(state, log);
  state.street = 'preflop';
  render();
  const depsForRound = { render, waitHumanAction, log };
  const preStart = nextIdx(state, state.bbIdx ?? state.dealer);
  const br1 = await bettingRound(state, preStart, depsForRound);
  if (br1 === 'ended') {
    resetRoundBets(state);
    state.reveal = false;
    return true;
  }
  resetRoundBets(state);
  state.burn.push(state.deck.deal());
  state.board.push(state.deck.deal(), state.deck.deal(), state.deck.deal());
  state.street = 'flop';
  render();
  log(`=== FLOP: ${state.board.slice(0, 3).map((card) => card.toString(true)).join(' ')} ===`);
  const br2 = await bettingRound(state, nextIdx(state, state.dealer), depsForRound);
  if (br2 === 'ended') {
    resetRoundBets(state);
    state.reveal = false;
    return true;
  }
  resetRoundBets(state);
  state.burn.push(state.deck.deal());
  const turnCard = state.deck.deal();
  state.board.push(turnCard);
  state.street = 'turn';
  render();
  log(`=== TURN: ${turnCard.toString(true)}  | Board: ${state.board.map((card) => card.toString(true)).join(' ')} ===`);
  const br3 = await bettingRound(state, nextIdx(state, state.dealer), depsForRound);
  if (br3 === 'ended') {
    resetRoundBets(state);
    state.reveal = false;
    return true;
  }
  resetRoundBets(state);
  state.burn.push(state.deck.deal());
  const riverCard = state.deck.deal();
  state.board.push(riverCard);
  state.street = 'river';
  render();
  log(`=== RIVER: ${riverCard.toString(true)}  | Board: ${state.board.map((card) => card.toString(true)).join(' ')} ===`);
  const br4 = await bettingRound(state, nextIdx(state, state.dealer), depsForRound);
  if (br4 === 'ended') {
    resetRoundBets(state);
    state.reveal = false;
    return true;
  }
  resetRoundBets(state);
  state.street = 'showdown';
  state.reveal = true;
  render();
  log('=== SHOWDOWN ===');
  showdown(state, log);
  render();
  return true;
};

// Advance the dealer button to the next eligible seat (skipping busted players)
// to keep the blind order fair.
export const rotateDealer = (state) => {
  const n = state.players.length;
  let idx = (state.dealer + 1) % n;
  for (let steps = 0; steps < n; steps++) {
    if (!state.players[idx].out) {
      state.dealer = idx;
      return;
    }
    idx = (idx + 1) % n;
  }
};
