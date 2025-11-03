// DOM bits
const qs = (sel) => document.querySelector(sel);
const screen = qs('#screen');
const logEl = qs('#log');
const foldBtn = qs('#foldBtn');
const ccBtn = qs('#checkCallBtn');
const raiseBtn = qs('#raiseBtn');
const amtInput = qs('#raiseAmount');
const nextHandBtn = qs('#nextHandBtn');
const restartBtn = qs('#restartBtn');
const info = qs('#info');

const log = (s) => {
  logEl.value = `${s}\n${logEl.value}`;
  logEl.scrollTop = 0;
};
const money = (n) => `$${n}`;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const randInt = (n) => {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return Number(u[0] % n);
};

// Cards
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RV = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
const SUITS = ['♣', '♦', '♥', '♠'];

class Card {
  constructor(rank, suit) {
    this.r = rank;
    this.s = suit;
    this.v = RV[rank];
  }

  toString(face = true) {
    return face ? `[${this.r}${this.s}]` : '[###]';
  }
}

class Deck {
  constructor() {
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const s of SUITS) for (const r of RANKS) this.cards.push(new Card(r, s));
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    return this.cards.pop();
  }
}

// Players
class Player {
  constructor(name, isAI, persona) {
    this.name = name;
    this.isAI = isAI;
    this.persona = persona;
    this.stack = 1000;
    this.hand = [];
    this.folded = false;
    this.allIn = false;
    this.roundBet = 0;
    this.totalBet = 0;
    this.out = false;
  }

  resetForHand() {
    this.hand = [];
    this.folded = false;
    this.allIn = false;
    this.roundBet = 0;
    this.totalBet = 0;
  }
}

// Game state
const GAME = {
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
    return GAME.players.reduce((acc, p) => acc + p.totalBet, 0);
  },
};

// Rendering
const render = () => {
  const P = GAME.players;
  const n = P.length;
  const d = GAME.dealer;
  const sb = (d + 1) % n;
  const bb = (d + 2) % n;
  const role = (i) => (i === d ? 'D' : i === sb ? 'SB' : i === bb ? 'BB' : ' ');
  const you = P[4];
  const toCall = Math.max(0, GAME.currentBet - you.roundBet);
  const status = (p) => (p.out ? 'OUT' : p.folded ? 'FOLDED' : p.allIn ? 'ALL-IN' : 'IN');
  const cardFace = (p) =>
    p.folded
      ? '[—] [—]'
      : p.isAI && !GAME.reveal
      ? '[###] [###]'
      : `${p.hand[0]?.toString(true)} ${p.hand[1]?.toString(true)}`;
  const arrow = (i) =>
    GAME.current === i && !P[i].out && !P[i].folded && !P[i].allIn ? '->' : '  ';

  const hudTop = '+================================================================================+';
  const hudMid = `| POT ${money(GAME.pot()).padEnd(8)} | YOUR STACK ${money(you.stack).padEnd(8)} | TO CALL ${money(
    toCall,
  ).padEnd(8)} | HAND #${(GAME.handCount || 0).toString().padEnd(3)} |`;
  const hudBtm = '+================================================================================+';

  const comm = GAME.board.filter(Boolean).map((c) => c.toString(true)).join(' ');
  const cTitle = `COMMUNITY (${GAME.street.toUpperCase()})`;
  const cTop = `+----------------------------------- ${cTitle} -----------------------------------+`;
  const inner = comm || '(none yet)';
  const cMid = `| ${inner}${' '.repeat(Math.max(0, 82 - inner.length))}|`;
  const cBtm = '+---------------------------------------------------------------------------------+';

  const CELLW = 40;
  const sep = '  ';
  const ROWW = CELLW * 2 + sep.length;
  const bodyLines = [];
  const cell = (i) => {
    const p = P[i];
    const r = role(i);
    const l1 = `${arrow(i)} ${p.name}${p.isAI ? '' : ' (You)'} ${r !== ' ' ? '(' + r + ')' : ''}`.trim();
    const l2 = `stk:${money(p.stack)}  in:${money(p.totalBet)}  rnd:${money(p.roundBet)}  ${cardFace(p)}`;
    return {
      line1: (l1 + '  ' + status(p)).slice(0, CELLW).padEnd(CELLW, ' '),
      line2: l2.slice(0, CELLW).padEnd(CELLW, ' '),
    };
  };
  const A = [cell(0), cell(1)];
  const B = [cell(2), cell(3)];
  const H = cell(4);
  bodyLines.push(A.map((c) => c.line1).join(sep));
  bodyLines.push(A.map((c) => c.line2).join(sep));
  bodyLines.push('');
  bodyLines.push(B.map((c) => c.line1).join(sep));
  bodyLines.push(B.map((c) => c.line2).join(sep));
  bodyLines.push('');
  const pad = Math.max(0, Math.floor((ROWW - CELLW) / 2));
  bodyLines.push(' '.repeat(pad) + H.line1);
  bodyLines.push(' '.repeat(pad) + H.line2);

  const contribLine =
    'Contributed this hand: ' + P.map((p) => `${p.name.split(' ')[0]}=${money(p.totalBet)}`).join('  ');
  const state = `Street: ${GAME.street.toUpperCase()}   Current Bet: ${money(GAME.currentBet)}   Last Raise: ${money(
    GAME.lastRaise,
  )}   Hand #${GAME.handNum}`;
  const legend =
    'Legend: D/SB/BB = Dealer/Small Blind/Big Blind · IN/FOLDED/ALL-IN/OUT · rnd = this street';

  screen.textContent = [
    hudTop,
    hudMid,
    hudBtm,
    cTop,
    cMid,
    cBtm,
    ...bodyLines,
    '',
    contribLine,
    state,
    legend,
  ].join('\n');
  updateControls();
};

