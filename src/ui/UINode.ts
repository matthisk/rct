import type { Renderer } from '../renderer/Renderer';
import type { UIMouseEvent } from './UIEvent';

/**
 * Base class for all UI elements.
 *
 * Coordinates are in canvas-pixel space (origin = top-left of canvas).
 * A UINode may contain child nodes, which are hit-tested and rendered in
 * ascending z-order (highest z = drawn last = on top).
 *
 * Override `draw()` to render this node.  Override `onMouseDown/Move/Up/Leave`
 * to handle input — the UIManager will call these after its hit-test and
 * capture logic selects the right target.
 */
export abstract class UINode {
  x: number = 0;
  y: number = 0;
  width: number = 0;
  height: number = 0;
  zIndex: number = 0;

  protected readonly children: UINode[] = [];

  addChild(node: UINode): void {
    this.children.push(node);
  }

  removeChild(node: UINode): void {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
  }

  /**
   * Render this node then all children (ascending z-order, so highest z
   * is drawn last and appears on top).
   */
  render(renderer: Renderer): void {
    this.draw(renderer);
    const sorted = [...this.children].sort((a, b) => a.zIndex - b.zIndex);
    for (const child of sorted) {
      child.render(renderer);
    }
  }

  /** Draw only this node (not its children). Override in subclasses. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected draw(_renderer: Renderer): void {}

  /**
   * Returns the deepest node under (x, y), checking children first
   * (highest z first).  Returns `this` if no child matches but this node
   * does.  Returns null if the point is outside this node entirely.
   */
  hitTest(x: number, y: number): UINode | null {
    if (!this.containsPoint(x, y)) return null;
    const sorted = [...this.children].sort((a, b) => b.zIndex - a.zIndex);
    for (const child of sorted) {
      const hit = child.hitTest(x, y);
      if (hit) return hit;
    }
    return this;
  }

  containsPoint(x: number, y: number): boolean {
    return x >= this.x && x < this.x + this.width
        && y >= this.y && y < this.y + this.height;
  }

  // Optional mouse handlers — implement in subclasses as needed.
  onMouseDown?(e: UIMouseEvent): void;
  onMouseMove?(e: UIMouseEvent): void;
  onMouseUp?(e: UIMouseEvent): void;
  onMouseLeave?(): void;
}
