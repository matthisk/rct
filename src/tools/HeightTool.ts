import type { MouseTool, TileCoord, ToolContext } from '../input/MouseTool';
import type { World } from '../world/World';

/** Canvas pixels of upward drag required to raise a tile by 1 height unit at zoom 1. */
const DRAG_PX_PER_UNIT = 4;

const MIN_HEIGHT = -50;
const MAX_HEIGHT =  50;

/**
 * Height-editing mouse tool.
 *
 * - Hover over a tile to highlight it.
 * - Click and drag up/down to raise or lower the tile.
 *
 * The drag sensitivity is zoom-aware: the tile's visual top edge tracks the
 * cursor at a 1:1 screen-pixel ratio regardless of zoom level.
 */
export class HeightTool implements MouseTool {
  readonly cursor = 'ns-resize';

  /** Currently hovered tile — read by Game to drive the IsoRenderer highlight. */
  hoveredTile: TileCoord | null = null;

  private dragTile:    TileCoord | null = null;
  private dragStartY  = 0;
  private dragStartH  = 0;

  constructor(
    private readonly world: World,
    /** Called whenever a tile height changes so geometry can be rebuilt. */
    private readonly onWorldChange: () => void,
  ) {}

  onMove(ctx: ToolContext): void {
    this.hoveredTile = ctx.tile;

    if (!this.dragTile) return;

    // Upward drag (decreasing canvasY) → positive height delta.
    // Divide by (DRAG_PX_PER_UNIT / zoom) so screen-pixel movement maps 1:1
    // to the visual shift of the tile top regardless of zoom level.
    const pxPerUnit = DRAG_PX_PER_UNIT / ctx.zoom;
    const delta = Math.round(-(ctx.canvasY - this.dragStartY) / pxPerUnit);
    const newH  = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, this.dragStartH + delta));

    if (newH !== this.world.getHeight(this.dragTile.col, this.dragTile.row)) {
      this.world.setHeight(this.dragTile.col, this.dragTile.row, newH);
      this.onWorldChange();
    }
  }

  onDown(ctx: ToolContext): void {
    if (!ctx.tile) return;
    this.dragTile   = ctx.tile;
    this.dragStartY = ctx.canvasY;
    this.dragStartH = this.world.getHeight(ctx.tile.col, ctx.tile.row);
  }

  onUp(): void {
    this.dragTile = null;
  }

  onLeave(): void {
    this.hoveredTile = null;
    this.dragTile    = null;
  }
}