const updateControls = () => {
  const you = GAME.players[4];
  const toCall = Math.max(0, GAME.currentBet - you.roundBet);
  const active = GAME.awaiting === 'human' && !you.folded && !you.allIn && !you.out;
  foldBtn.disabled = !active;
  ccBtn.disabled = !active;
  raiseBtn.disabled = !active;
  amtInput.disabled = !active;
  ccBtn.textContent = toCall > 0 ? `Call ${money(Math.min(toCall, you.stack))}` : 'Check';
  const minTo = GAME.currentBet === 0 ? GAME.bigBlind : GAME.currentBet + Math.max(GAME.lastRaise, GAME.bigBlind);
  const maxTo = you.roundBet + you.stack;
  amtInput.min = Math.max(minTo, you.roundBet + 1);
  amtInput.max = Math.max(minTo, maxTo);
  amtInput.step = 10;
  if (+amtInput.value < amtInput.min) amtInput.value = amtInput.min;
  info.textContent = active
    ? `To call: ${money(toCall)} · Min raise-to: ${money(+amtInput.min)} · You: ${money(you.stack)}`
    : 'Waiting for players...';
};

// Evaluator helpers
const scoreName = (cat, hi) => {
  if (cat === 9 && hi === 14) return 'Royal Flush';
  return (
    {
      9: 'Straight Flush',
      8: 'Four of a Kind',
      7: 'Full House',
      6: 'Flush',
      5: 'Straight',
      4: 'Three of a Kind',
      3: 'Two Pair',
      2: 'One Pair',
      1: 'High Card',
    }[cat] + (hi ? ` (${valName(hi)} high)` : '')
  );
};
const valName = (v) => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }[v] || String(v));
const compareScore = (a, b) => {
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const aa = a.key[i] || 0;
    const bb = b.key[i] || 0;
    if (aa !== bb) return aa > bb ? 1 : -1;
  }
  return 0;
};

