import { TileType } from './Tile';

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

  constructor(cols: number, rows: number, fill: TileType = TileType.Grass) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows).fill(fill);
  }

  getTile(col: number, row: number): TileType {
    return this.tiles[row * this.cols + col] as TileType;
  }

  setTile(col: number, row: number, type: TileType): void {
    this.tiles[row * this.cols + col] = type;
  }
}
