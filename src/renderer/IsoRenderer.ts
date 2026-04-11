import type { Color } from './Renderer';
import { Renderer } from './Renderer';
import { World } from '../world/World';
import { TileType } from '../world/Tile';
import { PathType } from '../world/Path';
import { AttractionType } from '../world/Attraction';
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
const MAX_HEIGHT = 50;

/** Floats per tile in the border pass: 2 triangles × 3 vertices × 3 components (x, y, depth). */
const BORDER_FLOATS_PER_TILE = 18;

/**
 * Floats per tile in the fill (textured) pass:
 * 2 triangles × 3 vertices × 5 components (x, y, u, v, depth).
 */
const FILL_FLOATS_PER_TILE = 30;

/**
 * Floats per tile in the cliff pass: up to 2 faces (SW + SE) × 18 floats each.
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
const HOVER_FILL:  Color = [1.00, 1.00, 0.30, 0.55]; // semi-transparent yellow highlight

// Footprint hover highlight colors
const FOOTPRINT_VALID:   Color = [0.20, 0.90, 0.20, 0.50]; // green
const FOOTPRINT_INVALID: Color = [0.90, 0.20, 0.20, 0.50]; // red

// Carousel placeholder colors
const CAROUSEL_BASE:     Color = [0.80, 0.78, 0.72, 1.0]; // light concrete base
const CAROUSEL_BODY:     Color = [0.85, 0.25, 0.75, 1.0]; // magenta ride body
const CAROUSEL_SPIRE:    Color = [1.00, 0.82, 0.10, 1.0]; // golden spire

/**
 * Fill colours for each path type.
 *
 * To add a new path type: add a PathType member and a matching entry here.
 */
const PATH_COLORS: Record<PathType, Color | null> = {
  [PathType.None]:     null,
  [PathType.Concrete]: [0.65, 0.63, 0.60, 1.0],
};

/**
 * Fraction of the tile that the path centre diamond covers.
 * Must be < 1 so the underlying grass border remains visible around the path.
 */
const PATH_SCALE = 0.65;

/**
 * Floats per tile in the path pass.
 * Worst case: centre diamond (18) + 4 arm quads × 18 + 4 corner caps × 18 = 162.
 */
const PATH_FLOATS_PER_TILE = 9 * BORDER_FLOATS_PER_TILE; // 162

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
 * Write two triangles forming a flat (depth-less) diamond into `out`.
 * Used only for the hover highlight which is drawn via drawTrianglesFlat.
 * Writes 12 floats (x, y) per vertex.
 */
function writeFlatDiamond(
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

  out[offset++] = nx; out[offset++] = ny;
  out[offset++] = ex; out[offset++] = ey;
  out[offset++] = sx; out[offset++] = sy;
  out[offset++] = nx; out[offset++] = ny;
  out[offset++] = sx; out[offset++] = sy;
  out[offset++] = wx; out[offset++] = wy;

  return offset;
}

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
 * Writes 18 floats (x, y, depth) per vertex — for the border (color-only) pass.
 */
function writeDiamond(
  out: Float32Array,
  offset: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  depth: number,
): number {
  const nx = cx,      ny = cy - hh;
  const ex = cx + hw, ey = cy;
  const sx = cx,      sy = cy + hh;
  const wx = cx - hw, wy = cy;

  // Triangle 1: N → E → S
  out[offset++] = nx; out[offset++] = ny; out[offset++] = depth;
  out[offset++] = ex; out[offset++] = ey; out[offset++] = depth;
  out[offset++] = sx; out[offset++] = sy; out[offset++] = depth;
  // Triangle 2: N → S → W
  out[offset++] = nx; out[offset++] = ny; out[offset++] = depth;
  out[offset++] = sx; out[offset++] = sy; out[offset++] = depth;
  out[offset++] = wx; out[offset++] = wy; out[offset++] = depth;

  return offset;
}

/**
 * Write a quadrilateral (2 triangles, 18 floats) from four corners into `out`.
 * Winding: TL → TR → BR (triangle 1), TL → BR → BL (triangle 2).
 */