const eval5 = (cards) => {
  const clean = cards.filter((c) => c && typeof c.v === 'number' && c.s);
  if (clean.length !== 5) throw new Error('eval5 expects 5 cards');
  const byRank = new Map();
  const bySuit = new Map();
  for (const c of clean) {
    byRank.set(c.v, (byRank.get(c.v) || 0) + 1);
    bySuit.set(c.s, (bySuit.get(c.s) || 0) + 1);
  }
  const ranks = [...byRank.keys()].sort((a, b) => b - a);
  const uniq = [...new Set(clean.map((c) => c.v))].sort((a, b) => b - a);
  let straightHigh = 0;
  for (let i = 0; i <= uniq.length - 5; i++) {
    let run = true;
    for (let k = 0; k < 4; k++) if (uniq[i + k] - 1 !== uniq[i + k + 1]) run = false;
    if (run) {
      straightHigh = uniq[i];
      break;
    }
  }
  if (!straightHigh && uniq.includes(14) && uniq.includes(5) && uniq.includes(4) && uniq.includes(3) && uniq.includes(2))
    straightHigh = 5;
  let flushSuit = null;
  for (const [s, c] of bySuit) if (c >= 5) flushSuit = s;
  if (flushSuit) {
    const suited = clean.filter((c) => c.s === flushSuit).map((c) => c.v).sort((a, b) => b - a);
    const uniqS = [...new Set(suited)];
    let sfHi = 0;
    for (let i = 0; i <= uniqS.length - 5; i++) {
      let ok = true;
      for (let k = 0; k < 4; k++) if (uniqS[i + k] - 1 !== uniqS[i + k + 1]) ok = false;
      if (ok) {
        sfHi = uniqS[i];
        break;
      }
    }
    if (!sfHi && uniqS.includes(14) && uniqS.includes(5) && uniqS.includes(4) && uniqS.includes(3) && uniqS.includes(2)) sfHi = 5;
    if (sfHi) return { cat: 9, key: [9, sfHi], name: scoreName(9, sfHi) };
  }
  const groups = [...byRank.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a)[0];
    return { cat: 8, key: [8, quad, kicker], name: scoreName(8, quad) };
  }
  if (groups[0][1] === 3 && (groups[1]?.[1] || 0) >= 2) {
    const trips = groups[0][0];
    const pair = groups[1][1] === 2 ? groups[1][0] : groups[2][0];
    return { cat: 7, key: [7, trips, pair], name: scoreName(7, trips) };
  }
  if (flushSuit) {
    const top5 = clean.filter((c) => c.s === flushSuit).map((c) => c.v).sort((a, b) => b - a).slice(0, 5);
    return { cat: 6, key: [6, ...top5], name: scoreName(6, top5[0]) };
  }
  if (straightHigh) return { cat: 5, key: [5, straightHigh], name: scoreName(5, straightHigh) };
  if (groups[0][1] === 3) {
    const trips = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a).slice(0, 2);
    return { cat: 4, key: [4, trips, ...kickers], name: scoreName(4, trips) };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const [hp, lp] = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = groups.slice(2).map((g) => g[0]).sort((a, b) => b - a)[0];
    return { cat: 3, key: [3, hp, lp, kicker], name: scoreName(3, hp) };
  }
  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a).slice(0, 3);
    return { cat: 2, key: [2, pair, ...kickers], name: scoreName(2, pair) };
  }
  const highs = ranks.slice().sort((a, b) => b - a).slice(0, 5);
  return { cat: 1, key: [1, ...highs], name: 'High Card (' + valName(highs[0]) + ' high)' };
};

const eval7 = (hole, board) => {
  const arr = hole.concat(board).filter(Boolean);
  const n = arr.length;
  if (n < 5) throw new Error('eval7 needs at least 5 cards');
  if (n === 5) return eval5(arr);
  let best = null;
  if (n === 6) {
    for (let i = 0; i < 6; i++) {
      const sub = arr.slice(0, i).concat(arr.slice(i + 1));
      const sc = eval5(sub);
      if (!best || compareScore(sc, best) > 0) best = sc;
    }
    return best;
  }
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      const sub = arr.filter((_, k) => k !== i && k !== j).slice(0, 5);
      const sc = eval5(sub);
      if (!best || compareScore(sc, best) > 0) best = sc;
    }
  }
  return best;
};

