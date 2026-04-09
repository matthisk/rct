// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface TileCoord {
  col: number;
  row: number;
}

/**
 * Context passed to every tool event handler.
 * Coordinates are in canvas-pixel space (origin = top-left of canvas).
 */
export interface ToolContext {
  canvasX: number;
  canvasY: number;
  /** Tile under the cursor, or null when off the grid. */
  tile: TileCoord | null;
  /** Current camera zoom — lets tools scale drag deltas correctly. */
  zoom: number;
}

// ---------------------------------------------------------------------------
// MouseTool interface
// ---------------------------------------------------------------------------

/**
 * A mouse tool handles pointer input for one interaction mode.
 *
 * The MouseManager dispatches canvas events to the active tool and applies
 * its `cursor` to the canvas element.  To add a new tool:
 *   1. Implement this interface.
 *   2. Instantiate the tool and hand it to `mouseManager.setTool()`.
 *
 * All methods are optional except `cursor` — provide only the handlers your
 * tool cares about.
 */
export interface MouseTool {
  /** CSS cursor value shown while this tool is active. */
  readonly cursor: string;
  onMove?(ctx: ToolContext): void;
  onDown?(ctx: ToolContext): void;
  onUp?(ctx: ToolContext): void;
  /** Called when the pointer leaves the canvas or focus is lost. */
  onLeave?(): void;
}
