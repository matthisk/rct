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

/** Screen pixels of vertical shift per height unit. */
const HEIGHT_STEP = 4;

/** Maximum height value — used to size the cliff buffer. */
const MAX_HEIGHT = 10;

/** Floats per tile in the border pass: 2 triangles × 3 vertices × 2 coords. */
const BORDER_FLOATS_PER_TILE = 12;

/**
 * Floats per tile in the fill (textured) pass:
 * 2 triangles × 3 vertices × 4 components (x, y, u, v).
 */
const FILL_FLOATS_PER_TILE = 24;

/**
 * Floats per tile in the cliff pass: up to 2 faces (SW + SE) × 12 floats each.
 * Worst case = every tile has both cliff faces.
 */
const CLIFF_FLOATS_PER_TILE = 2 * BORDER_FLOATS_PER_TILE;

// ---------------------------------------------------------------------------
// Per-tile-type colour palette
// ---------------------------------------------------------------------------

type TilePalette = { border: Color; fill: Color };

const GRASS_BASE: TilePalette = {
  border: [0.18, 0.42, 0.07, 1.0],
  fill:   [0.40, 0.72, 0.17, 1.0],
};

// All tile types share the same grass base; tree sprites are drawn on top.
const PALETTE: Record<TileType, TilePalette> = {
  [TileType.Grass]:      GRASS_BASE,
  [TileType.TreeShort]:  GRASS_BASE,
  [TileType.TreeMedium]: GRASS_BASE,
  [TileType.TreeTall]:   GRASS_BASE,
};

const TREE_TRUNK:  Color = [0.45, 0.28, 0.05, 1.0];
const TREE_CANOPY: Color = [0.13, 0.55, 0.07, 1.0];
const EARTH:       Color = [0.55, 0.37, 0.15, 1.0]; // brown cliff / earth side

