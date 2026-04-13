/**
 * Lightweight event object passed to UINode mouse handlers.
 * Canvas-pixel coordinates, origin at top-left of canvas.
 */
export interface UIMouseEvent {
  readonly x: number;
  readonly y: number;
}
