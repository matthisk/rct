/**
 * Camera scroll position in screen pixels.
 *
 * (x, y) is the world-space pixel coordinate shown at the top-left corner of
 * the viewport.  The vertex shader subtracts this offset from every vertex so
 * that geometry can be built once in world space and the camera simply shifts
 * the view.
 *
 * Scroll is clamped so the world always remains on-screen:
 *   minX ≤ x ≤ maxX
 *   minY ≤ y ≤ maxY
 */
export class Camera {
  x: number;
  y: number;

  private readonly minX: number;
  private readonly maxX: number;
  private readonly minY: number;
  private readonly maxY: number;

  /**
   * @param canvasWidth   Viewport width in pixels
   * @param canvasHeight  Viewport height in pixels
   * @param worldMinX     Left-most screen X of the world (no camera offset)
   * @param worldMaxX     Right-most screen X of the world
   * @param worldMinY     Top-most screen Y of the world
   * @param worldMaxY     Bottom-most screen Y of the world
   */
  constructor(
    canvasWidth: number,
    canvasHeight: number,
    worldMinX: number,
    worldMaxX: number,
    worldMinY: number,
    worldMaxY: number,
  ) {
    // Clamp so that scrolling cannot move the world entirely off-screen.
    // At minX the left world edge is flush with the left canvas edge.
    // At maxX the right world edge is flush with the right canvas edge.
    this.minX = worldMinX;
    this.maxX = worldMaxX - canvasWidth;
    this.minY = worldMinY;
    this.maxY = worldMaxY - canvasHeight;

    // Start at (0, 0) — shows the top-centre of the park.
    this.x = 0;
    this.y = 0;
  }

  /**
   * Move the camera by (dx, dy) pixels, clamped to world bounds.
   */
  pan(dx: number, dy: number): void {
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x + dx));
    this.y = Math.max(this.minY, Math.min(this.maxY, this.y + dy));
  }
}
