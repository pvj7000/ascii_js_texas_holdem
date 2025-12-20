import { clamp, money } from '../utils.js';
import { isAlive, nextAliveFrom } from '../core/table.js';

// Tiny DOM helper to keep the renderer readable.
const qs = (selector) => document.querySelector(selector);

// We render the ASCII board using `innerHTML` so we can color cards; sanitize
// first to avoid letting the log inject markup.
const escapeHtml = (input) =>
  input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// Find card-like tokens (`[Ah]`) and wrap them in span tags for suit coloring.
const highlightCards = (input) => {
  const safe = escapeHtml(input);
  const cardPattern = /\[((10|[2-9TJQKA]))([♣♦♥♠])\]/g;
  const suitClass = {
    '♣': 'clubs',
    '♦': 'diamonds',
    '♥': 'hearts',
    '♠': 'spades',
  };
  return safe.replace(cardPattern, (_, __, rank, suit) => {
    const cls = suitClass[suit] || 'card';
    return `<span class="card card--${cls}">[${rank}${suit}]</span>`;
  });
};

const measureCharWidth = (el) => {
  const sample = document.createElement('span');
  sample.textContent = 'MMMMMMMMMM';
  sample.style.position = 'absolute';
  sample.style.visibility = 'hidden';
  sample.style.whiteSpace = 'pre';
  const style = getComputedStyle(el);
  sample.style.fontFamily = style.fontFamily;
  sample.style.fontSize = style.fontSize;
  sample.style.fontWeight = style.fontWeight;
  document.body.append(sample);
  const width = sample.getBoundingClientRect().width / sample.textContent.length;
  sample.remove();
  return width || 8;
};

const fitLine = (text, width) => {
  const trimmed = text.length > width ? text.slice(0, width) : text;
  return trimmed.padEnd(width, ' ');
};

const wrapToWidth = (text, width) => {
  if (text.length <= width) return [fitLine(text, width)];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const spacer = current ? 1 : 0;
    if (current.length + word.length + spacer <= width) {
      current += (current ? ' ' : '') + word;
      continue;
    }
    if (current) lines.push(fitLine(current, width));
    if (word.length > width) {
      for (let i = 0; i < word.length; i += width) lines.push(fitLine(word.slice(i, i + width), width));
      current = '';
    } else {
      current = word;
    }
  }
  if (current) lines.push(fitLine(current, width));
  return lines.length ? lines : [fitLine('', width)];
};

const buildDivider = (totalWidth, fill = '=') => `+${fill.repeat(Math.max(0, totalWidth - 2))}+`;

const buildRow = (totalWidth, content) => {
  const inner = Math.max(0, totalWidth - 2);
  return `|${fitLine(content, inner)}|`;
};

const buildTitleDivider = (title, totalWidth, fill = '-') => {
  const inner = Math.max(0, totalWidth - 2);
  const maxTitle = Math.max(0, inner - 2);
  const safeTitle = title.length > maxTitle ? `${title.slice(0, Math.max(0, maxTitle - 1))}…` : title;
  const available = Math.max(0, inner - (safeTitle.length + 2));
  const left = Math.floor(available / 2);
  const right = available - left;
  return `+${fill.repeat(left)} ${safeTitle} ${fill.repeat(right)}+`;
};

