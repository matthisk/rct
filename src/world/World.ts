import { TileType } from './Tile';

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
 * The grid is stored as a flat Uint8Array for cache-friendliness.
 */
export class World {
  readonly cols: number;
  readonly rows: number;
  private tiles: Uint8Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows); // defaults to Grass (0)

    const rng = makeRng(0xdeadbeef);
    for (let i = 0; i < this.tiles.length; i++) {
      if (rng() < TREE_DENSITY) this.tiles[i] = TileType.Tree;
    }
  }

  getTile(col: number, row: number): TileType {
    return this.tiles[row * this.cols + col] as TileType;
  }

  setTile(col: number, row: number, type: TileType): void {
    this.tiles[row * this.cols + col] = type;
  }
}
