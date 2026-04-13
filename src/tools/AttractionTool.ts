import type { MouseTool, TileCoord, ToolContext } from '../input/MouseTool';
import type { World } from '../world/World';
import { TileType } from '../world/Tile';
import { PathType } from '../world/Path';
import { AttractionType, ATTRACTION_DEFS } from '../world/Attraction';

/**
 * Attraction-placement mouse tool.
 *
 * - Hover over a tile to preview the footprint.
 *   Green highlight = placement is valid (all footprint tiles at the same height).
 *   Red highlight   = placement is invalid.
 * - Click to place the attraction on a valid tile.
 *
 * The hovered tile acts as the centre of the attraction footprint.
 * Placing an attraction clears any trees or paths in its footprint.
 */
export class AttractionTool implements MouseTool {
  readonly cursor = 'cell';

  /** Currently hovered tile (centre of footprint). Read by Game for hover dispatch. */
  hoveredTile: TileCoord | null = null;

  /**
   * Footprint preview state — null when the cursor is off the grid.
   * Read by Game each frame and forwarded to IsoRenderer.setHoveredFootprint.
   */
  footprintHighlight: { col: number; row: number; size: number; valid: boolean } | null = null;

  constructor(
    private readonly world: World,
    private readonly attractionType: AttractionType,
    /** Called after a successful placement so geometry is rebuilt. */
    private readonly onWorldChange: () => void,
  ) {}

  onMove(ctx: ToolContext): void {
    this.hoveredTile = ctx.tile;
    if (!ctx.tile) { this.footprintHighlight = null; return; }
    const { col, row } = ctx.tile;
    const size = ATTRACTION_DEFS[this.attractionType].size;
    this.footprintHighlight = { col, row, size, valid: this.isValid(col, row) };
  }

  onDown(ctx: ToolContext): void {
    if (!ctx.tile) return;
    const { col, row } = ctx.tile;
    if (!this.isValid(col, row)) return;

    const half = Math.floor(ATTRACTION_DEFS[this.attractionType].size / 2);
    for (let dr = -half; dr <= half; dr++) {
      for (let dc = -half; dc <= half; dc++) {
        const tc = col + dc, tr = row + dr;
        this.world.setTile(tc, tr, TileType.Grass);
        if (this.world.hasPath(tc, tr)) this.world.setPath(tc, tr, PathType.None);
      }
    }

    this.world.addAttraction({ type: this.attractionType, col, row });
    this.onWorldChange();
  }

  onLeave(): void {
    this.hoveredTile      = null;
    this.footprintHighlight = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private isValid(centerCol: number, centerRow: number): boolean {
    const half = Math.floor(ATTRACTION_DEFS[this.attractionType].size / 2);
    let refHeight: number | null = null;
    for (let dr = -half; dr <= half; dr++) {
      for (let dc = -half; dc <= half; dc++) {
        const tc = centerCol + dc, tr = centerRow + dr;
        if (tc < 0 || tc >= this.world.cols || tr < 0 || tr >= this.world.rows) return false;
        const h = this.world.getHeight(tc, tr);
        if (refHeight === null) refHeight = h;
        else if (h !== refHeight) return false;
      }
    }
    // Reject if any footprint tile overlaps an existing attraction.
    for (const existing of this.world.getAttractions()) {
      const existingHalf = Math.floor(ATTRACTION_DEFS[existing.type].size / 2);
      for (let dr = -half; dr <= half; dr++) {
        for (let dc = -half; dc <= half; dc++) {
          const tc = centerCol + dc, tr = centerRow + dr;
          if (Math.abs(tc - existing.col) <= existingHalf &&
              Math.abs(tr - existing.row) <= existingHalf) return false;
        }
      }
    }
    return true;
  }
}