// AI logic
const preflopStrength = (hole) => {
  const [c1, c2] = [...hole].sort((a, b) => b.v - a.v);
  const pair = c1.v === c2.v;
  let s = (c1.v + c2.v) / 28;
  if (pair) s += 0.4 * (c1.v / 14);
  if (c1.s === c2.s) s += 0.08;
  const gap = Math.abs(c1.v - c2.v);
  if (gap === 1) s += 0.05;
  else if (gap >= 4) s -= 0.04 * (gap - 3);
  if (c1.v >= 13 || c2.v >= 13) s += 0.03;
  return clamp(s, 0, 1);
};

const postflopStrength = (hole, board) => {
  if (board.length === 0) return preflopStrength(hole);
  const sc = eval7(hole, board);
  const base = (sc.cat - 1) / 8;
  const tail = (sc.key.slice(1).reduce((a, v) => a + v, 0) / (14 * 5)) * 0.08;
  let draw = 0;
  const suitCounts = {};
  [...hole, ...board].forEach((c) => {
    suitCounts[c.s] = (suitCounts[c.s] || 0) + 1;
  });
  if (Object.values(suitCounts).some((c) => c === 4)) draw += 0.06;
  const uniq = [...new Set([...hole, ...board].map((c) => c.v))].sort((a, b) => a - b);
  for (let i = 0; i < uniq.length - 3; i++) {
    const seq = [uniq[i], uniq[i + 1], uniq[i + 2], uniq[i + 3]];
    if (seq[3] - seq[0] === 3 && new Set(seq).size === 4) {
      draw += 0.05;
      break;
    }
  }
  return clamp(base + tail + draw, 0, 1);
};

const aiAction = (idx) => {
  const gs = GAME;
  const me = gs.players[idx];
  if (me.folded || me.allIn || me.out) return { type: 'skip' };
  const toCall = Math.max(0, gs.currentBet - me.roundBet);
  const pot = gs.pot();
  const canBet = me.stack > 0 && !me.allIn && !me.folded;
  const stage = gs.street;
  const str = stage === 'preflop' ? preflopStrength(me.hand) : postflopStrength(me.hand, gs.board);
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
  const n = gs.players.length;
  const d = gs.dealer;
  const posScore = ((idx - d + n) % n) / (n - 1);
  aggression = clamp(aggression * (0.8 + 0.4 * posScore), 0, 1);
  const early = gs.handCount <= 9;
  const preflopRaiseGate = (gs.handNum + idx) % (persona === 'maniac' ? 2 : persona === 'pro' ? 3 : 4) === 0;
  if (!canBet) {
    if (toCall === 0) return { type: 'check' };
    const callOk =
      str > 0.18 * (1 + posScore) ||
      (persona === 'station' && Math.random() < 0.9) ||
      (persona === 'maniac' && Math.random() < 0.8) ||
      str > 0.5;
    return callOk ? { type: 'call' } : { type: 'fold' };
  }
  if (toCall > 0) {
    const potOdds = toCall / Math.max(1, pot + toCall);
    const wantCall =
      str > potOdds * 0.9 ||
      (persona === 'station' && Math.random() < 0.92) ||
      str > 0.45;
    let wantRaise = (str > 0.62 && Math.random() < aggression) || Math.random() < bluff * 0.4;
    if (gs.street === 'preflop' && !preflopRaiseGate) wantRaise = false;
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
      let raiseTo = Math.max(gs.currentBet + Math.max(gs.lastRaise, gs.bigBlind), me.roundBet + toCall + bump);
      if (!early && str > 0.85 && Math.random() < 0.35) raiseTo = me.roundBet + me.stack;
      raiseTo = clamp(raiseTo, me.roundBet + toCall, me.roundBet + me.stack);
      return { type: 'raiseTo', amount: raiseTo };
    }
    return { type: 'call' };
  }
  let wantBet = (str > 0.5 && Math.random() < aggression) || (Math.random() < bluff && Math.random() < 0.6);
  if (gs.street === 'preflop' && !preflopRaiseGate) wantBet = false;
  if (!wantBet) return { type: 'check' };
  let base = early
    ? Math.round((20 + Math.random() * 130) / 10) * 10
    : Math.max(gs.bigBlind, Math.round(((pot || gs.bigBlind) * (0.6 + Math.random() * 0.6)) / 10) * 10);
  let raiseTo = Math.max(gs.currentBet + Math.max(gs.lastRaise, gs.bigBlind), base);
  raiseTo = clamp(raiseTo, me.roundBet + 10, me.roundBet + me.stack);
  return { type: 'raiseTo', amount: raiseTo };
};

