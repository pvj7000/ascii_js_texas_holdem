import { money, sleep, winVerb } from '../utils.js';
import { aiAction } from './ai.js';
import { actCall, actCheck, actFold, actRaiseTo } from './actions.js';
import { isActive, nextIdx, onlyContender } from './table.js';

// Build the acting order for a betting street starting from `startIdx`. We use
// a queue so raises can restart action for everyone who has not yet matched the
// new price.
const buildQueue = (state, startIdx, skipIdx = null) => {
  const queue = [];
  const n = state.players.length;
  let idx = startIdx % n;
  const visited = new Set();
  while (!visited.has(idx)) {
    visited.add(idx);
    if (idx !== skipIdx && isActive(state.players[idx])) queue.push(idx);
    idx = (idx + 1) % n;
  }
  return queue;
};

// If everyone folds, award the pot immediately to the last aggressor/remaining
// player—no showdown needed.
const settleUncontested = (state, player, log) => {
  const pot = state.players.reduce((acc, p) => acc + p.totalBet, 0);
  player.stack += pot;
  state.players.forEach((p) => {
    p.totalBet = 0;
  });
  state.currentBet = 0;
  state.lastRaise = 0;
  state.lastRaiser = null;
  state.current = null;
  state.awaiting = null;
  log(`${player.name} ${winVerb(player.name)} uncontested pot ${money(pot)}.`);
};

// Core betting loop for each street. The loop exits early if action ends
// uncontested or if we hit an emergency guard (sanity check for logic errors).
export const bettingRound = async (state, startIndex, { render, waitHumanAction, log }) => {
  let queue = buildQueue(state, startIndex);
  let guard = 500;
  while (queue.length > 0 && guard-- > 0) {
    const lone = onlyContender(state);
    if (lone) {
      settleUncontested(state, lone, log);
      render();
      return 'ended';
    }
    const idx = queue.shift();
    if (!isActive(state.players[idx])) continue;
    state.current = idx;
    render();
    const player = state.players[idx];
    const prevCurrentBet = state.currentBet;
    let action;
    if (player.isAI) {
      action = aiAction(state, idx);
      if (action.type === 'fold') actFold(state, idx, log);
      else if (action.type === 'check') actCheck(state, idx, log);
      else if (action.type === 'call') actCall(state, idx, log);
      else if (action.type === 'raiseTo') actRaiseTo(state, idx, action.amount, log);
      await sleep(180);
    } else {
      state.awaiting = 'human';
      render();
      action = await waitHumanAction();
      state.awaiting = null;
      if (action.type === 'fold') actFold(state, idx, log);
      else if (action.type === 'check') actCheck(state, idx, log);
      else if (action.type === 'call') actCall(state, idx, log);
      else if (action.type === 'raiseTo') actRaiseTo(state, idx, action.amount, log);
    }
    const afterRaise = state.currentBet > prevCurrentBet;
    const nowLone = onlyContender(state);
    if (nowLone) {
      settleUncontested(state, nowLone, log);
      render();
      return 'ended';
    }
    if (afterRaise) {
      const next = nextIdx(state, idx);
      queue = buildQueue(state, next, idx);
    }
  }
  state.current = null;
  state.awaiting = null;
  return 'ok';
};
