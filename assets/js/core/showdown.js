import { money } from '../utils.js';
import { compareScore, eval7 } from './evaluator.js';

const buildPots = (state) => {
  const eligible = state.players.filter((player) => !player.out);
  const levels = [...new Set(eligible.map((player) => player.totalBet))]
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = eligible.filter((player) => player.totalBet >= level);
    const amount = (level - previous) * contributors.length;
    const winners = contributors.filter((player) => !player.folded);
    if (amount > 0) pots.push({ amount, winners });
    previous = level;
  }
  return pots;
};

export const showdown = (state, log) => {
  state.reveal = true;
  const alive = state.players.filter((player) => !player.folded && !player.out);
  const potAmount = state.players.reduce((acc, player) => acc + player.totalBet, 0);
  const anyAllIn = state.players.some((player) => player.allIn);
  if (!anyAllIn) {
    let bestScore = null;
    let bestPlayers = [];
    const scores = new Map();
    for (const player of alive) {
      const score = eval7(player.hand, state.board);
      scores.set(player, score);
      if (!bestScore || compareScore(score, bestScore) > 0) {
        bestScore = score;
        bestPlayers = [player];
      } else if (compareScore(score, bestScore) === 0) {
        bestPlayers.push(player);
      }
    }
    const share = Math.floor(potAmount / bestPlayers.length || 1);
    let remainder = potAmount - share * bestPlayers.length;
    for (const player of bestPlayers) {
      player.stack += share;
      log(`${player.name} wins ${money(share)} with ${scores.get(player).name}.`);
      if (remainder > 0) {
        player.stack += 1;
        remainder--;
        log(`${player.name} receives +$1 (rounding).`);
      }
    }
    state.players.forEach((player) => {
      player.totalBet = 0;
    });
    return;
  }
  const scores = new Map();
  for (const player of alive) scores.set(player, eval7(player.hand, state.board));
  const pots = buildPots(state);
  for (const pot of pots) {
    if (pot.winners.length === 0) continue;
    let bestScore = null;
    let bestPlayers = [];
    for (const player of pot.winners) {
      const score = scores.get(player) || eval7(player.hand, state.board);
      if (!bestScore || compareScore(score, bestScore) > 0) {
        bestScore = score;
        bestPlayers = [player];
      } else if (compareScore(score, bestScore) === 0) {
        bestPlayers.push(player);
      }
    }
    const share = Math.floor(pot.amount / bestPlayers.length || 1);
    let remainder = pot.amount - share * bestPlayers.length;
    for (const player of bestPlayers) {
      player.stack += share;
      log(`${player.name} wins ${money(share)} from a side pot with ${scores.get(player).name}.`);
      if (remainder > 0) {
        player.stack += 1;
        remainder--;
        log(`${player.name} receives +$1 (rounding).`);
      }
    }
  }
  state.players.forEach((player) => {
    player.totalBet = 0;
  });
};
