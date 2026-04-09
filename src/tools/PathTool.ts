import type { MouseTool, TileCoord, ToolContext } from '../input/MouseTool';
import type { World } from '../world/World';
import { PathType } from '../world/Path';

/**
 * Path-painting mouse tool.
 *
 * - Hover over a tile to highlight it.
 * - Click a tile to toggle a path on/off.
 * - Drag to paint (or erase) a continuous run of tiles.
 *
 * The paint value (place or erase) is decided on mouse-down and kept for the
 * entire drag so a single stroke stays consistent.
 */
export class PathTool implements MouseTool {
  readonly cursor = 'crosshair';

  /** Currently hovered tile — read by Game to drive the IsoRenderer highlight. */
  hoveredTile: TileCoord | null = null;

  private painting    = false;
  /** PathType.None = erase stroke, anything else = place stroke. */
  private paintValue: PathType = PathType.None;

  constructor(
    private readonly world: World,
    private readonly pathType: PathType,
    /** Called whenever a tile path changes so geometry can be rebuilt. */
    private readonly onWorldChange: () => void,
  ) {}

  onMove(ctx: ToolContext): void {
    this.hoveredTile = ctx.tile;

    if (this.painting && ctx.tile) {
      const { col, row } = ctx.tile;
      if (this.world.getPath(col, row) !== this.paintValue) {
        this.world.setPath(col, row, this.paintValue);
        this.onWorldChange();
      }
    }
  }

  onDown(ctx: ToolContext): void {
    if (!ctx.tile) return;
    const { col, row } = ctx.tile;
    // Toggle: if the clicked tile already has this path type, erase; otherwise place.
    this.paintValue = this.world.getPath(col, row) === this.pathType
      ? PathType.None
      : this.pathType;
    this.painting = true;
    this.world.setPath(col, row, this.paintValue);
    this.onWorldChange();
  }

  onUp(): void {
    this.painting = false;
  }

  onLeave(): void {
    this.hoveredTile = null;
    this.painting    = false;
  }
}
