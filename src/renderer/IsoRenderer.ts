import type { Color } from './Renderer';
import { Renderer } from './Renderer';
import { World } from '../world/World';
import { TileType } from '../world/Tile';
import { makeGrassCanvas } from './grassTexture';

// ---------------------------------------------------------------------------
// Tile geometry constants
// ---------------------------------------------------------------------------

/** Full pixel width of one tile diamond (west → east). */
export const TILE_W = 64;

/** Full pixel height of one tile diamond (north → south). */
export const TILE_H = 32;

const HW = TILE_W / 2; // 32
const HH = TILE_H / 2; // 16

/**
 * Inner diamond scale factor.  The gap between the outer (border) and inner
 * (fill) diamond creates the visible tile grid lines.
 */
const INSET = 0.82;

/** Floats per tile in the border pass: 2 triangles × 3 vertices × 2 coords. */
const BORDER_FLOATS_PER_TILE = 12;

/**
 * Floats per tile in the fill (textured) pass:
 * 2 triangles × 3 vertices × 4 components (x, y, u, v).
 */
const FILL_FLOATS_PER_TILE = 24;

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
 * Write two triangles forming a diamond centered at (cx, cy) directly into
 * a pre-allocated Float32Array starting at `offset`.  Returns the next offset.
 *
 *         N
 *       /   \
 *      W     E
 *       \   /
 *         S
 *
 * Writes 12 floats (x, y) per vertex — for the border (color-only) pass.
 */
function writeDiamond(
  out: Float32Array,
  offset: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): number {
  const nx = cx,      ny = cy - hh;
  const ex = cx + hw, ey = cy;
  const sx = cx,      sy = cy + hh;
  const wx = cx - hw, wy = cy;

  // Triangle 1: N → E → S
  out[offset++] = nx; out[offset++] = ny;
  out[offset++] = ex; out[offset++] = ey;
  out[offset++] = sx; out[offset++] = sy;
  // Triangle 2: N → S → W
  out[offset++] = nx; out[offset++] = ny;
  out[offset++] = sx; out[offset++] = sy;
  out[offset++] = wx; out[offset++] = wy;

  return offset;
}

/**
 * Write two triangles forming a diamond with interleaved x, y, u, v data —
 * for the textured fill pass.  Writes 24 floats (4 per vertex).
 *
 * UV corners: N=(0.5, 0), E=(1, 0.5), S=(0.5, 1), W=(0, 0.5).
 * This maps the diamond shape exactly to the full [0,1]×[0,1] texture space.
 */
function writeFillDiamond(
  out: Float32Array,
  offset: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): number {
  const nx = cx,      ny = cy - hh;
  const ex = cx + hw, ey = cy;
  const sx = cx,      sy = cy + hh;
  const wx = cx - hw, wy = cy;

  // Triangle 1: N → E → S
  out[offset++] = nx; out[offset++] = ny; out[offset++] = 0.5; out[offset++] = 0.0;
  out[offset++] = ex; out[offset++] = ey; out[offset++] = 1.0; out[offset++] = 0.5;
  out[offset++] = sx; out[offset++] = sy; out[offset++] = 0.5; out[offset++] = 1.0;
  // Triangle 2: N → S → W
  out[offset++] = nx; out[offset++] = ny; out[offset++] = 0.5; out[offset++] = 0.0;
  out[offset++] = sx; out[offset++] = sy; out[offset++] = 0.5; out[offset++] = 1.0;
  out[offset++] = wx; out[offset++] = wy; out[offset++] = 0.0; out[offset++] = 0.5;

  return offset;
}

// ---------------------------------------------------------------------------
// IsoRenderer
// ---------------------------------------------------------------------------

/**
 * Converts tile-grid coordinates to screen coordinates and renders the world
 * using the painter's algorithm (back row first → front row last).
 *
 * The screen origin is the N-vertex of tile (0, 0).  For worlds larger than
 * the viewport the origin is positioned so the top of the grid is near the
 * top-centre of the canvas; the camera system will offset from here.
 *
 * Tile (col, row) → screen N-vertex:
 *   screenX = originX + (col − row) × HW
 *   screenY = originY + (col + row) × HH
 */