// Turn order
const plAlive = (pl) => !pl.out;
const plActive = (pl) => !pl.folded && !pl.allIn && !pl.out;
const nextIdx = (i) => {
  const n = GAME.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (i + k) % n;
    if (plAlive(GAME.players[j])) return j;
  }
  return i;
};
const nextAliveFrom = (start) => {
  const n = GAME.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (start + k) % n;
    if (plAlive(GAME.players[j])) return j;
  }
  return start;
};
const resetRoundBets = () => {
  for (const p of GAME.players) p.roundBet = 0;
  GAME.currentBet = 0;
  GAME.lastRaise = 0;
  GAME.lastRaiser = null;
};

const postBlinds = () => {
  const d = GAME.dealer;
  const sb = nextAliveFrom(d);
  const bb = nextAliveFrom(sb);
  GAME.sbIdx = sb;
  GAME.bbIdx = bb;
  const PSB = GAME.players[sb];
  const PBB = GAME.players[bb];
  if (!plAlive(PSB) || !plAlive(PBB) || sb === bb) return;
  const sbAmt = Math.min(GAME.smallBlind, Math.max(0, PSB.stack));
  if (sbAmt > 0) {
    PSB.stack -= sbAmt;
    PSB.roundBet += sbAmt;
    PSB.totalBet += sbAmt;
    if (PSB.stack === 0) PSB.allIn = true;
  }
  const bbAmt = Math.min(GAME.bigBlind, Math.max(0, PBB.stack));
  if (bbAmt > 0) {
    PBB.stack -= bbAmt;
    PBB.roundBet += bbAmt;
    PBB.totalBet += bbAmt;
    if (PBB.stack === 0) PBB.allIn = true;
  }
  GAME.currentBet = Math.max(PSB.roundBet, PBB.roundBet);
  GAME.lastRaise = GAME.bigBlind;
  GAME.lastRaiser = bb;
  log(`Blinds posted: ${GAME.players[sb].name} SB ${money(sbAmt)}, ${GAME.players[bb].name} BB ${money(bbAmt)}`);
};

const actFold = (i) => {
  const p = GAME.players[i];
  p.folded = true;
  log(`${p.name} folds.`);
};
const actCheck = (i) => {
  const p = GAME.players[i];
  log(`${p.name} checks.`);
};
const actCall = (i) => {
  const p = GAME.players[i];
  const toCall = Math.max(0, GAME.currentBet - p.roundBet);
  const pay = Math.min(toCall, p.stack);
  p.stack -= pay;
  p.roundBet += pay;
  p.totalBet += pay;
  if (p.stack === 0) p.allIn = true;
  log(`${p.name} ${toCall === 0 ? 'checks' : 'calls ' + money(pay)}.`);
};
const actRaiseTo = (i, raiseTo) => {
  const p = GAME.players[i];
  raiseTo = Math.max(raiseTo, p.roundBet + 1);
  const need = raiseTo - p.roundBet;
  const pay = Math.min(need, p.stack);
  p.stack -= pay;
  p.roundBet += pay;
  p.totalBet += pay;
  const isRaise = p.roundBet > GAME.currentBet;
  if (isRaise) {
    GAME.lastRaise = p.roundBet - GAME.currentBet;
    GAME.currentBet = p.roundBet;
    GAME.lastRaiser = i;
    log(`${p.name} ${GAME.street === 'preflop' && p.roundBet <= GAME.bigBlind ? 'bets' : 'raises'} to ${money(p.roundBet)}.`);
  } else {
    log(`${p.name} calls ${money(pay)} (all-in short).`);
  }
  if (p.stack === 0) {
    p.allIn = true;
    log(`${p.name} is all-in (${money(p.roundBet)} in this street).`);
  }
};
const everyoneFoldedExceptOne = () => {
  const alive = GAME.players.filter((p) => !p.folded && !p.out);
  return alive.length === 1 ? alive[0] : null;
};
const hashRound = () =>
  GAME.players
    .map((p) => `${p.folded ? 'F' : 'A'}:${p.roundBet}:${p.totalBet}`)
    .join('|') + `|cb:${GAME.currentBet}`;
