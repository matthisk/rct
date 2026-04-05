import type { Color } from './Renderer';
import { Renderer } from './Renderer';
import { World } from '../world/World';
import { TileType } from '../world/Tile';

// ---------------------------------------------------------------------------
// Tile geometry constants
// ---------------------------------------------------------------------------

/** Full pixel width of one tile diamond (west → east). */
export const TILE_W = 64;

/** Full pixel height of one tile diamond (north → south). */
export const TILE_H = 32;

const HW = TILE_W / 2; // half-width  = 32
const HH = TILE_H / 2; // half-height = 16

/**
 * How much the inner (fill) diamond is scaled relative to the outer (border)
 * diamond.  The gap between them creates the visible tile border.
 */
const INSET = 0.82;

// ---------------------------------------------------------------------------
// Per-tile-type colour palette
// ---------------------------------------------------------------------------

type TilePalette = { border: Color; fill: Color };

const PALETTE: Record<TileType, TilePalette> = {
  [TileType.Grass]: {
    border: [0.18, 0.42, 0.07, 1.0],
    fill:   [0.40, 0.72, 0.17, 1.0],
  },
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Append two triangles forming a diamond (rhombus) centered at (cx, cy)
 * with given half-widths into the flat vertex output array.
 *
 *         N
 *       /   \
 *      W     E
 *       \   /
 *         S
 */
function pushDiamond(
  out: number[],
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): void {
  const nx = cx,      ny = cy - hh;
  const ex = cx + hw, ey = cy;
  const sx = cx,      sy = cy + hh;
  const wx = cx - hw, wy = cy;

  // Triangle 1: N → E → S
  out.push(nx, ny, ex, ey, sx, sy);
  // Triangle 2: N → S → W
  out.push(nx, ny, sx, sy, wx, wy);
}

// ---------------------------------------------------------------------------
// IsoRenderer
// ---------------------------------------------------------------------------

/**
 * Converts tile-grid coordinates to screen coordinates and renders the world
 * using the painter's algorithm (back row first → front row last).
 *
 * Screen origin is the N-vertex of tile (0, 0).  The grid is centred
 * horizontally and vertically within the canvas.
 *
 * Tile (col, row) → screen top-vertex:
 *   screenX = originX + (col − row) × HW
 *   screenY = originY + (col + row) × HH
 */
export class IsoRenderer {
  private originX: number;
  private originY: number;

  constructor(
    canvasWidth: number,
    canvasHeight: number,
    worldCols: number,
    worldRows: number,
  ) {
    // The total screen span of the grid:
    //   width  = (cols + rows) × HW
    //   height = (cols + rows) × HH
    // We centre that span inside the canvas.
    const gridW = (worldCols + worldRows) * HW;
    const gridH = (worldCols + worldRows) * HH;
    this.originX = Math.round((canvasWidth - gridW) / 2 + worldRows * HW);
    this.originY = Math.round((canvasHeight - gridH) / 2);
  }

  /** Convert grid (col, row) to the screen position of the tile's N vertex. */
  tileToScreen(col: number, row: number): { sx: number; sy: number } {
    return {
      sx: this.originX + (col - row) * HW,
      sy: this.originY + (col + row) * HH,
    };
  }

  /**
   * Render the entire world.
   *
   * Geometry is batched per tile type (border pass + fill pass), resulting in
   * 2 × N_tile_types draw calls regardless of grid size.
   */
  render(world: World, renderer: Renderer): void {
    // Collect geometry per tile type so we can issue one draw call per colour.
    const borderBatch = new Map<TileType, number[]>();
    const fillBatch   = new Map<TileType, number[]>();

    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        const type = world.getTile(col, row);
        const { sx, sy } = this.tileToScreen(col, row);
        const cx = sx;
        const cy = sy + HH; // centre of the diamond

        if (!borderBatch.has(type)) borderBatch.set(type, []);
        if (!fillBatch.has(type))   fillBatch.set(type, []);

        pushDiamond(borderBatch.get(type)!, cx, cy, HW, HH);
        pushDiamond(fillBatch.get(type)!,   cx, cy, HW * INSET, HH * INSET);
      }
    }

    // Draw border pass (all tile types), then fill pass — 2 draw calls each.
    for (const [type, verts] of borderBatch) {
      renderer.drawTriangles(verts, PALETTE[type].border);
    }
    for (const [type, verts] of fillBatch) {
      renderer.drawTriangles(verts, PALETTE[type].fill);
    }
  }
}
