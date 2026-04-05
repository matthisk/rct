/**
 * Generates a 64×32 px canvas element containing a procedural grass texture.
 *
 * The canvas size matches TILE_W×TILE_H so that UV coordinates [0,1]×[0,1]
 * map directly to one tile pixel.  The diamond-clipping happens in the GPU
 * (the UV mapping only samples inside the diamond), so the full rectangle is
 * painted here without any explicit clipping.
 */
export function makeGrassCanvas(): HTMLCanvasElement {
  const W = 64, H = 32;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const rng = makeRng(42);

  // Base grass fill
  ctx.fillStyle = '#5fad24';
  ctx.fillRect(0, 0, W, H);

  // Variation patches — lighter and darker blobs for a natural look
  for (let i = 0; i < 60; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 1 + rng() * 5;
    ctx.fillStyle = rng() > 0.45 ? '#78d03a' : '#4a8f1a';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/** Simple deterministic LCG PRNG — gives reproducible textures. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