function writeQuad(
  out: Float32Array, offset: number,
  tlx: number, tly: number,
  trx: number, try_: number,
  brx: number, bry: number,
  blx: number, bly: number,
  depth: number,
): number {
  out[offset++] = tlx; out[offset++] = tly; out[offset++] = depth;
  out[offset++] = trx; out[offset++] = try_; out[offset++] = depth;
  out[offset++] = brx; out[offset++] = bry; out[offset++] = depth;
  out[offset++] = tlx; out[offset++] = tly; out[offset++] = depth;
  out[offset++] = brx; out[offset++] = bry; out[offset++] = depth;
  out[offset++] = blx; out[offset++] = bly; out[offset++] = depth;
  return offset;
}

/**
 * Write a rectangle (2 triangles, 18 floats) directly into `out`.
 * Used to batch trunk geometry without per-tile draw calls.
 */
function writeRect(
  out: Float32Array,
  offset: number,
  x: number, y: number,
  w: number, h: number,
  depth: number,
): number {
  const x1 = x, x2 = x + w;
  const y1 = y, y2 = y + h;
  out[offset++] = x1; out[offset++] = y1; out[offset++] = depth;
  out[offset++] = x2; out[offset++] = y1; out[offset++] = depth;
  out[offset++] = x1; out[offset++] = y2; out[offset++] = depth;
  out[offset++] = x1; out[offset++] = y2; out[offset++] = depth;
  out[offset++] = x2; out[offset++] = y1; out[offset++] = depth;
  out[offset++] = x2; out[offset++] = y2; out[offset++] = depth;
  return offset;
}

