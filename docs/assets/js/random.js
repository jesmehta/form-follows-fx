// Deterministic string hash (FNV-1a variant) feeding a mulberry32 PRNG.
// Same seed string -> same sequence, every reload, every machine.

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

export function seededRandom(seedString) {
  let seed = hashString(seedString);
  return function rng() {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a deterministic but well-distributed item from a list for a given
// rect, independent of draw order — used for filler-cell visual variety.
export function pickFromId(id, list) {
  const h = hashString(id);
  return list[h % list.length];
}
