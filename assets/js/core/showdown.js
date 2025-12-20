import { money, simpleVerb, winVerb } from '../utils.js';
import { compareScore, eval7, formatScore } from './evaluator.js';

// Build a stack of main + side pots by looking at each unique contribution
// level. Classic Hold'em side-pot logic: each pot contains everyone who has put
// in at least that much.
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

// Award chips after the river. If no one is all-in we can simply pick the best
// hand and split; otherwise we evaluate everyone once and distribute each
// constructed side pot to the best eligible hand.
export const showdown = (state, log) => {
  state.reveal = true;
  const pots = buildPots(state);
  const hasSidePots = pots.length > 1;
  if (hasSidePots) {
    const allIns = state.players.filter((player) => player.allIn && !player.out);
    if (allIns.length === 1) {
      log(`Side pots created due to all-in by ${allIns[0].name}.`);
    } else if (allIns.length > 1) {
      const names = allIns.map((p) => p.name);
      const last = names[names.length - 1];
      const list = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${last}`;
      log(`Side pots created due to all-ins by ${list}.`);
    }
  }
  const showdownLine = state.players
    .filter((player) => !player.folded && !player.out)
    .map((player) => {
      const cards = player.hand.map((card) => card.toString(true).slice(1, -1)).join(' ');
      return `${player.name} [${cards}]`;
    });
  if (showdownLine.length > 0) log(`Showdown cards: ${showdownLine.join(', ')}`);
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
    const potName = 'MAIN POT';
    for (const player of bestPlayers) {
      player.stack += share;
      const splitNote = bestPlayers.length > 1 ? ` [${money(share)} each]` : '';
      log(`${player.name} ${winVerb(player.name)} ${potName} (${money(potAmount)})${splitNote} with ${formatScore(scores.get(player))}`);
      if (remainder > 0) {
        player.stack += 1;
        remainder--;
        log(`${potName}: ${player.name} ${simpleVerb(player.name, 'receive')} +$1 (rounding).`);
      }
    }
    state.players.forEach((player) => {
      player.totalBet = 0;
    });
    return;
  }
  const scores = new Map();
  for (const player of alive) scores.set(player, eval7(player.hand, state.board));
  pots.forEach((pot, idx) => {
    if (pot.winners.length === 0) return;
  
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
    const potName = idx === 0 ? 'MAIN POT' : `SIDE POT #${idx}`;

    for (const player of bestPlayers) {
      player.stack += share;
      const splitNote = bestPlayers.length > 1 ? ` [${money(share)} each]` : '';
      log(`${player.name} ${winVerb(player.name)} ${potName} (${money(pot.amount)})${splitNote} with ${formatScore(scores.get(player))}`);
      if (remainder > 0) {
        player.stack += 1;
        remainder--;
        log(`${potName}: ${player.name} ${simpleVerb(player.name, 'receive')} +$1 (rounding).`);
      }
    }
  });

  state.players.forEach((player) => {
    player.totalBet = 0;
  });
};
