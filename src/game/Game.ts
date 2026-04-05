import { Renderer } from '../renderer/Renderer';

/**
 * Main game class.
 *
 * Owns the game loop (requestAnimationFrame) and will eventually own the
 * simulation state, world, entities, etc.
 */
export class Game {
  private renderer: Renderer;
  private rafId: number = 0;
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
  }

  start(): void {
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private loop(timestamp: number): void {
    const dt = (timestamp - this.lastTime) / 1000; // seconds
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  /** Update simulation state. */
  private update(_dt: number): void {
    // TODO: tick entities, physics, park economy, …
  }

  /** Render the current frame. */
  private render(): void {
    const r = this.renderer;

    // Sky
    r.clear([0.53, 0.81, 0.98, 1.0]);

    // Ground
    r.drawRect(0, r.height * 0.6, r.width, r.height * 0.4, [0.24, 0.55, 0.18, 1.0]);
  }
}
