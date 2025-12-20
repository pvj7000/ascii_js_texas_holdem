import { RANK_VALUES } from './cards.js';

// Hand evaluator tuned for 7-card Hold'em. Scores are tuples (`key`) where
// higher comparisons win; `cat` is the category, followed by kicker values.
const rankName = (value) =>
  ({
    14: 'Ace',
    13: 'King',
    12: 'Queen',
    11: 'Jack',
    10: 'Ten',
    9: 'Nine',
    8: 'Eight',
    7: 'Seven',
    6: 'Six',
    5: 'Five',
    4: 'Four',
    3: 'Three',
    2: 'Two',
  }[value] || String(value));

const pluralRankName = (value) =>
  ({
    14: 'Aces',
    13: 'Kings',
    12: 'Queens',
    11: 'Jacks',
    10: 'Tens',
    9: 'Nines',
    8: 'Eights',
    7: 'Sevens',
    6: 'Sixes',
    5: 'Fives',
    4: 'Fours',
    3: 'Threes',
    2: 'Twos',
  }[value] || `${value}s`);

const hyphenRanks = (values) => values.map(rankName).join('-');

const kickerText = (kickers) => {
  if (!kickers.length) return '';
  const labels = kickers.map(rankName);
  if (labels.length === 1) return ` (${labels[0]} kicker)`;
  if (labels.length === 2) return ` (${labels[0]} and ${labels[1]} kickers)`;
  return ` (${labels.slice(0, -1).join(', ')} and ${labels.at(-1)} kickers)`;
};

const rankSymbol = (value) =>
  ({
    14: 'A',
    13: 'K',
    12: 'Q',
    11: 'J',
    10: 'T',
    9: '9',
    8: '8',
    7: '7',
    6: '6',
    5: '5',
    4: '4',
    3: '3',
    2: '2',
  }[value] || String(value));

const hyphenSymbols = (values) => values.filter((v) => Number.isFinite(v)).map(rankSymbol).join('-');

const pluralRankCompact = (value) => pluralRankName(value);

export const formatScore = (score) => {
  if (!score || typeof score.cat !== 'number' || !Array.isArray(score.key)) return '';
  const [, ...parts] = score.key;
  switch (score.cat) {
    case 9: {
      const high = parts[0];
      return `Straight Flush (${rankSymbol(high)}-high)`;
    }
    case 8: {
      const [quad] = parts;
      return `Four of a Kind (${pluralRankCompact(quad)})`;
    }
    case 7: {
      const [trips, pair] = parts;
      return `Full House (${pluralRankCompact(trips)} over ${pluralRankCompact(pair)})`;
    }
    case 6: {
      return `Flush (${hyphenSymbols(parts)})`;
    }
    case 5: {
      const high = parts[0];
      return `Straight (${rankSymbol(high)}-high)`;
    }
    case 4: {
      const [trips] = parts;
      return `Three of a Kind (${pluralRankCompact(trips)})`;
    }
    case 3: {
      const [highPair, lowPair, kicker] = parts;
      const kickerText = kicker ? `, ${rankName(kicker)} kicker` : '';
      return `Two Pair (${pluralRankCompact(highPair)} and ${pluralRankCompact(lowPair)}${kickerText})`;
    }
    case 2: {
      const [pair, ...kickers] = parts;
      const kickerSymbols = kickers.length ? hyphenSymbols(kickers) : '';
      const kickerText = kickerSymbols ? `, ${kickerSymbols} kickers` : '';
      return `One Pair (${pluralRankCompact(pair)}${kickerText})`;
    }
    case 1: {
      return `High Card (${hyphenSymbols(parts)})`;
    }
    default:
      return score.name || '';
  }
};

export const compareScore = (a, b) => {
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const left = a.key[i] || 0;
    const right = b.key[i] || 0;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
};

// Exact evaluator for 5 cards. Follows standard Hold'em ranking, including
// wheel (A-5) straights and flush-first logic.
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
      return { cat: 9, key: [9, straightFlushHigh], name: `Straight Flush, ${rankName(straightFlushHigh)}-High` };
    }
  }
  const groups = [...byRank.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a)[0];
    return { cat: 8, key: [8, quad, kicker], name: `Four of a Kind, ${pluralRankName(quad)} (${rankName(kicker)} kicker)` };
  }
  if (groups[0][1] === 3 && (groups[1]?.[1] || 0) >= 2) {
    const trips = groups[0][0];
    const pair = groups[1][1] === 2 ? groups[1][0] : groups[2][0];
    return { cat: 7, key: [7, trips, pair], name: `Full House, ${pluralRankName(trips)} over ${pluralRankName(pair)}` };
  }
  if (flushSuit) {
    const top5 = clean
      .filter((card) => card.s === flushSuit)
      .map((card) => card.v)
      .sort((a, b) => b - a)
      .slice(0, 5);
    return { cat: 6, key: [6, ...top5], name: `Flush, ${hyphenRanks(top5)}` };
  }
  if (straightHigh) {
    return { cat: 5, key: [5, straightHigh], name: `Straight, ${rankName(straightHigh)}-High` };
  }
  if (groups[0][1] === 3) {
    const trips = groups[0][0];
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a)
      .slice(0, 2);
    return { cat: 4, key: [4, trips, ...kickers], name: `Three of a Kind, ${pluralRankName(trips)}${kickerText(kickers)}` };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const [highPair, lowPair] = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = groups
      .slice(2)
      .map((g) => g[0])
      .sort((a, b) => b - a)[0];
    return {
      cat: 3,
      key: [3, highPair, lowPair, kicker],
      name: `Two Pair, ${pluralRankName(highPair)} and ${pluralRankName(lowPair)}${kickerText([kicker])}`,
    };
  }
  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a)
      .slice(0, 3);
    return { cat: 2, key: [2, pair, ...kickers], name: `One Pair, ${pluralRankName(pair)}${kickerText(kickers)}` };
  }
  const highs = ranks.slice().sort((a, b) => b - a).slice(0, 5);
  return { cat: 1, key: [1, ...highs], name: `High Card, ${hyphenRanks(highs)}` };
};

// Enumerate the best 5-card hand from 6 or 7 available cards. For 7, we check
// every combination of 5 (21 combos) which is feasible in-browser and keeps the
// logic deterministic for teaching purposes.
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
