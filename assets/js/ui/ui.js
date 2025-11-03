import { clamp, money } from '../utils.js';

const qs = (selector) => document.querySelector(selector);

const escapeHtml = (input) =>
  input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

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
  raiseInput.value = state.bigBlind;

  const log = (message) => {
    logEl.value = `${message}\n${logEl.value}`;
    logEl.scrollTop = 0;
  };

  const updateControls = () => {
    const you = state.players[4];
    const toCall = Math.max(0, state.currentBet - you.roundBet);
    const active = state.awaiting === 'human' && !you.folded && !you.allIn && !you.out;
    foldBtn.disabled = !active;
    checkCallBtn.disabled = !active;
    raiseBtn.disabled = !active;
    raiseInput.disabled = !active;
    checkCallBtn.textContent = toCall > 0 ? `Call ${money(Math.min(toCall, you.stack))}` : 'Check';
    const minTo = state.currentBet === 0 ? state.bigBlind : state.currentBet + Math.max(state.lastRaise, state.bigBlind);
    const maxTo = you.roundBet + you.stack;
    raiseInput.min = Math.max(minTo, you.roundBet + 1);
    raiseInput.max = Math.max(minTo, maxTo);
    raiseInput.step = 10;
    if (+raiseInput.value < raiseInput.min) raiseInput.value = raiseInput.min;
    info.textContent = active
      ? `To call: ${money(toCall)} · Min raise-to: ${money(+raiseInput.min)} · You: ${money(you.stack)}`
      : 'Waiting for players...';
  };

  const render = () => {
    const players = state.players;
    const n = players.length;
    const dealer = state.dealer;
    const sb = (dealer + 1) % n;
    const bb = (dealer + 2) % n;
    const role = (i) => (i === dealer ? 'D' : i === sb ? 'SB' : i === bb ? 'BB' : ' ');
    const you = players[4];
    const toCall = Math.max(0, state.currentBet - you.roundBet);
    const status = (player) => (player.out ? 'OUT' : player.folded ? 'FOLDED' : player.allIn ? 'ALL-IN' : 'IN');
    const cardFace = (player) =>
      player.folded
        ? '[—] [—]'
        : player.isAI && !state.reveal
        ? '[###] [###]'
        : `${player.hand[0]?.toString(true)} ${player.hand[1]?.toString(true)}`;
    const arrow = (i) =>
      state.current === i && !players[i].out && !players[i].folded && !players[i].allIn ? '->' : '  ';

    const hudTop = '+================================================================================+';
    const hudMid = `| POT ${money(state.pot()).padEnd(8)} | YOUR STACK ${money(you.stack).padEnd(8)} | TO CALL ${money(
      toCall,
    ).padEnd(8)} | HAND #${(state.handCount || 0).toString().padEnd(3)} |`;
    const hudBtm = '+================================================================================+';

    const comm = state.board.filter(Boolean).map((card) => card.toString(true)).join(' ');
    const cTitle = `COMMUNITY (${state.street.toUpperCase()})`;
    const cTop = `+----------------------------------- ${cTitle} -----------------------------------+`;
    const inner = comm || '(none yet)';
    const cMid = `| ${inner}${' '.repeat(Math.max(0, 82 - inner.length))}|`;
    const cBtm = '+---------------------------------------------------------------------------------+';

    const CELLW = 40;
    const sep = '  ';
    const ROWW = CELLW * 2 + sep.length;
    const bodyLines = [];
    const cell = (i) => {
      const player = players[i];
      const r = role(i);
      const line1 = `${arrow(i)} ${player.name}${player.isAI ? '' : ' (You)'} ${r !== ' ' ? '(' + r + ')' : ''}`.trim();
      const line2 = `stk:${money(player.stack)}  in:${money(player.totalBet)}  rnd:${money(player.roundBet)}  ${cardFace(
        player,
      )}`;
      return {
        line1: (line1 + '  ' + status(player)).slice(0, CELLW).padEnd(CELLW, ' '),
        line2: line2.slice(0, CELLW).padEnd(CELLW, ' '),
      };
    };
    const topRow = [cell(0), cell(1)];
    const midRow = [cell(2), cell(3)];
    const hero = cell(4);
    bodyLines.push(topRow.map((c) => c.line1).join(sep));
    bodyLines.push(topRow.map((c) => c.line2).join(sep));
    bodyLines.push('');
    bodyLines.push(midRow.map((c) => c.line1).join(sep));
    bodyLines.push(midRow.map((c) => c.line2).join(sep));
    bodyLines.push('');
    const pad = Math.max(0, Math.floor((ROWW - CELLW) / 2));
    bodyLines.push(' '.repeat(pad) + hero.line1);
    bodyLines.push(' '.repeat(pad) + hero.line2);

    const contribLine =
      'Contributed this hand: ' + players.map((p) => `${p.name.split(' ')[0]}=${money(p.totalBet)}`).join('  ');
    const stateLine = `Street: ${state.street.toUpperCase()}   Current Bet: ${money(state.currentBet)}   Last Raise: ${money(
      state.lastRaise,
    )}   Hand #${state.handNum}`;
    const legend =
      'Legend: D/SB/BB = Dealer/Small Blind/Big Blind · IN/FOLDED/ALL-IN/OUT · rnd = this street';

    const ascii = [
      hudTop,
      hudMid,
      hudBtm,
      cTop,
      cMid,
      cBtm,
      ...bodyLines,
      '',
      contribLine,
      stateLine,
      legend,
    ].join('\n');

    screen.innerHTML = highlightCards(ascii);
    updateControls();
  };

  let humanResolve = null;

  const resolveHuman = (payload) => {
    if (!humanResolve) return;
    const resolver = humanResolve;
    humanResolve = null;
    resolver(payload);
  };

  const waitHumanAction = () =>
    new Promise((resolve) => {
      humanResolve = resolve;
      updateControls();
    });

  foldBtn.addEventListener('click', () => {
    if (state.awaiting === 'human') resolveHuman({ type: 'fold' });
  });
  checkCallBtn.addEventListener('click', () => {
    if (state.awaiting === 'human') {
      const you = state.players[4];
      const toCall = Math.max(0, state.currentBet - you.roundBet);
      resolveHuman(toCall > 0 ? { type: 'call' } : { type: 'check' });
    }
  });
  raiseBtn.addEventListener('click', () => {
    if (state.awaiting === 'human') {
      const you = state.players[4];
      let target = Math.floor(+raiseInput.value / 10) * 10;
      if (Number.isNaN(target)) return;
      const minTo = state.currentBet === 0 ? state.bigBlind : state.currentBet + Math.max(state.lastRaise, state.bigBlind);
      target = clamp(target, Math.max(minTo, you.roundBet + 1), you.roundBet + you.stack);
      raiseInput.value = target;
      resolveHuman({ type: 'raiseTo', amount: target });
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

  const waitForNextHand = async () => {
    nextHandBtn.disabled = false;
    await waitForButton(nextHandBtn);
  };

  const waitForRestart = async () => {
    restartBtn.hidden = false;
    await waitForButton(restartBtn, { disableAfter: false });
    restartBtn.hidden = true;
  };

  const setNextHandEnabled = (enabled) => {
    nextHandBtn.disabled = !enabled;
  };

  const showRestart = (show) => {
    restartBtn.hidden = !show;
  };

  return {
    render,
    log,
    waitHumanAction,
    waitForNextHand,
    waitForRestart,
    setNextHandEnabled,
    showRestart,
    updateControls,
  };
};
