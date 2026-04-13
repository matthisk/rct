import type { MouseTool, TileCoord, ToolContext } from './MouseTool';
import type { UIManager } from '../ui/UIManager';

/**
 * Translates raw DOM mouse events on the canvas into `ToolContext` objects
 * and dispatches them to the active `MouseTool`.
 *
 * Event routing order:
 *   1. The UIManager is offered the event first.
 *      - If it returns true (a UI node consumed the event), world-tool
 *        move/down events are suppressed.
 *   2. Otherwise the active world tool receives the event.
 *
 * mouseup is always forwarded to both the UIManager (to release button
 * captures) and the active world tool (so drag operations can clean up even
 * when the pointer is released over a UI element).
 *
 * mouseleave is forwarded to both so all press/hover states are cleared.
 */
export class MouseManager {
  private tool: MouseTool | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    /** Convert a canvas-pixel position to a grid coordinate (null = off grid). */
    private readonly tileFromCanvas: (x: number, y: number) => TileCoord | null,
    /** Returns the current camera zoom (used to populate ToolContext.zoom). */
    private readonly getZoom: () => number,
    /** UI manager — receives events before the active world tool. */
    private readonly uiManager: UIManager,
  ) {
    canvas.addEventListener('mousemove',  this.handleMove);
    canvas.addEventListener('mousedown',  this.handleDown);
    canvas.addEventListener('mouseleave', this.handleLeave);
    // Listen on window so mouseup is caught even when released outside the canvas.
    window.addEventListener('mouseup', this.handleUp);
  }

  /** Replace the active tool (passes onLeave to the outgoing tool first). */
  setTool(tool: MouseTool | null): void {
    this.tool?.onLeave?.();
    this.tool = tool;
    this.canvas.style.cursor = tool?.cursor ?? 'default';
  }

  /** Remove all event listeners. Call when the game stops. */
  destroy(): void {
    this.canvas.removeEventListener('mousemove',  this.handleMove);
    this.canvas.removeEventListener('mousedown',  this.handleDown);
    this.canvas.removeEventListener('mouseleave', this.handleLeave);
    window.removeEventListener('mouseup', this.handleUp);
  }

  // -------------------------------------------------------------------------

  private canvasPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private buildContext(x: number, y: number): ToolContext {
    return { canvasX: x, canvasY: y, tile: this.tileFromCanvas(x, y), zoom: this.getZoom() };
  }

  private readonly handleMove = (e: MouseEvent): void => {
    const { x, y } = this.canvasPos(e);
    if (this.uiManager.dispatchMove(x, y)) {
      // Pointer is over UI — retire the world tool's hover state.
      this.tool?.onLeave?.();
    } else {
      this.tool?.onMove?.(this.buildContext(x, y));
    }
  };

  private readonly handleDown = (e: MouseEvent): void => {
    e.preventDefault(); // prevent text-selection drag
    const { x, y } = this.canvasPos(e);
    if (!this.uiManager.dispatchDown(x, y)) {
      this.tool?.onDown?.(this.buildContext(x, y));
    }
  };

  private readonly handleUp = (e: MouseEvent): void => {
    const { x, y } = this.canvasPos(e);
    // UI gets the up first (releases capture / fires button click if applicable).
    this.uiManager.dispatchUp(x, y);
    // World tool always receives up so drag operations terminate cleanly.
    this.tool?.onUp?.(this.buildContext(x, y));
  };

  private readonly handleLeave = (): void => {
    this.uiManager.dispatchLeave();
    this.tool?.onLeave?.();
  };
}
