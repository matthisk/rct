import type { Renderer } from '../renderer/Renderer';
import type { Color } from '../renderer/Renderer';
import type { ToolbarButton } from './ToolbarButton';
import { UINode } from './UINode';
import { Button } from './Button';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const TOOLBAR_HEIGHT = 38;

const BUTTON_SIZE    = 28;
const BUTTON_SPACING = 4;
const TOOLBAR_PAD    = 6; // left inset before the first button

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const BG:            Color = [0.753, 0.753, 0.753, 1.0]; // 192 — button face / toolbar bg
const BOTTOM_BORDER: Color = [0.400, 0.400, 0.400, 1.0];

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

/**
 * A horizontal toolbar that spans the full canvas width and sits at the top.
 *
 * Extends UINode so the UIManager handles all hit-testing and event routing
 * — no canvas event listeners here.  Add buttons via `addButton()`; each one
 * becomes a child `Button` node positioned automatically.
 *
 * Call `render()` after resetting the camera to identity (offset 0, zoom 1).
 */
export class Toolbar extends UINode {
  constructor(canvasWidth: number) {
    super();
    this.x      = 0;
    this.y      = 0;
    this.width  = canvasWidth;
    this.height = TOOLBAR_HEIGHT;
  }

  /**
   * Append a button to the toolbar.  The button is positioned automatically
   * based on the number of existing buttons.
   */
  addButton(button: ToolbarButton): void {
    const i  = this.children.length;
    const bx = TOOLBAR_PAD + i * (BUTTON_SIZE + BUTTON_SPACING);
    const by = Math.round((TOOLBAR_HEIGHT - BUTTON_SIZE) / 2);
    this.addChild(new Button(bx, by, BUTTON_SIZE, button.drawIcon, button.onClick));
  }

  protected override draw(renderer: Renderer): void {
    // Background
    renderer.drawRectFlat(0, 0, this.width, TOOLBAR_HEIGHT, BG);
    // Single-pixel bottom border for depth separation from the world view
    renderer.drawRectFlat(0, TOOLBAR_HEIGHT - 1, this.width, 1, BOTTOM_BORDER);
  }
}