// Main UI factory: wires DOM controls to game state and exposes rendering +
// input promises consumed by the game loop.
export const createUI = (state) => {
  const screen = qs('#screen');
  const logEl = qs('#log');
  const foldBtn = qs('#foldBtn');
  const checkCallBtn = qs('#checkCallBtn');
  const raiseBtn = qs('#raiseBtn');
  const raiseInput = qs('#raiseAmount');
  const nextHandBtn = qs('#nextHandBtn');
  const restartBtn = qs('#restartBtn');
  const info = qs('#info');
  raiseInput.value = '100';
  let humanActive = false;
  let lastStreetForRaise = null;

  const parseNumericValue = (raw) => {
    const cleaned = String(raw ?? '').replace(/[^\d]/g, '');
    const numeric = Number.parseInt(cleaned, 10);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const minRaiseTarget = () => {
    const you = state.players[4];
    const baseMin = state.currentBet === 0 ? state.bigBlind : state.currentBet + Math.max(state.lastRaise, state.bigBlind);
    return Math.max(baseMin, you.roundBet + 1);
  };

  const maxRaiseTarget = () => {
    const you = state.players[4];
    return you.roundBet + you.stack;
  };

  const normalizeRaiseValue = (value) => {
    const minTo = minRaiseTarget();
    const maxTo = Math.max(minTo, maxRaiseTarget());
    const parsed = parseNumericValue(value);
    let target = parsed === null ? minTo : Math.floor(parsed / 10) * 10;
    target = clamp(target, minTo, maxTo);
    raiseInput.value = target;
    return target;
  };

  // Log entries are prepended so the newest action is always visible on top.
  const log = (message) => {
    logEl.value = `${message}\n${logEl.value}`;
    logEl.scrollTop = 0;
  };

  // Enable/disable action buttons based on whose turn it is and whether the
  // human already folded/all-in. Also shows min/max raise guidance.
  const updateControls = () => {
    const you = state.players[4];
    const toCall = Math.max(0, state.currentBet - you.roundBet);
    const active = state.awaiting === 'human' && !you.folded && !you.allIn && !you.out;
    const becameActive = active && !humanActive;
    humanActive = active;
    foldBtn.disabled = !active;
    checkCallBtn.disabled = !active;
    raiseBtn.disabled = !active;
    raiseInput.disabled = !active;
    checkCallBtn.textContent = toCall > 0 ? `[C] Call ${money(Math.min(toCall, you.stack))}` : '[C] Check';
    const callNeedsAttention = active && toCall > 0;
    checkCallBtn.classList.toggle('call--alert', callNeedsAttention);
    const minTo = minRaiseTarget();
    const maxTo = Math.max(minTo, maxRaiseTarget());
    raiseInput.min = minTo;
    raiseInput.max = maxTo;
    raiseInput.step = 10;
    normalizeRaiseValue(raiseInput.value || minTo);
    if (becameActive) {
      raiseInput.focus();
      raiseInput.select();
    }
    info.textContent = active
      ? `To call: ${money(toCall)} · Min raise-to: ${money(+raiseInput.min)} · You: ${money(you.stack)}`
      : 'Waiting for players...';
  };

  // Render the ASCII table + HUD. We mirror live Hold'em: pot and call info up
  // top, community board in the middle, seats around the bottom.
  const render = () => {
    if (state.street !== lastStreetForRaise) {
      lastStreetForRaise = state.street;
      raiseInput.value = '100';
      normalizeRaiseValue(raiseInput.value);
    }
    const players = state.players;
    const n = players.length;
    const dealer = state.dealer;
    const sb =
      Number.isInteger(state.sbIdx) && isAlive(players[state.sbIdx])
        ? state.sbIdx
        : nextAliveFrom(state, dealer);
    const bb =
      Number.isInteger(state.bbIdx) && isAlive(players[state.bbIdx])
        ? state.bbIdx
        : nextAliveFrom(state, sb);
    const role = (i) => (i === dealer ? 'D' : i === sb ? 'SB' : i === bb ? 'BB' : ' ');
    const you = players[4];
    const toCall = Math.max(0, state.currentBet - you.roundBet);
    const status = (player) => (player.out ? 'OUT' : player.folded ? 'FOLDED' : player.allIn ? 'ALL-IN' : 'IN');
    const cardFace = (player) =>
      player.folded || player.out
        ? '[—] [—]'
        : player.isAI && !state.reveal
        ? '[###] [###]'
        : `${player.hand[0]?.toString(true)} ${player.hand[1]?.toString(true)}`;
    const arrow = (i) =>
      state.current === i && !players[i].out && !players[i].folded && !players[i].allIn ? '->' : '  ';

    const compactLayout = window.matchMedia('(max-width: 900px)').matches;
    const charWidth = measureCharWidth(screen);
    const availablePx = screen.clientWidth || window.innerWidth || 960;
    const lineWidth = Math.max(32, Math.floor(availablePx / charWidth) - 2);
    const innerWidth = Math.max(10, lineWidth - 2);
    const rowToFull = (line) => fitLine(line, lineWidth);

    const hudSegments = [
      `POT ${money(state.pot())}`,
      `YOUR STACK ${money(you.stack)}`,
      `TO CALL ${money(toCall)}`,
      `HAND #${(state.handCount || 0).toString().padEnd(3)}`,
    ];

    let hudRows;
    if (compactLayout) {
      const pairWidth = Math.max(4, Math.floor((innerWidth - 3) / 2));
      hudRows = [
        `${hudSegments[0].padEnd(pairWidth)} | ${hudSegments[1].padEnd(pairWidth)}`.slice(0, innerWidth),
        `${hudSegments[2].padEnd(pairWidth)} | ${hudSegments[3].padEnd(pairWidth)}`.slice(0, innerWidth),
      ];
    } else {
      const spacing = ' | ';
      hudRows = [hudSegments.join(spacing).slice(0, innerWidth)];
    }

    const hud = [
      buildDivider(lineWidth, '='),
      ...hudRows.map((row) => buildRow(lineWidth, row)),
      buildDivider(lineWidth, '='),
    ];

    const comm = state.board.filter(Boolean).map((card) => card.toString(true)).join(' ');
    const cTitle = `COMMUNITY (${state.street.toUpperCase()})`;
    const community = [
      buildTitleDivider(cTitle, lineWidth, '-'),
      buildRow(lineWidth, comm || '(none yet)'),
      buildDivider(lineWidth, '-'),
    ];

    const sep = '  ';
    const twoColWidth = Math.max(14, Math.floor((lineWidth - sep.length) / 2));
    const cell = (i, width) => {
      const player = players[i];
      const r = role(i);
      const line1 = `${arrow(i)} ${player.name}${player.isAI ? '' : ' (You)'} ${r !== ' ' ? '(' + r + ')' : ''}`.trim();
      const line2 = `stk:${money(player.stack)}  in:${money(player.totalBet)}  rnd:${money(player.roundBet)}  ${cardFace(
        player,
      )}`;
      return {
        line1: fitLine(`${line1}  ${status(player)}`, width),
        line2: fitLine(line2, width),
      };
    };

    const bodyLines = [];
    if (compactLayout) {
      [0, 1, 2, 3].forEach((idx) => {
        const c = cell(idx, innerWidth);
        bodyLines.push(rowToFull(c.line1));
        bodyLines.push(rowToFull(c.line2));
        bodyLines.push(rowToFull(''));
      });
      const hero = cell(4, innerWidth);
      bodyLines.push(rowToFull(hero.line1));
      bodyLines.push(rowToFull(hero.line2));
    } else {
      const topRow = [cell(0, twoColWidth), cell(1, twoColWidth)];
      const midRow = [cell(2, twoColWidth), cell(3, twoColWidth)];
      const hero = cell(4, twoColWidth);
      const heroPad = Math.max(0, Math.floor((lineWidth - twoColWidth) / 2));

      bodyLines.push(rowToFull(topRow.map((c) => c.line1).join(sep)));
      bodyLines.push(rowToFull(topRow.map((c) => c.line2).join(sep)));
      bodyLines.push(rowToFull(''));
      bodyLines.push(rowToFull(midRow.map((c) => c.line1).join(sep)));
      bodyLines.push(rowToFull(midRow.map((c) => c.line2).join(sep)));
      bodyLines.push(rowToFull(''));
      bodyLines.push(rowToFull(' '.repeat(heroPad) + hero.line1));
      bodyLines.push(rowToFull(' '.repeat(heroPad) + hero.line2));
    }

    const contribLine =
      'Contributed this hand: ' + players.map((p) => `${p.name.split(' ')[0]}=${money(p.totalBet)}`).join('  ');
    const stateLine = `Street: ${state.street.toUpperCase()}   Current Bet: ${money(state.currentBet)}   Last Raise: ${money(
      state.lastRaise,
    )}   Hand #${state.handNum}`;
    const legend =
      'Legend: D/SB/BB = Dealer/Small Blind/Big Blind · IN/FOLDED/ALL-IN/OUT · rnd = this street';

    const footer = [
      ...wrapToWidth(contribLine, lineWidth),
      ...wrapToWidth(stateLine, lineWidth),
      ...wrapToWidth(legend, lineWidth),
    ];

    const ascii = [...hud, ...community, ...bodyLines, '', ...footer].join('\n');

    screen.innerHTML = highlightCards(ascii);
    updateControls();
  };

  let humanResolve = null;

  // Promise-based bridge to the main loop: resolve when the human clicks a
  // button, so betting waits naturally for input.
  const resolveHuman = (payload) => {
    if (!humanResolve) return;
    const resolver = humanResolve;
    humanResolve = null;
    humanActive = false;
    resolver(payload);
  };

  const waitHumanAction = () =>
    new Promise((resolve) => {
      humanResolve = resolve;
      updateControls();
    });

  const handleFold = () => {
    if (state.awaiting !== 'human' || foldBtn.disabled) return;
    resolveHuman({ type: 'fold' });
  };

  const handleCheckOrCall = () => {
    if (state.awaiting !== 'human' || checkCallBtn.disabled) return;
    const you = state.players[4];
    const toCall = Math.max(0, state.currentBet - you.roundBet);
    resolveHuman(toCall > 0 ? { type: 'call' } : { type: 'check' });
  };

  const handleRaise = () => {
    if (state.awaiting !== 'human' || raiseBtn.disabled) return;
    const target = normalizeRaiseValue(raiseInput.value);
    resolveHuman({ type: 'raiseTo', amount: target });
  };

  foldBtn.addEventListener('click', handleFold);
  checkCallBtn.addEventListener('click', handleCheckOrCall);
  raiseBtn.addEventListener('click', handleRaise);

  document.addEventListener('keydown', (event) => {
    if (!humanActive) return;
    const key = event.key.toLowerCase();
    if (key === 'c') {
      event.preventDefault();
      handleCheckOrCall();
    } else if (key === 'f') {
      event.preventDefault();
      handleFold();
    }
  });

  const waitForButton = (button, { disableAfter = true } = {}) =>
    new Promise((resolve) => {
      const handler = () => {
        button.removeEventListener('click', handler);
        if (disableAfter) button.disabled = true;
        resolve();
      };
      button.addEventListener('click', handler);
    });

  const setNextHandAttention = (active) => {
    nextHandBtn.classList.toggle('next-hand--pulse', Boolean(active));
  };

  // Utilities used by the game loop after a hand concludes.
  const waitForNextHand = async () => {
    nextHandBtn.disabled = false;
    setNextHandAttention(true);
    await waitForButton(nextHandBtn);
    setNextHandAttention(false);
  };

  const waitForRestart = async () => {
    restartBtn.hidden = false;
    await waitForButton(restartBtn, { disableAfter: false });
    restartBtn.hidden = true;
  };

  const setNextHandEnabled = (enabled) => {
    nextHandBtn.disabled = !enabled;
    if (!enabled) setNextHandAttention(false);
  };

  const setNextHandLabel = (label) => {
    nextHandBtn.textContent = label;
  };

  const showRestart = (show) => {
    restartBtn.hidden = !show;
  };

  window.addEventListener('resize', render, { passive: true });

  return {
    render,
    log,
    waitHumanAction,
    waitForNextHand,
    waitForRestart,
    setNextHandEnabled,
    setNextHandLabel,
    showRestart,
    updateControls,
  };
};
