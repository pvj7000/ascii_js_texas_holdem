import { RANK_VALUES } from './cards.js';

const handCategoryNames = {
  9: 'Straight Flush',
  8: 'Four of a Kind',
  7: 'Full House',
  6: 'Flush',
  5: 'Straight',
  4: 'Three of a Kind',
  3: 'Two Pair',
  2: 'One Pair',
  1: 'High Card',
};

const valueLabel = (value) => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }[value] || String(value));

const scoreName = (category, high) =>
  handCategoryNames[category] + (high ? ` (${valueLabel(high)} high)` : '');

export const compareScore = (a, b) => {
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const left = a.key[i] || 0;
    const right = b.key[i] || 0;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
};

export const eval5 = (cards) => {
  const clean = cards.filter((card) => card && typeof card.v === 'number' && card.s);
  if (clean.length !== 5) throw new Error('eval5 expects 5 cards');
  const byRank = new Map();
  const bySuit = new Map();
  for (const card of clean) {
    byRank.set(card.v, (byRank.get(card.v) || 0) + 1);
    bySuit.set(card.s, (bySuit.get(card.s) || 0) + 1);
  }
  const ranks = [...byRank.keys()].sort((a, b) => b - a);
  const uniq = [...new Set(clean.map((card) => card.v))].sort((a, b) => b - a);
  let straightHigh = 0;
  for (let i = 0; i <= uniq.length - 5; i++) {
    let run = true;
    for (let offset = 0; offset < 4; offset++) {
      if (uniq[i + offset] - 1 !== uniq[i + offset + 1]) run = false;
    }
    if (run) {
      straightHigh = uniq[i];
      break;
    }
  }
  if (
    !straightHigh &&
    uniq.includes(RANK_VALUES.A) &&
    uniq.includes(RANK_VALUES['5']) &&
    uniq.includes(RANK_VALUES['4']) &&
    uniq.includes(RANK_VALUES['3']) &&
    uniq.includes(RANK_VALUES['2'])
  ) {
    straightHigh = 5;
  }
  let flushSuit = null;
  for (const [suit, count] of bySuit) if (count >= 5) flushSuit = suit;
  if (flushSuit) {
    const suited = clean
      .filter((card) => card.s === flushSuit)
      .map((card) => card.v)
      .sort((a, b) => b - a);
    const uniqSuited = [...new Set(suited)];
    let straightFlushHigh = 0;
    for (let i = 0; i <= uniqSuited.length - 5; i++) {
      let ok = true;
      for (let offset = 0; offset < 4; offset++) {
        if (uniqSuited[i + offset] - 1 !== uniqSuited[i + offset + 1]) ok = false;
      }
      if (ok) {
        straightFlushHigh = uniqSuited[i];
        break;
      }
    }
    if (
      !straightFlushHigh &&
      uniqSuited.includes(RANK_VALUES.A) &&
      uniqSuited.includes(RANK_VALUES['5']) &&
      uniqSuited.includes(RANK_VALUES['4']) &&
      uniqSuited.includes(RANK_VALUES['3']) &&
      uniqSuited.includes(RANK_VALUES['2'])
    ) {
      straightFlushHigh = 5;
    }
    if (straightFlushHigh) {
      return { cat: 9, key: [9, straightFlushHigh], name: scoreName(9, straightFlushHigh) };
    }
  }
  const groups = [...byRank.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a)[0];
    return { cat: 8, key: [8, quad, kicker], name: scoreName(8, quad) };
  }
  if (groups[0][1] === 3 && (groups[1]?.[1] || 0) >= 2) {
    const trips = groups[0][0];
    const pair = groups[1][1] === 2 ? groups[1][0] : groups[2][0];
    return { cat: 7, key: [7, trips, pair], name: scoreName(7, trips) };
  }
  if (flushSuit) {
    const top5 = clean
      .filter((card) => card.s === flushSuit)
      .map((card) => card.v)
      .sort((a, b) => b - a)
      .slice(0, 5);
    return { cat: 6, key: [6, ...top5], name: scoreName(6, top5[0]) };
  }
  if (straightHigh) {
    return { cat: 5, key: [5, straightHigh], name: scoreName(5, straightHigh) };
  }
  if (groups[0][1] === 3) {
    const trips = groups[0][0];
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a)
      .slice(0, 2);
    return { cat: 4, key: [4, trips, ...kickers], name: scoreName(4, trips) };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const [highPair, lowPair] = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = groups
      .slice(2)
      .map((g) => g[0])
      .sort((a, b) => b - a)[0];
    return { cat: 3, key: [3, highPair, lowPair, kicker], name: scoreName(3, highPair) };
  }
  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a)
      .slice(0, 3);
    return { cat: 2, key: [2, pair, ...kickers], name: scoreName(2, pair) };
  }
  const highs = ranks.slice().sort((a, b) => b - a).slice(0, 5);
  return { cat: 1, key: [1, ...highs], name: `High Card (${valueLabel(highs[0])} high)` };
};

export const eval7 = (hole, board) => {
  const cards = hole.concat(board).filter(Boolean);
  const total = cards.length;
  if (total < 5) throw new Error('eval7 needs at least 5 cards');
  if (total === 5) return eval5(cards);
  let best = null;
  if (total === 6) {
    for (let i = 0; i < 6; i++) {
      const subset = cards.slice(0, i).concat(cards.slice(i + 1));
      const score = eval5(subset);
      if (!best || compareScore(score, best) > 0) best = score;
    }
    return best;
  }
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      const subset = cards.filter((_, idx) => idx !== i && idx !== j).slice(0, 5);
      const score = eval5(subset);
      if (!best || compareScore(score, best) > 0) best = score;
    }
  }
  return best;
};
