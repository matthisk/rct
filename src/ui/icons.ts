import type { Renderer } from '../renderer/Renderer';
import type { Color } from '../renderer/Renderer';

const BLACK: Color = [0.0, 0.0, 0.0, 1.0];

/**
 * Draw the shared magnifying-glass outline (lens ring + handle) using
 * drawRectFlat primitives.  The lens centre sits in the upper-left portion
 * of the button so the diagonal handle fits into the lower-right.
 *
 * @param renderer   Active renderer (offset/zoom must already be reset for UI)
 * @param bx / by    Top-left of the button face region
 * @param size       Side length of the button face region (square)
 */
function drawLens(renderer: Renderer, bx: number, by: number, size: number): void {
  // Lens centre: upper-left quadrant of the icon area
  const cx = Math.round(bx + size * 0.39);
  const cy = Math.round(by + size * 0.39);
  const r  = Math.max(4, Math.round(size * 0.22)); // lens "radius"
  const t  = 2;                                     // stroke thickness

  // Lens ring (four sides of a hollow square rotated 0°)
  renderer.drawRectFlat(cx - r,     cy - r - t, r * 2, t,     BLACK); // top
  renderer.drawRectFlat(cx - r,     cy + r,     r * 2, t,     BLACK); // bottom
  renderer.drawRectFlat(cx - r - t, cy - r,     t,     r * 2, BLACK); // left
  renderer.drawRectFlat(cx + r,     cy - r,     t,     r * 2, BLACK); // right

  // Handle — three stepping squares suggesting a diagonal shaft
  renderer.drawRectFlat(cx + r,       cy + r,       t, t, BLACK);
  renderer.drawRectFlat(cx + r + t,   cy + r + t,   t, t, BLACK);
  renderer.drawRectFlat(cx + r + t*2, cy + r + t*2, t, t, BLACK);
}

/**
 * Magnifying glass with a `+` inside — zoom-in button icon.
 */
export function drawZoomIn(renderer: Renderer, bx: number, by: number, size: number): void {
  drawLens(renderer, bx, by, size);

  const cx = Math.round(bx + size * 0.39);
  const cy = Math.round(by + size * 0.39);
  const r  = Math.max(4, Math.round(size * 0.22));
  const t  = 2;

  // Plus symbol inside the lens
  const inner = r - t;
  renderer.drawRectFlat(cx - inner, cy - 1,     inner * 2, t, BLACK); // horizontal bar
  renderer.drawRectFlat(cx - 1,     cy - inner, t, inner * 2, BLACK); // vertical bar
}

/**
 * Carousel icon: a square outline (the ride fence) with cross spokes and a
 * centre dot, suggesting a merry-go-round viewed from above.
 */
export function drawCarousel(renderer: Renderer, bx: number, by: number, size: number): void {
  const p  = Math.round(size * 0.18); // inset from button edge
  const s  = size - 2 * p;            // inner square side
  const t  = 2;                       // stroke thickness
  const cx = Math.round(bx + size / 2);
  const cy = Math.round(by + size / 2);

  // Square border
  renderer.drawRectFlat(bx + p,         by + p,         s,     t,     BLACK); // top
  renderer.drawRectFlat(bx + p,         by + p + s - t, s,     t,     BLACK); // bottom
  renderer.drawRectFlat(bx + p,         by + p,         t,     s,     BLACK); // left
  renderer.drawRectFlat(bx + p + s - t, by + p,         t,     s,     BLACK); // right

  // Horizontal and vertical spokes
  renderer.drawRectFlat(bx + p + t, cy - 1,     s - 2 * t, t,     BLACK);
  renderer.drawRectFlat(cx - 1,     by + p + t, t,     s - 2 * t, BLACK);

  // Centre hub dot
  renderer.drawRectFlat(cx - 2, cy - 2, 4, 4, BLACK);
}

/**
 * Magnifying glass with a `−` inside — zoom-out button icon.
 */
export function drawZoomOut(renderer: Renderer, bx: number, by: number, size: number): void {
  drawLens(renderer, bx, by, size);

  const cx = Math.round(bx + size * 0.39);
  const cy = Math.round(by + size * 0.39);
  const r  = Math.max(4, Math.round(size * 0.22));
  const t  = 2;

  // Minus symbol inside the lens
  const inner = r - t;
  renderer.drawRectFlat(cx - inner, cy - 1, inner * 2, t, BLACK); // horizontal bar only
}