export class IsoRenderer {
  readonly originX: number;
  readonly originY: number;

  private readonly worldCols: number;
  private readonly worldRows: number;

  // Pre-allocated geometry buffers — one per pass, sized for the whole world.
  private borderVerts: Float32Array;
  private fillVerts: Float32Array;

  // Vertex counts written into the buffers on the last rebuild.
  private borderVertexCount = 0;
  private fillVertexCount   = 0;

  // Grass texture, created lazily on the first render() call.
  private grassTexture: WebGLTexture | null = null;

  // When true the buffers are rebuilt before the next draw.
  private dirty = true;

  constructor(
    canvasWidth: number,
    canvasHeight: number,
    worldCols: number,
    worldRows: number,
  ) {
    this.worldCols = worldCols;
    this.worldRows = worldRows;

    // For worlds that fit inside the viewport, centre them.
    // For worlds larger than the viewport, show the top of the grid centered
    // horizontally — the camera system will let the player scroll.
    const gridW = (worldCols + worldRows) * HW;
    const gridH = (worldCols + worldRows) * HH;

    if (gridW <= canvasWidth) {
      this.originX = Math.round((canvasWidth - gridW) / 2 + worldRows * HW);
    } else {
      this.originX = Math.round(canvasWidth / 2);
    }

    if (gridH <= canvasHeight) {
      this.originY = Math.round((canvasHeight - gridH) / 2);
    } else {
      this.originY = 40; // small top margin; camera scrolling will shift this
    }

    const tileCount = worldCols * worldRows;
    this.borderVerts = new Float32Array(tileCount * BORDER_FLOATS_PER_TILE);
    this.fillVerts   = new Float32Array(tileCount * FILL_FLOATS_PER_TILE);
  }

  /**
   * Bounding box of the world in screen space (without camera offset applied).
   * Used by the camera to compute scroll limits.
   */
  get worldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: this.originX - this.worldRows * HW,
      maxX: this.originX + this.worldCols * HW,
      minY: this.originY,
      maxY: this.originY + (this.worldCols + this.worldRows) * HH,
    };
  }

  /** Convert grid (col, row) to the screen position of the tile's N vertex. */
  tileToScreen(col: number, row: number): { sx: number; sy: number } {
    return {
      sx: this.originX + (col - row) * HW,
      sy: this.originY + (col + row) * HH,
    };
  }

  /** Mark geometry as stale so it is rebuilt before the next draw. */
  invalidate(): void {
    this.dirty = true;
  }

  /**
   * Render the entire world.
   *
   * Geometry is rebuilt only when `dirty` (world changed).
   * Two draw calls total: border (solid color) + fill (textured).
   */
  render(world: World, renderer: Renderer): void {
    // Create the grass texture on first use (requires a live Renderer/GL context).
    if (!this.grassTexture) {
      this.grassTexture = renderer.createTexture(makeGrassCanvas());
    }

    if (this.dirty) {
      this.rebuild(world);
      this.dirty = false;
    }

    renderer.drawTriangles(this.borderVerts, this.borderVertexCount, PALETTE[TileType.Grass].border);
    renderer.drawTexturedTriangles(this.fillVerts, this.fillVertexCount, this.grassTexture);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private rebuild(world: World): void {
    let bi = 0; // border buffer cursor (2 floats per vertex)
    let fi = 0; // fill buffer cursor  (4 floats per vertex)

    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        const { sx, sy } = this.tileToScreen(col, row);
        const cx = sx;
        const cy = sy + HH; // centre of the diamond

        bi = writeDiamond(    this.borderVerts, bi, cx, cy, HW,         HH);
        fi = writeFillDiamond(this.fillVerts,   fi, cx, cy, HW * INSET, HH * INSET);
      }
    }

    this.borderVertexCount = bi / 2; // 2 floats per vertex
    this.fillVertexCount   = fi / 4; // 4 floats per vertex (x,y,u,v)
  }
}
