import type { Renderer } from '../renderer/Renderer';
import type { Color } from '../renderer/Renderer';
import type { ToolbarButton } from './ToolbarButton';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const TOOLBAR_HEIGHT = 38;

const BUTTON_SIZE    = 28;
const BUTTON_SPACING = 4;
const TOOLBAR_PAD    = 6;  // left/right inset before first button

// ---------------------------------------------------------------------------
// Color palette (classic Windows 95 / RCT2 style)
// ---------------------------------------------------------------------------

const BG:      Color = [0.753, 0.753, 0.753, 1.0]; // 192 — button face & toolbar bg
const WHITE:   Color = [1.000, 1.000, 1.000, 1.0];
const LIGHT:   Color = [0.878, 0.878, 0.878, 1.0]; // 224 — inner highlight
const DARK:    Color = [0.502, 0.502, 0.502, 1.0]; // 128 — inner shadow
const DARKEST: Color = [0.251, 0.251, 0.251, 1.0]; //  64 — outer shadow
const BOTTOM_BORDER: Color = [0.400, 0.400, 0.400, 1.0];

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

/**
 * A horizontal toolbar rendered in WebGL that sits at the top of the canvas.
 *
 * Add buttons via `addButton()`.  Call `render()` every frame (with offset and
 * zoom already reset to identity for UI space).  Call `destroy()` when the
 * game stops to remove canvas event listeners.
 *
 * To prevent world-tool input from firing when the user clicks the toolbar,
 * pass `toolbar.isHit` as the `guard` parameter of `MouseManager`.
 */
export class Toolbar {
  private readonly buttons: ToolbarButton[] = [];
  private pressedIndex = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousedown',  this.handleMouseDown);
    canvas.addEventListener('mouseup',    this.handleMouseUp);
    canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  addButton(button: ToolbarButton): void {
    this.buttons.push(button);
  }

  /**
   * Returns true when the canvas-pixel point (x, y) lies inside the toolbar.
   * Use this as the `guard` callback of `MouseManager` so world tools do not
   * receive events originating in the toolbar.
   */
  isHit(_x: number, y: number): boolean {
    return y < TOOLBAR_HEIGHT;
  }

  /**
   * Draw the toolbar and all buttons.
   *
   * Must be called after `renderer.setOffset(0, 0)` and
   * `renderer.setZoom(1.0)` so coordinates are in screen space.
   */
  render(renderer: Renderer): void {
    const W = renderer.width;

    // Background
    renderer.drawRectFlat(0, 0, W, TOOLBAR_HEIGHT, BG);

    // Single-pixel bottom border for depth separation from the world view
    renderer.drawRectFlat(0, TOOLBAR_HEIGHT - 1, W, 1, BOTTOM_BORDER);

    for (let i = 0; i < this.buttons.length; i++) {
      this.renderButton(renderer, i);
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown',  this.handleMouseDown);
    this.canvas.removeEventListener('mouseup',    this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Screen-space bounding box for the i-th button. */
  private buttonRect(i: number): { x: number; y: number } {
    return {
      x: TOOLBAR_PAD + i * (BUTTON_SIZE + BUTTON_SPACING),
      y: Math.round((TOOLBAR_HEIGHT - BUTTON_SIZE) / 2),
    };
  }

  /** Index of the button that contains (px, py), or -1. */
  private buttonAtPoint(px: number, py: number): number {
    if (py < 0 || py >= TOOLBAR_HEIGHT) return -1;
    for (let i = 0; i < this.buttons.length; i++) {
      const { x, y } = this.buttonRect(i);
      if (px >= x && px < x + BUTTON_SIZE && py >= y && py < y + BUTTON_SIZE) return i;
    }
    return -1;
  }

  /**
   * Draw one button with a two-pixel Windows-95-style bevel.
   *
   * Raised (normal):
   *   outer top/left  = white
   *   inner top/left  = light grey
   *   inner btm/right = dark grey
   *   outer btm/right = darkest grey
   *
   * Pressed: highlight and shadow colours are swapped.
   */
  private renderButton(renderer: Renderer, i: number): void {
    const { x, y } = this.buttonRect(i);
    const pressed  = i === this.pressedIndex;
    const w = BUTTON_SIZE, h = BUTTON_SIZE;

    const outerHL = pressed ? DARKEST : WHITE;
    const innerHL = pressed ? DARK    : LIGHT;
    const innerSH = pressed ? LIGHT   : DARK;
    const outerSH = pressed ? WHITE   : DARKEST;

    // Button face
    renderer.drawRectFlat(x + 2, y + 2, w - 4, h - 4, BG);

    // Outer bevel
    renderer.drawRectFlat(x,         y,         w,     1,     outerHL); // top
    renderer.drawRectFlat(x,         y,         1,     h,     outerHL); // left
    renderer.drawRectFlat(x,         y + h - 1, w,     1,     outerSH); // bottom
    renderer.drawRectFlat(x + w - 1, y,         1,     h,     outerSH); // right

    // Inner bevel
    renderer.drawRectFlat(x + 1,     y + 1,     w - 2, 1,     innerHL); // top
    renderer.drawRectFlat(x + 1,     y + 1,     1,     h - 2, innerHL); // left
    renderer.drawRectFlat(x + 1,     y + h - 2, w - 2, 1,     innerSH); // bottom
    renderer.drawRectFlat(x + w - 2, y + 1,     1,     h - 2, innerSH); // right

    // Icon (shift 1 px down-right when pressed for tactile feel)
    const shift = pressed ? 1 : 0;
    this.buttons[i]!.drawIcon(renderer, x + shift, y + shift, BUTTON_SIZE);
  }

  // -------------------------------------------------------------------------
  // Canvas event listeners
  // -------------------------------------------------------------------------

  private readonly handleMouseDown = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const i  = this.buttonAtPoint(px, py);
    if (i >= 0) {
      this.pressedIndex = i;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private readonly handleMouseUp = (e: MouseEvent): void => {
    if (this.pressedIndex < 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const released = this.buttonAtPoint(px, py);
    if (released === this.pressedIndex) {
      this.buttons[released]!.onClick();
    }
    this.pressedIndex = -1;
  };

  private readonly handleMouseLeave = (): void => {
    this.pressedIndex = -1;
  };
}
