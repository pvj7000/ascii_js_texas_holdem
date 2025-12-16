import { clamp } from '../utils.js';
import { eval7 } from './evaluator.js';

// Quick-and-dirty preflop score based on common Hold'em heuristics: pocket pairs
// are boosted, suited/connectors get extra credit, and large gaps are penalised.
const preflopStrength = (hole) => {
  const [c1, c2] = [...hole].sort((a, b) => b.v - a.v);
  const pair = c1.v === c2.v;
  let strength = (c1.v + c2.v) / 28;
  if (pair) strength += 0.4 * (c1.v / 14);
  if (c1.s === c2.s) strength += 0.08;
  const gap = Math.abs(c1.v - c2.v);
  if (gap === 1) strength += 0.05;
  else if (gap >= 4) strength -= 0.04 * (gap - 3);
  if (c1.v >= 13 || c2.v >= 13) strength += 0.03;
  return clamp(strength, 0, 1);
};

// Postflop strength leans on the exact 7-card evaluator but also nudges for
// draws (four to a flush/straight) to mimic real players semi-bluffing equity.
const postflopStrength = (hole, board) => {
  if (board.length === 0) return preflopStrength(hole);
  const score = eval7(hole, board);
  const base = (score.cat - 1) / 8;
  const tail = (score.key.slice(1).reduce((acc, value) => acc + value, 0) / (14 * 5)) * 0.08;
  let draw = 0;
  const suitCounts = {};
  [...hole, ...board].forEach((card) => {
    suitCounts[card.s] = (suitCounts[card.s] || 0) + 1;
  });
  if (Object.values(suitCounts).some((count) => count === 4)) draw += 0.06;
  const uniq = [...new Set([...hole, ...board].map((card) => card.v))].sort((a, b) => a - b);
  for (let i = 0; i < uniq.length - 3; i++) {
    const slice = [uniq[i], uniq[i + 1], uniq[i + 2], uniq[i + 3]];
    if (slice[3] - slice[0] === 3 && new Set(slice).size === 4) {
      draw += 0.05;
      break;
    }
  }
  return clamp(base + tail + draw, 0, 1);
};

// Decide an AI move based on persona (rock/maniac/station/pro), hand strength,
// position, and pot odds. Each branch mirrors real Hold'em incentives: protect
// blinds, punish loose calls, and back off with weak holdings.
export const aiAction = (state, idx) => {
  const me = state.players[idx];
  if (me.folded || me.allIn || me.out) return { type: 'skip' };
  const toCall = Math.max(0, state.currentBet - me.roundBet);
  const pot = state.players.reduce((acc, p) => acc + p.totalBet, 0);
  const canBet = me.stack > 0 && !me.allIn && !me.folded;
  const street = state.street;
  const strength = street === 'preflop' ? preflopStrength(me.hand) : postflopStrength(me.hand, state.board);
  const persona = me.persona;
  let aggression;
  let looseness;
  let bluff;
  if (persona === 'rock') {
    aggression = 0.12;
    looseness = 0.18;
    bluff = 0.01;
  } else if (persona === 'maniac') {
    aggression = 0.9;
    looseness = 0.75;
    bluff = 0.25;
  } else if (persona === 'station') {
    aggression = 0.12;
    looseness = 0.7;
    bluff = 0;
  } else {
    aggression = 0.48;
    looseness = 0.38;
    bluff = 0.06;
  }
  const n = state.players.length;
  const d = state.dealer;
  const posScore = ((idx - d + n) % n) / (n - 1 || 1);
  aggression = clamp(aggression * (0.8 + 0.4 * posScore), 0, 1);
  const early = state.handCount <= 9;
  const preflopRaiseGate = (state.handNum + idx) % (persona === 'maniac' ? 2 : persona === 'pro' ? 3 : 4) === 0;
  if (!canBet) {
    if (toCall === 0) return { type: 'check' };
    const callOk =
      strength > 0.18 * (1 + posScore) ||
      (persona === 'station' && Math.random() < 0.9) ||
      (persona === 'maniac' && Math.random() < 0.8) ||
      strength > 0.5;
    return callOk ? { type: 'call' } : { type: 'fold' };
  }
  if (toCall > 0) {
    const potOdds = toCall / Math.max(1, pot + toCall);
    const wantCall =
      strength > potOdds * 0.9 ||
      (persona === 'station' && Math.random() < 0.92) ||
      strength > 0.45;
    let wantRaise = (strength > 0.62 && Math.random() < aggression) || Math.random() < bluff * 0.4;
    if (state.street === 'preflop' && !preflopRaiseGate) wantRaise = false;
    if (early) wantRaise = wantRaise && Math.random() < 0.5;
    if (!wantCall && !wantRaise) {
      if (persona === 'maniac' && Math.random() < 0.25) return { type: 'call' };
      return { type: 'fold' };
    }
    if (wantRaise) {
      let bump;
      if (early) bump = Math.round((20 + Math.random() * 130) / 10) * 10;
      else {
        const potSize = pot + toCall;
        bump = Math.round((potSize * (0.6 + Math.random() * 0.8)) / 10) * 10;
      }
      let raiseTo = Math.max(
        state.currentBet + Math.max(state.lastRaise, state.bigBlind),
        me.roundBet + toCall + bump,
      );
      if (!early && strength > 0.85 && Math.random() < 0.35) raiseTo = me.roundBet + me.stack;
      raiseTo = clamp(raiseTo, me.roundBet + toCall, me.roundBet + me.stack);
      return { type: 'raiseTo', amount: raiseTo };
    }
    return { type: 'call' };
  }
  let wantBet = (strength > 0.5 && Math.random() < aggression) || (Math.random() < bluff && Math.random() < 0.6);
  if (state.street === 'preflop' && !preflopRaiseGate) wantBet = false;
  if (!wantBet) return { type: 'check' };
  let base = early
    ? Math.round((20 + Math.random() * 130) / 10) * 10
    : Math.max(state.bigBlind, Math.round(((pot || state.bigBlind) * (0.6 + Math.random() * 0.6)) / 10) * 10);
  let raiseTo = Math.max(state.currentBet + Math.max(state.lastRaise, state.bigBlind), base);
  raiseTo = clamp(raiseTo, me.roundBet + 10, me.roundBet + me.stack);
  return { type: 'raiseTo', amount: raiseTo };
};
