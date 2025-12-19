// Format chips as dollars for the ASCII HUD; deliberately simple to keep the
// retro vibe (no decimals in this fixed-blind game).
export const money = (value) => `$${value}`;

// Clamp numeric input so bet sizing cannot escape the legal min/max range.
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Cryptographically strong integer in [0, limit). Using Web Crypto keeps the
// shuffle honest and prevents predictable card order during long sessions.
export const randInt = (limit) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Number(buf[0] % limit);
};

// Grammar helper so the human's win messages read naturally.
export const winVerb = (name) => (name === 'You' ? 'win' : 'wins');

// Small helper to pause async flows; keeps AI actions readable without busy
// waits.
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
