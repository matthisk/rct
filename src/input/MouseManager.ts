import type { MouseTool, TileCoord, ToolContext } from './MouseTool';

/**
 * Translates raw DOM mouse events on the canvas into `ToolContext` objects
 * and dispatches them to the active `MouseTool`.
 *
 * Also manages the canvas CSS cursor so each tool can declare its own.
 *
 * Usage:
 *   const manager = new MouseManager(canvas, tileFromCanvas, getZoom);
 *   manager.setTool(myTool);   // swap tools at any time
 *   // …later…
 *   manager.destroy();
 */
export class MouseManager {
  private tool: MouseTool | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    /** Convert a canvas-pixel position to a grid coordinate (null = off grid). */
    private readonly tileFromCanvas: (x: number, y: number) => TileCoord | null,
    /** Returns the current camera zoom (used to populate ToolContext.zoom). */
    private readonly getZoom: () => number,
    /**
     * Optional guard predicate.  When it returns true for a canvas-pixel
     * position, mouse events at that position are NOT forwarded to the active
     * tool.  Use this to prevent the world tools from responding to clicks
     * that land on UI elements such as the toolbar.
     *
     * mouseup is always forwarded (so drag operations can be cleanly
     * terminated even when the pointer is released over a UI element).
     */
    private readonly guard?: (x: number, y: number) => boolean,
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
  // Private
  // -------------------------------------------------------------------------

  private buildContext(e: MouseEvent): ToolContext {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { canvasX: x, canvasY: y, tile: this.tileFromCanvas(x, y), zoom: this.getZoom() };
  }

  private isGuarded(e: MouseEvent): boolean {
    if (!this.guard) return false;
    const rect = this.canvas.getBoundingClientRect();
    return this.guard(e.clientX - rect.left, e.clientY - rect.top);
  }

  private readonly handleMove = (e: MouseEvent) => {
    if (this.isGuarded(e)) { this.tool?.onLeave?.(); return; }
    this.tool?.onMove?.(this.buildContext(e));
  };

  private readonly handleDown = (e: MouseEvent) => {
    e.preventDefault(); // prevent text-selection drag
    if (this.isGuarded(e)) return;
    this.tool?.onDown?.(this.buildContext(e));
  };

  // mouseup is always dispatched (not guarded) so drag operations terminate
  // cleanly even when the pointer is released over a UI element.
  private readonly handleUp    = (e: MouseEvent) => this.tool?.onUp?.(this.buildContext(e));
  private readonly handleLeave = () => this.tool?.onLeave?.();
}