/** Visual dimensions for each tree style. */
const TREE_STYLES: Partial<Record<TileType, { trunkH: number; hw: number; hh: number }>> = {
  [TileType.TreeShort]:  { trunkH:  6, hw: 12, hh: 10 },
  [TileType.TreeMedium]: { trunkH: 12, hw: 18, hh: 14 },
  [TileType.TreeTall]:   { trunkH: 20, hw: 22, hh: 18 },
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
 * Write a quadrilateral (2 triangles, 12 floats) from four corners into `out`.
 * Winding: TL → TR → BR (triangle 1), TL → BR → BL (triangle 2).
 */
function writeQuad(
  out: Float32Array, offset: number,
  tlx: number, tly: number,
  trx: number, try_: number,
  brx: number, bry: number,
  blx: number, bly: number,
): number {
  out[offset++] = tlx; out[offset++] = tly;
  out[offset++] = trx; out[offset++] = try_;
  out[offset++] = brx; out[offset++] = bry;
  out[offset++] = tlx; out[offset++] = tly;
  out[offset++] = brx; out[offset++] = bry;
  out[offset++] = blx; out[offset++] = bly;
  return offset;
}

/**
 * Write a rectangle (2 triangles, 12 floats) directly into `out`.
 * Used to batch trunk geometry without per-tile draw calls.
 */
function writeRect(
  out: Float32Array,
  offset: number,
  x: number, y: number,
  w: number, h: number,
): number {
  const x1 = x, x2 = x + w;
  const y1 = y, y2 = y + h;
  out[offset++] = x1; out[offset++] = y1;
  out[offset++] = x2; out[offset++] = y1;
  out[offset++] = x1; out[offset++] = y2;
  out[offset++] = x1; out[offset++] = y2;
  out[offset++] = x2; out[offset++] = y1;
  out[offset++] = x2; out[offset++] = y2;
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
  private borderVerts:     Float32Array;
  private fillVerts:       Float32Array;
  private cliffVerts:      Float32Array;
  private treeTrunkVerts:  Float32Array;
  private treeCanopyVerts: Float32Array;

  // Vertex counts written into the buffers on the last rebuild.
  private borderVertexCount     = 0;
  private fillVertexCount       = 0;
  private cliffVertexCount      = 0;
  private treeTrunkVertexCount  = 0;
  private treeCanopyVertexCount = 0;

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
    this.borderVerts     = new Float32Array(tileCount * BORDER_FLOATS_PER_TILE);
    this.fillVerts       = new Float32Array(tileCount * FILL_FLOATS_PER_TILE);
    // Cliff buffer: up to 2 faces per tile (SW + SE), each 12 floats.
    this.cliffVerts      = new Float32Array(tileCount * CLIFF_FLOATS_PER_TILE);
    // Tree buffers: worst case every tile is a tree (2 triangles = 12 floats each).
    this.treeTrunkVerts  = new Float32Array(tileCount * BORDER_FLOATS_PER_TILE);
    this.treeCanopyVerts = new Float32Array(tileCount * BORDER_FLOATS_PER_TILE);
  }

  /**
   * Bounding box of the world in screen space (without camera offset applied).
   * Used by the camera to compute scroll limits.
   *
   * minY is expanded upward by the maximum possible height visual offset so
   * tall tiles at the top of the grid remain reachable.
   */
  get worldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: this.originX - this.worldRows * HW,
      maxX: this.originX + this.worldCols * HW,
      minY: this.originY - MAX_HEIGHT * HEIGHT_STEP,
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
   * Four draw calls total: tile borders, tile fills (textured), tree trunks,
   * tree canopies.  Tree sprites are drawn after the ground so they appear
   * on top; the painter's-algorithm row order keeps depth correct.
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

    renderer.drawTriangles(this.borderVerts,     this.borderVertexCount,     PALETTE[TileType.Grass].border);
    renderer.drawTexturedTriangles(this.fillVerts, this.fillVertexCount, this.grassTexture);
    renderer.drawTriangles(this.cliffVerts,      this.cliffVertexCount,      EARTH);
    renderer.drawTriangles(this.treeTrunkVerts,  this.treeTrunkVertexCount,  TREE_TRUNK);
    renderer.drawTriangles(this.treeCanopyVerts, this.treeCanopyVertexCount, TREE_CANOPY);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private rebuild(world: World): void {
    let bi = 0; // border buffer cursor (2 floats/vertex)
    let fi = 0; // fill buffer cursor   (4 floats/vertex, interleaved x,y,u,v)
    let ki = 0; // cliff buffer cursor  (2 floats/vertex)
    let ti = 0; // trunk buffer cursor  (2 floats/vertex)
    let ci = 0; // canopy buffer cursor (2 floats/vertex)

    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        const { sx, sy } = this.tileToScreen(col, row);
        const cx = sx;
        const cy = sy + HH; // unshifted diamond centre

        const h  = world.getHeight(col, row);
        const ys = h * HEIGHT_STEP; // vertical shift in screen px (positive h → up)
        const acy = cy - ys;        // actual centre after height offset

        // Top face
        bi = writeDiamond(    this.borderVerts, bi, cx, acy, HW,         HH);
        fi = writeFillDiamond(this.fillVerts,   fi, cx, acy, HW * INSET, HH * INSET);

        // SW cliff — between this tile (col, row) and its SW neighbour (col, row+1).
        // Visible when this tile is higher; the face drops from h down to h2.
        //
        //   TL = W of this tile  (cx-HW, cy-ys)
        //   TR = S of this tile  (cx,    cy+HH-ys)
        //   BR = E of neighbour  (cx,    cy+HH-ys2)
        //   BL = N of neighbour  (cx-HW, cy-ys2)
        if (row + 1 < world.rows) {
          const h2  = world.getHeight(col, row + 1);
          const ys2 = h2 * HEIGHT_STEP;
          if (h > h2) {
            ki = writeQuad(this.cliffVerts, ki,
              cx - HW, cy - ys,        // TL
              cx,      cy + HH - ys,   // TR
              cx,      cy + HH - ys2,  // BR
              cx - HW, cy - ys2,       // BL
            );
          }
        }

        // SE cliff — between this tile (col, row) and its SE neighbour (col+1, row).
        //
        //   TL = S of this tile  (cx,    cy+HH-ys)
        //   TR = E of this tile  (cx+HW, cy-ys)
        //   BR = N of neighbour  (cx+HW, cy-ys3)
        //   BL = W of neighbour  (cx,    cy+HH-ys3)
        if (col + 1 < world.cols) {
          const h3  = world.getHeight(col + 1, row);
          const ys3 = h3 * HEIGHT_STEP;
          if (h > h3) {
            ki = writeQuad(this.cliffVerts, ki,
              cx,      cy + HH - ys,   // TL
              cx + HW, cy - ys,        // TR
              cx + HW, cy - ys3,       // BR
              cx,      cy + HH - ys3,  // BL
            );
          }
        }

        // Tree sprite — rooted at the height-adjusted tile centre
        const style = TREE_STYLES[world.getTile(col, row)];
        if (style) {
          ti = writeRect(   this.treeTrunkVerts,  ti, cx - 2, acy - style.trunkH, 4, style.trunkH);
          ci = writeDiamond(this.treeCanopyVerts, ci, cx, acy - style.trunkH - 14, style.hw, style.hh);
        }
      }
    }

    this.borderVertexCount     = bi / 2;
    this.fillVertexCount       = fi / 4;
    this.cliffVertexCount      = ki / 2;
    this.treeTrunkVertexCount  = ti / 2;
    this.treeCanopyVertexCount = ci / 2;
  }
}
