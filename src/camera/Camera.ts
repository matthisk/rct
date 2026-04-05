// ---------------------------------------------------------------------------
// Zoom levels
// ---------------------------------------------------------------------------

export type ZoomLevel = 'close' | 'medium' | 'far';

/** Ordered from most zoomed-out to most zoomed-in. */
export const ZOOM_LEVELS: readonly ZoomLevel[] = ['far', 'medium', 'close'];

/** Multiplier applied to geometry in the vertex shader. */
const ZOOM_SCALE: Record<ZoomLevel, number> = {
  far:    0.5,
  medium: 1.0,
  close:  1.5,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extra pixels of sky the player is allowed to scroll above the world top. */
const SKY_MARGIN = 50;

function clamp(value: number, min: number, max: number): number {
  // Guard against inverted range (world smaller than viewport at this zoom).
  if (min > max) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/**
 * Camera scroll position + zoom level.
 *
 * (x, y) is the world-space pixel coordinate of the viewport's top-left
 * corner.  The vertex shader applies offset then zooms around the viewport
 * centre, so changing zoom level keeps the centre of the screen anchored.
 *
 * Scroll bounds are recalculated whenever zoom changes because the visible
 * world area — and therefore how far you can scroll — depends on zoom:
 *   visible width  = canvasWidth  / zoom
 *   visible height = canvasHeight / zoom
 */
export class Camera {
  x = 0;
  y = 0;

  private _zoomLevel: ZoomLevel = 'medium';

  private readonly canvasWidth:  number;
  private readonly canvasHeight: number;
  private readonly worldMinX:    number;
  private readonly worldMaxX:    number;
  private readonly worldMinY:    number;
  private readonly worldMaxY:    number;

  constructor(
    canvasWidth:  number,
    canvasHeight: number,
    worldMinX: number,
    worldMaxX: number,
    worldMinY: number,
    worldMaxY: number,
  ) {
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.worldMinX    = worldMinX;
    this.worldMaxX    = worldMaxX;
    this.worldMinY    = worldMinY;
    this.worldMaxY    = worldMaxY;
  }

  get zoomLevel(): ZoomLevel { return this._zoomLevel; }
  get zoom(): number         { return ZOOM_SCALE[this._zoomLevel]; }

  /**
   * Move the camera by (dx, dy) world-space pixels, clamped to bounds.
   * Pass world-space deltas; the caller is responsible for dividing screen-
   * space deltas by the current zoom to get a consistent screen-pixel speed.
   */
  pan(dx: number, dy: number): void {
    const { minX, maxX, minY, maxY } = this.scrollBounds();
    this.x = clamp(this.x + dx, minX, maxX);
    this.y = clamp(this.y + dy, minY, maxY);
  }

  /** Step one level closer.  Returns false if already at maximum zoom. */
  zoomIn(): boolean {
    const idx = ZOOM_LEVELS.indexOf(this._zoomLevel);
    if (idx >= ZOOM_LEVELS.length - 1) return false;
    this._zoomLevel = ZOOM_LEVELS[idx + 1]!;
    this.reclamp();
    return true;
  }

  /** Step one level further out.  Returns false if already at minimum zoom. */
  zoomOut(): boolean {
    const idx = ZOOM_LEVELS.indexOf(this._zoomLevel);
    if (idx <= 0) return false;
    this._zoomLevel = ZOOM_LEVELS[idx - 1]!;
    this.reclamp();
    return true;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Compute scroll limits for the current zoom level.
   *
   * At zoom z the visible world span is canvasSize/z.  The viewport centre
   * sits at camera.(x|y) + canvasSize/2, so the edges of the viewport map to:
   *   left  = camera.x + canvasWidth/2  − canvasWidth/(2z)
   *   right = camera.x + canvasWidth/2  + canvasWidth/(2z)
   *
   * Setting left  = worldMinX → minX = worldMinX − canvasWidth/2  + canvasWidth/(2z)
   * Setting right = worldMaxX → maxX = worldMaxX − canvasWidth/2  − canvasWidth/(2z)
   * (and analogously for Y, with an extra SKY_MARGIN on the top edge)
   */
  private scrollBounds() {
    const z   = this.zoom;
    const hw  = this.canvasWidth  / (2 * z);
    const hh  = this.canvasHeight / (2 * z);
    const cw2 = this.canvasWidth  / 2;
    const ch2 = this.canvasHeight / 2;
    return {
      minX: this.worldMinX - cw2 + hw,
      maxX: this.worldMaxX - cw2 - hw,
      minY: this.worldMinY - SKY_MARGIN - ch2 + hh,
      maxY: this.worldMaxY - ch2 - hh,
    };
  }

  private reclamp(): void {
    const { minX, maxX, minY, maxY } = this.scrollBounds();
    this.x = clamp(this.x, minX, maxX);
    this.y = clamp(this.y, minY, maxY);
  }
}
