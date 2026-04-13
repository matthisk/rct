import type { Renderer } from '../renderer/Renderer';
import type { UINode } from './UINode';

/**
 * Owns the UI scene graph and routes mouse events into it.
 *
 * Usage in the game loop:
 *   - Call `addRoot()` to register top-level panels / windows.
 *   - In MouseManager, call `dispatchDown/Move/Up/Leave()` before forwarding
 *     events to world tools; the return value signals whether UI consumed the event.
 *   - Call `render()` after resetting camera transforms so UI draws in screen space.
 *
 * Z-ordering:
 *   - Roots are tested / rendered in ascending zIndex order (highest = front).
 *   - `addRoot()` assigns a zIndex automatically.  Future windowing code can
 *     bump a window's zIndex to bring it to the front.
 */
export class UIManager {
  private readonly roots: UINode[] = [];
  /** The node that received the last mousedown — receives mouseup regardless of cursor position. */
  private capturedNode: UINode | null = null;
  private nextZ = 0;

  /** Register a top-level UI node (toolbar, window, …). */
  addRoot(node: UINode): void {
    node.zIndex = this.nextZ++;
    this.roots.push(node);
  }

  removeRoot(node: UINode): void {
    const i = this.roots.indexOf(node);
    if (i >= 0) this.roots.splice(i, 1);
  }

  /**
   * Dispatch a mousemove.
   * Returns true if a UI node was hit so the caller can suppress world-tool move events.
   */
  dispatchMove(x: number, y: number): boolean {
    // If we have a capture (mid-drag on a UI element), keep routing there.
    const target = this.capturedNode ?? this.hitTest(x, y);
    if (!target) return false;
    target.onMouseMove?.({ x, y });
    return true;
  }

  /**
   * Dispatch a mousedown.  Captures the hit node so subsequent move/up events
   * are routed to it even when the cursor drifts off.
   * Returns true if consumed by UI (caller should not forward to world tools).
   */
  dispatchDown(x: number, y: number): boolean {
    const target = this.hitTest(x, y);
    if (!target) return false;
    this.capturedNode = target;
    target.onMouseDown?.({ x, y });
    return true;
  }

  /**
   * Dispatch a mouseup.  Always routed to the captured node (if any) so that
   * button-release logic fires even when the pointer drifted off the element.
   * Clears the capture afterward.
   *
   * Returns true when UI handled the up event; the caller may still want to
   * forward to the world tool for drag-cleanup purposes.
   */
  dispatchUp(x: number, y: number): boolean {
    const target = this.capturedNode;
    this.capturedNode = null;
    if (!target) return false;
    target.onMouseUp?.({ x, y });
    return true;
  }

  /** Notify the UI tree that the pointer left the canvas. Clears capture. */
  dispatchLeave(): void {
    const captured = this.capturedNode;
    this.capturedNode = null;
    if (captured) captured.onMouseLeave?.();
    for (const root of this.roots) {
      if (root !== captured) root.onMouseLeave?.();
    }
  }

  /** Render all roots in ascending z-order (lowest z drawn first). */
  render(renderer: Renderer): void {
    const sorted = [...this.roots].sort((a, b) => a.zIndex - b.zIndex);
    for (const root of sorted) {
      root.render(renderer);
    }
  }

  // -------------------------------------------------------------------------

  private hitTest(x: number, y: number): UINode | null {
    // Test roots highest-z first so the frontmost element wins.
    const sorted = [...this.roots].sort((a, b) => b.zIndex - a.zIndex);
    for (const root of sorted) {
      const hit = root.hitTest(x, y);
      if (hit) return hit;
    }
    return null;
  }
}
