export const isAlive = (player) => !player.out;

export const isActive = (player) => !player.folded && !player.allIn && !player.out;

export const nextIdx = (state, index) => {
  const n = state.players.length;
  for (let offset = 1; offset <= n; offset++) {
    const candidate = (index + offset) % n;
    if (isAlive(state.players[candidate])) return candidate;
  }
  return index;
};

export const nextAliveFrom = (state, start) => {
  const n = state.players.length;
  for (let offset = 1; offset <= n; offset++) {
    const candidate = (start + offset) % n;
    if (isAlive(state.players[candidate])) return candidate;
  }
  return start;
};

export const onlyContender = (state) => {
  const alive = state.players.filter((player) => !player.folded && !player.out);
  return alive.length === 1 ? alive[0] : null;
};
