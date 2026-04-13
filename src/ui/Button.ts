import type { Renderer } from '../renderer/Renderer';
import type { Color } from '../renderer/Renderer';
import type { UIMouseEvent } from './UIEvent';
import { UINode } from './UINode';

// Windows 95 / RCT2 palette — duplicated here so Button is self-contained.
const BG:      Color = [0.753, 0.753, 0.753, 1.0]; // 192 — button face
const WHITE:   Color = [1.000, 1.000, 1.000, 1.0];
const LIGHT:   Color = [0.878, 0.878, 0.878, 1.0]; // 224 — inner highlight
const DARK:    Color = [0.502, 0.502, 0.502, 1.0]; // 128 — inner shadow
const DARKEST: Color = [0.251, 0.251, 0.251, 1.0]; //  64 — outer shadow

/**
 * A square push-button rendered with a two-pixel Windows-95-style bevel.
 *
 * Press state is tracked internally:
 *   - `onMouseDown` marks the button as pressed.
 *   - `onMouseUp`   fires the click callback iff the pointer is still inside,
 *                   then clears the pressed state.
 *   - `onMouseLeave` clears the pressed state without firing the callback.
 *
 * The UIManager's mouse-capture mechanism ensures that `onMouseUp` is always
 * delivered to the button that received `onMouseDown`, even if the cursor
 * drifted off the button during the press.
 */
export class Button extends UINode {
  private pressed = false;

  /**
   * @param x          Left edge in canvas-pixel space.
   * @param y          Top edge in canvas-pixel space.
   * @param size       Side length (buttons are always square).
   * @param drawIcon   Called inside the button face area; use drawRectFlat primitives.
   * @param clickHandler  Fired when the button is released over the same button.
   */
  constructor(
    x: number,
    y: number,
    size: number,
    private readonly drawIcon: (renderer: Renderer, x: number, y: number, size: number) => void,
    private readonly clickHandler: () => void,
  ) {
    super();
    this.x = x;
    this.y = y;
    this.width  = size;
    this.height = size;
  }

  protected override draw(renderer: Renderer): void {
    const { x, y, width: w, height: h } = this;

    // Bevel colours flip between raised and pressed states.
    const outerHL: Color = this.pressed ? DARKEST : WHITE;
    const innerHL: Color = this.pressed ? DARK    : LIGHT;
    const innerSH: Color = this.pressed ? LIGHT   : DARK;
    const outerSH: Color = this.pressed ? WHITE   : DARKEST;

    // Button face
    renderer.drawRectFlat(x + 2, y + 2, w - 4, h - 4, BG);

    // Outer bevel (1 px)
    renderer.drawRectFlat(x,         y,         w,     1,     outerHL); // top
    renderer.drawRectFlat(x,         y,         1,     h,     outerHL); // left
    renderer.drawRectFlat(x,         y + h - 1, w,     1,     outerSH); // bottom
    renderer.drawRectFlat(x + w - 1, y,         1,     h,     outerSH); // right

    // Inner bevel (1 px)
    renderer.drawRectFlat(x + 1,     y + 1,     w - 2, 1,     innerHL); // top
    renderer.drawRectFlat(x + 1,     y + 1,     1,     h - 2, innerHL); // left
    renderer.drawRectFlat(x + 1,     y + h - 2, w - 2, 1,     innerSH); // bottom
    renderer.drawRectFlat(x + w - 2, y + 1,     1,     h - 2, innerSH); // right

    // Icon shifts 1 px down-right when pressed for tactile feedback.
    const shift = this.pressed ? 1 : 0;
    this.drawIcon(renderer, x + shift, y + shift, this.width);
  }

  override onMouseDown(_e: UIMouseEvent): void {
    this.pressed = true;
  }

  override onMouseUp(e: UIMouseEvent): void {
    if (this.pressed && this.containsPoint(e.x, e.y)) {
      this.clickHandler();
    }
    this.pressed = false;
  }

  override onMouseLeave(): void {
    this.pressed = false;
  }
}
