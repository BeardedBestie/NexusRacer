// Deterministic hash-based value noise + fBm. Seeded, no allocations in hot path.

export function hash2i(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function hash3i(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Value noise in [-1,1]
export function valueNoise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = hash2i(xi, yi, seed);
  const b = hash2i(xi + 1, yi, seed);
  const c = hash2i(xi, yi + 1, seed);
  const d = hash2i(xi + 1, yi + 1, seed);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return (top + (bot - top) * v) * 2 - 1;
}

// Rotated-domain fBm to break axis alignment
const R_C = Math.cos(0.7), R_S = Math.sin(0.7);

export function fbm2(x, y, seed, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  let px = x, py = y;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(px * freq, py * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
    const nx = px * R_C - py * R_S;
    py = px * R_S + py * R_C;
    px = nx;
  }
  return sum / norm;
}

// Ridged fBm in [0,1], produces ranges/ridges rather than blobs
export function ridged2(x, y, seed, octaves = 5, lacunarity = 2.07, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0, prev = 1;
  let px = x, py = y;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(valueNoise2(px * freq, py * freq, seed + i * 7919));
    n *= n;
    sum += n * amp * prev;
    prev = n;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
    const nx = px * R_C - py * R_S;
    py = px * R_S + py * R_C;
    px = nx;
  }
  return sum / norm;
}

// Small deterministic PRNG for placement / world content
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