const allMatched = () => {
  for (const p of GAME.players) if (plActive(p) && p.roundBet !== GAME.currentBet) return false;
  return true;
};
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const bettingRound = async (startIndex) => {
  let i = startIndex;
  let lastAggressor = GAME.currentBet > 0 && GAME.lastRaiser !== null ? GAME.lastRaiser : null;
  let guard = 1000;
  let cycleStartIndex = startIndex;
  let lastBetSnapshot = GAME.currentBet;
  let lastRoundHash = hashRound();
  let passes = 0;
  while (guard-- > 0) {
    render();
    const lone = everyoneFoldedExceptOne();
    if (lone) {
      const pot = GAME.pot();
      lone.stack += pot;
      for (const p of GAME.players) p.totalBet = 0;
      log(`${lone.name} wins uncontested pot ${money(pot)}.`);
      return 'ended';
    }
    GAME.current = i;
    const p = GAME.players[i];
    if (!plActive(p)) {
      i = nextIdx(i);
      if (i === cycleStartIndex) {
        const nowHash = hashRound();
        if (GAME.currentBet === lastBetSnapshot && nowHash === lastRoundHash) {
          passes++;
          if (passes >= 1) break;
        } else {
          passes = 0;
          lastBetSnapshot = GAME.currentBet;
          lastRoundHash = nowHash;
        }
      }
      continue;
    }
    if (i === 4) {
      GAME.awaiting = 'human';
      render();
      const action = await waitHumanAction();
      GAME.awaiting = null;
      if (action.type === 'fold') actFold(i);
      else if (action.type === 'check') actCheck(i);
      else if (action.type === 'call') actCall(i);
      else if (action.type === 'raiseTo') {
        actRaiseTo(i, action.amount);
        lastAggressor = i;
      }
    } else {
      const a = aiAction(i);
      if (a.type === 'fold') actFold(i);
      else if (a.type === 'check') actCheck(i);
      else if (a.type === 'call') actCall(i);
      else if (a.type === 'raiseTo') {
        actRaiseTo(i, a.amount);
        lastAggressor = i;
      }
      await sleep(180);
    }
    i = nextIdx(i);
    if (i === cycleStartIndex) {
      const nowHash = hashRound();
      if (GAME.currentBet === lastBetSnapshot && nowHash === lastRoundHash) {
        passes++;
        if (passes >= 1) break;
      } else {
        passes = 0;
        lastBetSnapshot = GAME.currentBet;
        lastRoundHash = nowHash;
      }
    }
    if (GAME.currentBet > 0 && lastAggressor !== null && i === nextIdx(lastAggressor) && allMatched()) break;
  }
  for (const p of GAME.players) p.roundBet = 0;
  GAME.currentBet = 0;
  GAME.lastRaise = 0;
  GAME.lastRaiser = null;
  render();
  return 'ok';
};

// Pots
const buildPots = () => {
  const eligible = GAME.players.filter((p) => !p.out);
  const levels = [...new Set(eligible.map((p) => p.totalBet))].filter((v) => v > 0).sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const L of levels) {
    const contributors = eligible.filter((p) => p.totalBet >= L);
    const amount = (L - prev) * contributors.length;
    const winners = contributors.filter((p) => !p.folded);
    if (amount > 0) pots.push({ amount, winners });
    prev = L;
  }
  return pots;
};

