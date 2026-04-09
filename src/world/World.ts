import { TileType } from './Tile';
import { PathType } from './Path';
import { makePerlin, fbm } from './perlinNoise';

/** Fraction of tiles that start as trees. */
const TREE_DENSITY = 0.2;

/** Noise frequency: higher = more zoomed-in / broader hills. */
const TERRAIN_SCALE = 0.04;
/** Number of fbm octaves — more = more surface detail. */
const TERRAIN_OCTAVES = 6;
/** Maps the [-1, 1] fbm output to height units [-50, +50]. */
const TERRAIN_AMPLITUDE = 20;

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
  private paths: Uint8Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows);
    this.heights = new Int16Array(cols * rows);
    this.paths = new Uint8Array(cols * rows);

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

    // Heights — fractal Perlin noise for natural-looking terrain
    const noise = makePerlin(0xcafebabe);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const v = fbm(noise, col * TERRAIN_SCALE, row * TERRAIN_SCALE, TERRAIN_OCTAVES);
        this.setHeight(col, row, Math.round(v * TERRAIN_AMPLITUDE));
      }
    }
  }

  getTile(col: number, row: number): TileType {
    return this.tiles[row * this.cols + col] as TileType;
  }

  setTile(col: number, row: number, type: TileType): void {
    this.tiles[row * this.cols + col] = type;
  }

  /** Height at (col, row) in range [-50, +50]. 0 = ground level. */
  getHeight(col: number, row: number): number {
    return this.heights[row * this.cols + col]!;
  }

  /** Set height at (col, row), clamped to [-50, +50]. */
  setHeight(col: number, row: number, height: number): void {
    this.heights[row * this.cols + col] = Math.max(-50, Math.min(50, height));
  }

  /** Return the path type on (col, row).  PathType.None = no path. */
  getPath(col: number, row: number): PathType {
    return this.paths[row * this.cols + col] as PathType;
  }

  /** Place or remove a path on (col, row). */
  setPath(col: number, row: number, type: PathType): void {
    this.paths[row * this.cols + col] = type;
  }

  /** True if (col, row) carries any path surface. */
  hasPath(col: number, row: number): boolean {
    return this.paths[row * this.cols + col] !== PathType.None;
  }
}