/**
 * Write two triangles forming a diamond with interleaved x, y, u, v, depth data —
 * for the textured fill pass.  Writes 30 floats (5 per vertex).
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
  depth: number,
): number {
  const nx = cx,      ny = cy - hh;
  const ex = cx + hw, ey = cy;
  const sx = cx,      sy = cy + hh;
  const wx = cx - hw, wy = cy;

  // Triangle 1: N → E → S
  out[offset++] = nx; out[offset++] = ny; out[offset++] = 0.5; out[offset++] = 0.0; out[offset++] = depth;
  out[offset++] = ex; out[offset++] = ey; out[offset++] = 1.0; out[offset++] = 0.5; out[offset++] = depth;
  out[offset++] = sx; out[offset++] = sy; out[offset++] = 0.5; out[offset++] = 1.0; out[offset++] = depth;
  // Triangle 2: N → S → W
  out[offset++] = nx; out[offset++] = ny; out[offset++] = 0.5; out[offset++] = 0.0; out[offset++] = depth;
  out[offset++] = sx; out[offset++] = sy; out[offset++] = 0.5; out[offset++] = 1.0; out[offset++] = depth;
  out[offset++] = wx; out[offset++] = wy; out[offset++] = 0.0; out[offset++] = 0.5; out[offset++] = depth;

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

  private readonly canvasWidth:  number;
  private readonly canvasHeight: number;
  private readonly worldCols: number;
  private readonly worldRows: number;

  // Single-tile hover-highlight state.
  private hoverCol = -1;
  private hoverRow = -1;
  private readonly hoverVerts = new Float32Array(12); // one diamond, 6 vertices

  // Multi-tile footprint hover-highlight state (for attraction placement preview).
  private hoverFootprintActive = false;
  private hoverFootprintCol    = 0;
  private hoverFootprintRow    = 0;
  private hoverFootprintSize   = 1;
  private hoverFootprintValid  = false;
  /** Pre-allocated for a 3×3 = 9-tile footprint (9 × 12 floats). */
  private readonly hoverFootprintVerts = new Float32Array(9 * 12);

  // Pre-allocated geometry buffers — one per pass, sized for the whole world.
  private borderVerts:     Float32Array;
  private fillVerts:       Float32Array;
  private cliffVerts:      Float32Array;
  private treeTrunkVerts:  Float32Array;
  private treeCanopyVerts: Float32Array;
  /** One buffer per path type (index = PathType value).  Index 0 (None) unused. */
  private pathVerts: Float32Array[];

  // Attraction geometry — three colour passes: base platform, ride body, spire.
  private attractionBaseVerts:  Float32Array = new Float32Array(0);
  private attractionBodyVerts:  Float32Array = new Float32Array(0);
  private attractionSpireVerts: Float32Array = new Float32Array(0);

  // Vertex counts written into the buffers on the last rebuild.
  private borderVertexCount        = 0;
  private fillVertexCount          = 0;
  private cliffVertexCount         = 0;
  private treeTrunkVertexCount     = 0;
  private treeCanopyVertexCount    = 0;
  private pathVertexCounts: number[] = [];
  private attractionBaseVertexCount  = 0;
  private attractionBodyVertexCount  = 0;
  private attractionSpireVertexCount = 0;

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
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;
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
    // Path buffers: one per PathType (index = enum value; index 0 = None, unused).
    this.pathVerts        = Object.keys(PATH_COLORS).map(() =>
      new Float32Array(tileCount * PATH_FLOATS_PER_TILE),
    );
    this.pathVertexCounts = Object.keys(PATH_COLORS).map(() => 0);

    // Attraction buffers — worst case: every 3×3 block is an attraction.
    // Each attraction uses: base (9 diamonds × 18 floats = 162) +
    //   body (1 diamond × 18 = 18) + spire (1 rect × 18 = 18) = 198 floats.
    const maxAttractions = Math.ceil(tileCount / 9);
    this.attractionBaseVerts  = new Float32Array(maxAttractions * 162);
    this.attractionBodyVerts  = new Float32Array(maxAttractions *  18);
    this.attractionSpireVerts = new Float32Array(maxAttractions *  18);
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
   * Convert a canvas-pixel position to a grid tile coordinate.
   *
   * Uses the inverse isometric formula on a flat (height-0) grid — accurate
   * enough for pointer input on moderately sloped terrain.
   *
   * Returns null when the position is outside the grid bounds.
   */
  canvasToTile(
    canvasX: number, canvasY: number,
    cameraX: number, cameraY: number,
    zoom: number,
  ): { col: number; row: number } | null {
    // Undo the shader transform: screenPos = (worldPos − offset − centre)×zoom + centre
    // ⟹  worldPos = (screenPos − centre)/zoom + centre + offset
    const cx = this.canvasWidth  / 2;
    const cy = this.canvasHeight / 2;
    const wx = (canvasX - cx) / zoom + cx + cameraX;
    const wy = (canvasY - cy) / zoom + cy + cameraY;

    // Inverse isometric: tile centre is at (originX + (col−row)×HW,  originY+HH + (col+row)×HH)
    const a = (wx - this.originX)        / HW; // col − row
    const b = (wy - this.originY - HH)   / HH; // col + row

    const col = Math.round((a + b) / 2);
    const row = Math.round((b - a) / 2);

    if (col < 0 || col >= this.worldCols || row < 0 || row >= this.worldRows) return null;
    return { col, row };
  }

  /** Highlight the tile at (col, row) on the next render. */
  setHoveredTile(col: number, row: number): void {
    this.hoverCol = col;
    this.hoverRow = row;
  }

  /** Remove the tile highlight. */
  clearHoveredTile(): void {
    this.hoverCol = -1;
  }

  /**
   * Show a multi-tile footprint preview centred at (col, row).
   *
   * @param valid  When true the highlight is green (placement allowed);
   *               when false it is red (placement blocked).
   */
  setHoveredFootprint(col: number, row: number, size: number, valid: boolean): void {
    this.hoverFootprintActive = true;
    this.hoverFootprintCol    = col;
    this.hoverFootprintRow    = row;
    this.hoverFootprintSize   = size;
    this.hoverFootprintValid  = valid;
  }

  /** Remove the footprint preview. */
  clearHoveredFootprint(): void {
    this.hoverFootprintActive = false;
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

    // Path surfaces — one draw call per path type that has geometry this frame.
    for (let pt = 1; pt < this.pathVerts.length; pt++) {
      const count = this.pathVertexCounts[pt] ?? 0;
      if (count > 0) {
        const color = PATH_COLORS[pt as PathType];
        if (color) renderer.drawTriangles(this.pathVerts[pt]!, count, color);
      }
    }

    renderer.drawTriangles(this.treeTrunkVerts,  this.treeTrunkVertexCount,  TREE_TRUNK);
    renderer.drawTriangles(this.treeCanopyVerts, this.treeCanopyVertexCount, TREE_CANOPY);

    // Attraction structures — drawn after trees so they appear in front.
    if (this.attractionBaseVertexCount  > 0)
      renderer.drawTriangles(this.attractionBaseVerts,  this.attractionBaseVertexCount,  CAROUSEL_BASE);
    if (this.attractionBodyVertexCount  > 0)
      renderer.drawTriangles(this.attractionBodyVerts,  this.attractionBodyVertexCount,  CAROUSEL_BODY);
    if (this.attractionSpireVertexCount > 0)
      renderer.drawTriangles(this.attractionSpireVerts, this.attractionSpireVertexCount, CAROUSEL_SPIRE);

    // Single-tile hover highlight — drawn without depth test so it always sits on top.
    if (this.hoverCol >= 0) {
      const { sx, sy } = this.tileToScreen(this.hoverCol, this.hoverRow);
      const hcy = sy + HH - world.getHeight(this.hoverCol, this.hoverRow) * HEIGHT_STEP;
      writeFlatDiamond(this.hoverVerts, 0, sx, hcy, HW * INSET, HH * INSET);
      renderer.drawTrianglesFlat(this.hoverVerts, 6, HOVER_FILL);
    }

    // Multi-tile footprint preview (attraction placement).
    if (this.hoverFootprintActive) {
      const color = this.hoverFootprintValid ? FOOTPRINT_VALID : FOOTPRINT_INVALID;
      const half  = Math.floor(this.hoverFootprintSize / 2);
      let fi2 = 0, vcount = 0;
      for (let dr = -half; dr <= half; dr++) {
        for (let dc = -half; dc <= half; dc++) {
          const tc = this.hoverFootprintCol + dc;
          const tr = this.hoverFootprintRow + dr;
          if (tc < 0 || tc >= this.worldCols || tr < 0 || tr >= this.worldRows) continue;
          const { sx, sy } = this.tileToScreen(tc, tr);
          const hcy = sy + HH - world.getHeight(tc, tr) * HEIGHT_STEP;
          fi2 = writeFlatDiamond(this.hoverFootprintVerts, fi2, sx, hcy, HW * INSET, HH * INSET);
          vcount += 6;
        }
      }
      if (vcount > 0) renderer.drawTrianglesFlat(this.hoverFootprintVerts, vcount, color);
    }
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private rebuild(world: World): void {
    let bi = 0; // border buffer cursor (3 floats/vertex: x,y,depth)
    let fi = 0; // fill buffer cursor   (5 floats/vertex: x,y,u,v,depth)
    let ki = 0; // cliff buffer cursor  (3 floats/vertex)
    let ti = 0; // trunk buffer cursor  (3 floats/vertex)
    let ci = 0; // canopy buffer cursor (3 floats/vertex)

    // Path cursors — one per PathType entry (index 0 = None, always 0).
    const pi: number[] = this.pathVerts.map(() => 0);

    const maxDepth = this.worldCols + this.worldRows;

    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        const { sx, sy } = this.tileToScreen(col, row);
        const cx = sx;
        const cy = sy + HH; // unshifted diamond centre

        const h  = world.getHeight(col, row);
        const ys = h * HEIGHT_STEP; // vertical shift in screen px (positive h → up)
        const acy = cy - ys;        // actual centre after height offset

        // Depth: higher (col+row) = closer to viewer = larger a_depth = smaller depth buffer value.
        const tileDepth = (col + row) / maxDepth;
        const treeDepth = (col + row + 0.5) / maxDepth;

        // Top face
        bi = writeDiamond(    this.borderVerts, bi, cx, acy, HW,         HH,         tileDepth);
        fi = writeFillDiamond(this.fillVerts,   fi, cx, acy, HW * INSET, HH * INSET, tileDepth);

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
              tileDepth,
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
              tileDepth,
            );
          }
        }

        // Tree sprite — rooted at the height-adjusted tile centre
        const style = TREE_STYLES[world.getTile(col, row)];
        if (style) {
          ti = writeRect(   this.treeTrunkVerts,  ti, cx - 2, acy - style.trunkH, 4, style.trunkH, treeDepth);
          ci = writeDiamond(this.treeCanopyVerts, ci, cx, acy - style.trunkH - 14, style.hw, style.hh, treeDepth);
        }

        // Path surface — drawn between cliff faces and tree sprites.
        const pathType = world.getPath(col, row);
        if (pathType !== PathType.None) {
          const pBuf = this.pathVerts[pathType];
          if (pBuf) {
            const PF = PATH_SCALE;

            // Precompute which arms are present for reuse in corner caps.
            const hasNW = col > 0           && world.hasPath(col - 1, row);
            const hasNE = row > 0           && world.hasPath(col,     row - 1);
            const hasSE = col + 1 < world.cols && world.hasPath(col + 1, row);
            const hasSW = row + 1 < world.rows && world.hasPath(col,     row + 1);

            // Centre diamond (inset so the surrounding grass border stays visible).
            pi[pathType] = writeDiamond(pBuf, pi[pathType]!, cx, acy, HW * PF, HH * PF, tileDepth);

            // Arm toward NW neighbour (col−1, row) — spans the middle PF of the N→W edge.
            // The arm only covers the central PF-fraction of the shared edge so the
            // border grass remains visible at both ends of the connection.
            if (hasNW) {
              // Edge N→W parameterised 0→1; take the middle PF band.
              const nwP1x = cx - HW * (1 - PF) / 2, nwP1y = acy - HH * (1 + PF) / 2;
              const nwP2x = cx - HW * (1 + PF) / 2, nwP2y = acy - HH * (1 - PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                cx,           acy - HH * PF, // inset N
                nwP1x,        nwP1y,         // edge upper (near N)
                nwP2x,        nwP2y,         // edge lower (near W)
                cx - HW * PF, acy,           // inset W
                tileDepth,
              );
            }

            // Arm toward NE neighbour (col, row−1) — spans the middle PF of the N→E edge.
            if (hasNE) {
              const neP1x = cx + HW * (1 - PF) / 2, neP1y = acy - HH * (1 + PF) / 2;
              const neP2x = cx + HW * (1 + PF) / 2, neP2y = acy - HH * (1 - PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                cx,           acy - HH * PF, // inset N
                neP1x,        neP1y,         // edge upper (near N)
                neP2x,        neP2y,         // edge lower (near E)
                cx + HW * PF, acy,           // inset E
                tileDepth,
              );
            }

            // Arm toward SE neighbour (col+1, row) — spans the middle PF of the E→S edge.
            if (hasSE) {
              const seP1x = cx + HW * (1 + PF) / 2, seP1y = acy + HH * (1 - PF) / 2;
              const seP2x = cx + HW * (1 - PF) / 2, seP2y = acy + HH * (1 + PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                cx + HW * PF, acy,           // inset E
                seP1x,        seP1y,         // edge upper (near E)
                seP2x,        seP2y,         // edge lower (near S)
                cx,           acy + HH * PF, // inset S
                tileDepth,
              );
            }

            // Arm toward SW neighbour (col, row+1) — spans the middle PF of the W→S edge.
            if (hasSW) {
              const swP1x = cx - HW * (1 + PF) / 2, swP1y = acy + HH * (1 - PF) / 2;
              const swP2x = cx - HW * (1 - PF) / 2, swP2y = acy + HH * (1 + PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                cx - HW * PF, acy,           // inset W
                swP1x,        swP1y,         // edge upper (near W)
                swP2x,        swP2y,         // edge lower (near S)
                cx,           acy + HH * PF, // inset S
                tileDepth,
              );
            }

            // Corner caps — fill the small diamond gap at each tile vertex where
            // two arms meet AND the diagonal 4th tile also has a path (completing
            // the 2×2 block).  Without the diagonal check, an L-shaped path would
            // incorrectly fill the corner vertex gap.

            // N vertex cap (NW + NE arms both present, diagonal (col-1,row-1) has path)
            if (hasNW && hasNE && col > 0 && row > 0 && world.hasPath(col - 1, row - 1)) {
              const capX = HW * (1 - PF) / 2;
              const capY = acy - HH * (1 + PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                cx,           acy - HH,      // N_full  (TL)
                cx + capX,    capY,           // p1_NE   (TR)
                cx,           acy - HH * PF, // inset_N (BR)
                cx - capX,    capY,           // p1_NW   (BL)
                tileDepth,
              );
            }

            // E vertex cap (NE + SE arms both present, diagonal (col+1,row-1) has path)
            if (hasNE && hasSE && col + 1 < world.cols && row > 0 && world.hasPath(col + 1, row - 1)) {
              const capY = HH * (1 - PF) / 2;
              const capX = cx + HW * (1 + PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                capX,         acy - capY,    // p2_NE   (TL)
                cx + HW,      acy,           // E_full  (TR)
                capX,         acy + capY,    // p1_SE   (BR)
                cx + HW * PF, acy,           // inset_E (BL)
                tileDepth,
              );
            }

            // S vertex cap (SE + SW arms both present, diagonal (col+1,row+1) has path)
            if (hasSE && hasSW && col + 1 < world.cols && row + 1 < world.rows && world.hasPath(col + 1, row + 1)) {
              const capX = HW * (1 - PF) / 2;
              const capY = acy + HH * (1 + PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                cx,           acy + HH * PF, // inset_S (TL)
                cx + capX,    capY,           // p2_SE   (TR)
                cx,           acy + HH,      // S_full  (BR)
                cx - capX,    capY,           // p2_SW   (BL)
                tileDepth,
              );
            }

            // W vertex cap (NW + SW arms both present, diagonal (col-1,row+1) has path)
            if (hasNW && hasSW && col > 0 && row + 1 < world.rows && world.hasPath(col - 1, row + 1)) {
              const capY = HH * (1 - PF) / 2;
              const capX = cx - HW * (1 + PF) / 2;
              pi[pathType] = writeQuad(pBuf, pi[pathType]!,
                capX,         acy - capY,    // p2_NW   (TL)
                cx - HW * PF, acy,           // inset_W (TR)
                capX,         acy + capY,    // p1_SW   (BR)
                cx - HW,      acy,           // W_full  (BL)
                tileDepth,
              );
            }
          }
        }
      }
    }

    this.borderVertexCount     = bi / 3;
    this.fillVertexCount       = fi / 5;
    this.cliffVertexCount      = ki / 3;
    this.treeTrunkVertexCount  = ti / 3;
    this.treeCanopyVertexCount = ci / 3;
    for (let pt = 1; pt < this.pathVerts.length; pt++) {
      this.pathVertexCounts[pt] = (pi[pt] ?? 0) / 3;
    }

    // -----------------------------------------------------------------------
    // Attraction geometry
    // -----------------------------------------------------------------------

    let ai  = 0; // attractionBaseVerts cursor
    let abi = 0; // attractionBodyVerts cursor
    let asi = 0; // attractionSpireVerts cursor

    for (const attr of world.getAttractions()) {
      const { col, row } = attr;
      const { sx, sy } = this.tileToScreen(col, row);
      const cx  = sx;
      const cy  = sy + HH;
      const h   = world.getHeight(col, row);
      const acy = cy - h * HEIGHT_STEP;

      // Depth: render in front of the frontmost tile of the 3×3 footprint.
      const attrDepth  = (col + row + 3) / maxDepth;
      const spireDepth = (col + row + 4) / maxDepth;

      // --- Base platform: a flat diamond covering the whole 3×3 footprint ---
      // The outer boundary of a 3×3 iso footprint centred at (col, row) is a
      // diamond with half-widths 3×HW and 3×HH; scale it down slightly.
      ai = writeDiamond(this.attractionBaseVerts, ai, cx, acy, HW * 2.8, HH * 2.8, attrDepth);

      // --- Ride body: a raised diamond canopy above the centre ---
      const canopyElevation = 28; // pixels above ground
      const canopyHW        = HW * 1.1;
      const canopyHH        = HH * 1.1;
      abi = writeDiamond(
        this.attractionBodyVerts, abi,
        cx, acy - canopyElevation,
        canopyHW, canopyHH,
        attrDepth,
      );

      // --- Central pole ---
      abi = writeRect(
        this.attractionBodyVerts, abi,
        cx - 2, acy - canopyElevation, 4, canopyElevation,
        attrDepth,
      );

      // --- Spire: thin rect rising from the canopy peak ---
      asi = writeRect(
        this.attractionSpireVerts, asi,
        cx - 2, acy - canopyElevation - 12, 4, 14,
        spireDepth,
      );

      // Suppress unused-variable warning for attraction type (future variants).
      void (attr.type === AttractionType.Carousel);
    }

    this.attractionBaseVertexCount  = ai  / 3;
    this.attractionBodyVertexCount  = abi / 3;
    this.attractionSpireVertexCount = asi / 3;
  }
}
