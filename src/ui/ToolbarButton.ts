import type { Renderer } from '../renderer/Renderer';

/**
 * A single button in the toolbar.
 *
 * Implement `drawIcon` to paint the icon into the button face using the
 * renderer's flat-draw primitives.  The icon area is a square starting at
 * (x, y) with the given `size`.
 */
export interface ToolbarButton {
  drawIcon(renderer: Renderer, x: number, y: number, size: number): void;
  onClick(): void;
  tooltip?: string;
}
