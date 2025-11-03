export const money = (value) => `$${value}`;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const randInt = (limit) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Number(buf[0] % limit);
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
