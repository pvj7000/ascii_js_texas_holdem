// Helpers for turn order and survivor detection. A player is "alive" if they
// have chips left; "active" additionally excludes folded/all-in players for
// current-street action.
export const isAlive = (player) => !player.out;

export const isActive = (player) => !player.folded && !player.allIn && !player.out;

// Walk clockwise to find the next available seat for action (or blind posting).
export const nextIdx = (state, index) => {
  const n = state.players.length;
  for (let offset = 1; offset <= n; offset++) {
    const candidate = (index + offset) % n;
    if (isAlive(state.players[candidate])) return candidate;
  }
  return index;
};

// Same as above but used when calculating blinds from the dealer button.
export const nextAliveFrom = (state, start) => {
  const n = state.players.length;
  for (let offset = 1; offset <= n; offset++) {
    const candidate = (start + offset) % n;
    if (isAlive(state.players[candidate])) return candidate;
  }
  return start;
};

// Detect if betting can stop early because only one player remains in the pot.
export const onlyContender = (state) => {
  const alive = state.players.filter((player) => !player.folded && !player.out);
  return alive.length === 1 ? alive[0] : null;
};
