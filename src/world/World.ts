import { TileType } from './Tile';
import { makePerlin, fbm } from './perlinNoise';

/** Fraction of tiles that start as trees. */
const TREE_DENSITY = 0.2;

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * The game world: a flat 2-D grid of tiles.
 *
 * Coordinates use (col, row) where (0,0) is the top-left of the grid.
 * Tiles and heights are stored as flat typed arrays for cache-friendliness.
 *
 * Height values range from -50 (deep valley) to +50 (tall hill).
 * Height 0 = ground level.
 */
export class World {
  readonly cols: number;
  readonly rows: number;
  private tiles: Uint8Array;
  private heights: Int16Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows);
    this.heights = new Int16Array(cols * rows);

    // Height map: 4-octave Perlin fBm → natural-looking terrain in [-10, +10]
    const noise = makePerlin(0xdecafbad);
    const SCALE = 0.07; // world units per tile — larger = steeper, more frequent hills
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const n = fbm(noise, c * SCALE, r * SCALE, 4);
        this.heights[r * cols + c] = Math.round(n * 50);
      }
    }

    // Tile types
    const rng = makeRng(0xdeadbeef);
    for (let i = 0; i < this.tiles.length; i++) {
      if (rng() < TREE_DENSITY) {
        const r = rng();
        this.tiles[i] = r < 0.33
          ? TileType.TreeShort
          : r < 0.66
            ? TileType.TreeMedium
            : TileType.TreeTall;
      }
    }
  }

  getTile(col: number, row: number): TileType {
    return this.tiles[row * this.cols + col] as TileType;
  }

  setTile(col: number, row: number, type: TileType): void {
    this.tiles[row * this.cols + col] = type;
  }

  /** Height at (col, row) in range [-10, +10]. 0 = ground level. */
  getHeight(col: number, row: number): number {
    return this.heights[row * this.cols + col]!;
  }
}
