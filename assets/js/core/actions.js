import { money } from '../utils.js';
import { isAlive, nextAliveFrom } from './table.js';

export const resetRoundBets = (state) => {
  state.players.forEach((player) => {
    player.roundBet = 0;
  });
  state.currentBet = 0;
  state.lastRaise = 0;
  state.lastRaiser = null;
};

export const postBlinds = (state, log) => {
  const dealer = state.dealer;
  const sbIndex = nextAliveFrom(state, dealer);
  const bbIndex = nextAliveFrom(state, sbIndex);
  state.sbIdx = sbIndex;
  state.bbIdx = bbIndex;
  const sbPlayer = state.players[sbIndex];
  const bbPlayer = state.players[bbIndex];
  if (!isAlive(sbPlayer) || !isAlive(bbPlayer) || sbIndex === bbIndex) return;
  const sbAmount = Math.min(state.smallBlind, Math.max(0, sbPlayer.stack));
  if (sbAmount > 0) {
    sbPlayer.stack -= sbAmount;
    sbPlayer.roundBet += sbAmount;
    sbPlayer.totalBet += sbAmount;
    if (sbPlayer.stack === 0) sbPlayer.allIn = true;
  }
  const bbAmount = Math.min(state.bigBlind, Math.max(0, bbPlayer.stack));
  if (bbAmount > 0) {
    bbPlayer.stack -= bbAmount;
    bbPlayer.roundBet += bbAmount;
    bbPlayer.totalBet += bbAmount;
    if (bbPlayer.stack === 0) bbPlayer.allIn = true;
  }
  state.currentBet = Math.max(sbPlayer.roundBet, bbPlayer.roundBet);
  state.lastRaise = state.bigBlind;
  state.lastRaiser = bbIndex;
  log(`Blinds posted: ${sbPlayer.name} SB ${money(sbAmount)}, ${bbPlayer.name} BB ${money(bbAmount)}`);
};

export const actFold = (state, idx, log) => {
  const player = state.players[idx];
  player.folded = true;
  log(`${player.name} folds.`);
};

export const actCheck = (state, idx, log) => {
  const player = state.players[idx];
  log(`${player.name} checks.`);
};

export const actCall = (state, idx, log) => {
  const player = state.players[idx];
  const toCall = Math.max(0, state.currentBet - player.roundBet);
  const pay = Math.min(toCall, player.stack);
  player.stack -= pay;
  player.roundBet += pay;
  player.totalBet += pay;
  if (player.stack === 0) player.allIn = true;
  log(`${player.name} ${toCall === 0 ? 'checks' : 'calls ' + money(pay)}.`);
};

export const actRaiseTo = (state, idx, raiseTo, log) => {
  const player = state.players[idx];
  raiseTo = Math.max(raiseTo, player.roundBet + 1);
  const need = raiseTo - player.roundBet;
  const pay = Math.min(need, player.stack);
  const prevBet = player.roundBet;
  player.stack -= pay;
  player.roundBet += pay;
  player.totalBet += pay;
  const isRaise = player.roundBet > state.currentBet;
  if (isRaise) {
    state.lastRaise = player.roundBet - state.currentBet;
    state.currentBet = player.roundBet;
    state.lastRaiser = idx;
    const verb = state.street === 'preflop' && player.roundBet <= state.bigBlind ? 'bets' : 'raises';
    log(`${player.name} ${verb} to ${money(player.roundBet)}.`);
  } else {
    const paid = player.roundBet - prevBet;
    log(`${player.name} calls ${money(paid)} (all-in short).`);
  }
  if (player.stack === 0) {
    player.allIn = true;
    log(`${player.name} is all-in (${money(player.roundBet)} in this street).`);
  }
};
