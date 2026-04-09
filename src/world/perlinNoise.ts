/**
 * Classic 2-D Perlin noise with a seeded permutation table.
 *
 * Usage:
 *   const noise = makePerlin(seed);
 *   const v = noise(x, y);          // single octave, returns [-1, 1]
 *   const v = fbm(noise, x, y, 4);  // 4-octave fractal noise, returns [-1, 1]
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ken Perlin's improved fade curve: 6t⁵ − 15t⁴ + 10t³ */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Dot product of the pseudo-random gradient (derived from hash) with the
 * distance vector (x, y).  Uses the 8 gradients from the unit square corners
 * and edge midpoints.
 */
function grad(hash: number, x: number, y: number): number {
  switch (hash & 7) {
    case 0: return  x + y;
    case 1: return -x + y;
    case 2: return  x - y;
    case 3: return -x - y;
    case 4: return  x;
    case 5: return -x;
    case 6: return  y;
    case 7: return -y;
    default: return 0; // unreachable
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a 2-D Perlin noise function seeded by `seed`.
 * Output is in the range [-1, 1].
 */
export function makePerlin(seed: number): (x: number, y: number) => number {
  // Build a seeded permutation table (256 values shuffled, then doubled).
  let s = seed >>> 0;
  const rng = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i]!; p[i] = p[j]!; p[j] = tmp;
  }

  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;

  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u  = fade(xf);
    const v  = fade(yf);

    const a  = (perm[X]!     + Y) & 255;
    const b  = (perm[X + 1]! + Y) & 255;

    return lerp(
      lerp(grad(perm[a]!,     xf,     yf),     grad(perm[b]!,     xf - 1, yf),     u),
      lerp(grad(perm[a + 1]!, xf,     yf - 1), grad(perm[b + 1]!, xf - 1, yf - 1), u),
      v,
    );
  };
}

/**
 * Fractional Brownian Motion — sums `octaves` layers of Perlin noise, each
 * at double the frequency and half the amplitude of the previous.
 *
 * Output is normalised to [-1, 1].
 */
export function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  persistence = 0.5,
): number {
  let value    = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue  = 0;

  for (let i = 0; i < octaves; i++) {
    value    += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}