const showdown = () => {
  GAME.reveal = true;
  render();
  const alive = GAME.players.filter((p) => !p.folded && !p.out);
  const potAmount = GAME.pot();
  const anyAllIn = GAME.players.some((p) => p.allIn);
  if (!anyAllIn) {
    let bestScore = null;
    let best = [];
    const scores = new Map();
    for (const p of alive) {
      const sc = eval7(p.hand, GAME.board);
      scores.set(p, sc);
      if (!bestScore || compareScore(sc, bestScore) > 0) {
        bestScore = sc;
        best = [p];
      } else if (compareScore(sc, bestScore) === 0) {
        best.push(p);
      }
    }
    const share = Math.floor(potAmount / best.length);
    let rem = potAmount - share * best.length;
    for (const w of best) {
      w.stack += share;
      log(`${w.name} wins ${money(share)} with ${scores.get(w).name}.`);
      if (rem > 0) {
        w.stack += 1;
        rem--;
        log(`${w.name} receives +$1 (rounding).`);
      }
    }
    for (const p of GAME.players) p.totalBet = 0;
    return;
  }
  const scores = new Map();
  for (const p of alive) scores.set(p, eval7(p.hand, GAME.board));
  const pots = buildPots();
  for (const pot of pots) {
    if (pot.winners.length === 0) continue;
    let bestScore = null;
    let best = [];
    for (const p of pot.winners) {
      const sc = scores.get(p) || eval7(p.hand, GAME.board);
      if (!bestScore || compareScore(sc, bestScore) > 0) {
        bestScore = sc;
        best = [p];
      } else if (compareScore(sc, bestScore) === 0) {
        best.push(p);
      }
    }
    const share = Math.floor(pot.amount / best.length);
    let rem = pot.amount - share * best.length;
    for (const w of best) {
      w.stack += share;
      log(`${w.name} wins ${money(share)} from a side pot with ${scores.get(w).name}.`);
      if (rem > 0) {
        w.stack += 1;
        rem--;
        log(`${w.name} receives +$1 (rounding).`);
      }
    }
  }
  for (const p of GAME.players) p.totalBet = 0;
};

// Hand flow
const playHand = async () => {
  GAME.handNum++;
  GAME.handCount++;
  GAME.reveal = false;
  GAME.board = [];
  GAME.burn = [];
  resetRoundBets();
  for (const p of GAME.players) if (!p.out) p.resetForHand();
  for (const p of GAME.players) if (p.stack === 0) p.out = true;
  const contenders = GAME.players.filter((p) => !p.out);
  if (contenders.length <= 1) {
    render();
    log(`Game over. Winner: ${contenders[0]?.name || 'Nobody'}.`);
    return false;
  }
  GAME.deck = new Deck();
  GAME.deck.shuffle();
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < GAME.players.length; i++) if (!GAME.players[i].out) GAME.players[i].hand.push(GAME.deck.deal());
  postBlinds();
  GAME.street = 'preflop';
  render();
  const preStart = nextIdx(GAME.bbIdx);
  const br1 = await bettingRound(preStart);
  if (br1 === 'ended') {
    GAME.reveal = false;
    return true;
  }
  GAME.burn.push(GAME.deck.deal());
  GAME.board.push(GAME.deck.deal(), GAME.deck.deal(), GAME.deck.deal());
  GAME.street = 'flop';
  resetRoundBets();
  render();
  log(`=== FLOP: ${GAME.board.slice(0, 3).map((c) => c.toString(true)).join(' ')} ===`);
  const br2 = await bettingRound((GAME.dealer + 1) % GAME.players.length);
  if (br2 === 'ended') {
    GAME.reveal = false;
    return true;
  }
  GAME.burn.push(GAME.deck.deal());
  const turnCard = GAME.deck.deal();
  GAME.board.push(turnCard);
  GAME.street = 'turn';
  resetRoundBets();
  render();
  log(`=== TURN: ${turnCard.toString(true)}  | Board: ${GAME.board.map((c) => c.toString(true)).join(' ')} ===`);
  const br3 = await bettingRound((GAME.dealer + 1) % GAME.players.length);
  if (br3 === 'ended') {
    GAME.reveal = false;
    return true;
  }
  GAME.burn.push(GAME.deck.deal());
  const riverCard = GAME.deck.deal();
  GAME.board.push(riverCard);
  GAME.street = 'river';
  resetRoundBets();
  render();
  log(`=== RIVER: ${riverCard.toString(true)}  | Board: ${GAME.board.map((c) => c.toString(true)).join(' ')} ===`);
  const br4 = await bettingRound((GAME.dealer + 1) % GAME.players.length);
  if (br4 === 'ended') {
    GAME.reveal = false;
    return true;
  }
  GAME.street = 'showdown';
  render();
  log('=== SHOWDOWN ===');
  showdown();
  return true;
};

const rotateDealer = () => {
  const n = GAME.players.length;
  let i = (GAME.dealer + 1) % n;
  for (let k = 0; k < n; k++) {
    if (!GAME.players[i].out) {
      GAME.dealer = i;
      return;
    }
    i = (i + 1) % n;
  }
};

// Controls
let humanResolve = null;
const waitHumanAction = () =>
  new Promise((res) => {
    humanResolve = res;
    updateControls();
  });
foldBtn.addEventListener('click', () => {
  if (GAME.awaiting === 'human' && humanResolve) humanResolve({ type: 'fold' });
});
ccBtn.addEventListener('click', () => {
  if (GAME.awaiting === 'human' && humanResolve) {
    const you = GAME.players[4];
    const toCall = Math.max(0, GAME.currentBet - you.roundBet);
    humanResolve(toCall > 0 ? { type: 'call' } : { type: 'check' });
  }
});
raiseBtn.addEventListener('click', () => {
  if (GAME.awaiting === 'human' && humanResolve) {
    const you = GAME.players[4];
    let target = Math.floor(+amtInput.value / 10) * 10;
    if (Number.isNaN(target)) return;
    const minTo = GAME.currentBet === 0 ? GAME.bigBlind : GAME.currentBet + Math.max(GAME.lastRaise, GAME.bigBlind);
    target = clamp(target, Math.max(minTo, you.roundBet + 1), you.roundBet + you.stack);
    amtInput.value = target;
    humanResolve({ type: 'raiseTo', amount: target });
  }
});

const init = () => {
  GAME.players = [
    new Player('Player 1 (Rock)', true, 'rock'),
    new Player('Player 2 (Maniac)', true, 'maniac'),
    new Player('Player 3 (Station)', true, 'station'),
    new Player('Player 4 (Pro)', true, 'pro'),
    new Player('You', false, 'human'),
  ];
  GAME.dealer = 0;
  restartBtn.hidden = true;
  render();
  log('Welcome! You vs 4 computers. Starting stacks: $1000. Blinds: $10/$20.');
  (async function loop() {
    while (true) {
      const ok = await playHand();
      if (ok === false) break;
      const you = GAME.players[4];
      if (you.out || you.stack <= 0) {
        restartBtn.hidden = false;
        nextHandBtn.disabled = true;
        log('You are out. Click Restart to play again.');
        await new Promise((resolve) => {
          const h = () => {
            restartBtn.removeEventListener('click', h);
            resolve();
          };
          restartBtn.addEventListener('click', h);
        });
        GAME.players.forEach((p) => {
          p.stack = 1000;
          p.out = false;
          p.folded = false;
          p.allIn = false;
          p.hand = [];
          p.totalBet = 0;
          p.roundBet = 0;
        });
        GAME.board = [];
        GAME.burn = [];
        GAME.reveal = false;
        GAME.dealer = 0;
        restartBtn.hidden = true;
        render();
      }
      nextHandBtn.disabled = false;
      await new Promise((resolve) => {
        const h = () => {
          nextHandBtn.removeEventListener('click', h);
          nextHandBtn.disabled = true;
          resolve();
        };
        nextHandBtn.addEventListener('click', h);
      });
      rotateDealer();
      render();
    }
    render();
  })();
};

init();
