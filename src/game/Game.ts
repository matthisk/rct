import { Renderer } from '../renderer/Renderer';
import { IsoRenderer } from '../renderer/IsoRenderer';
import { World } from '../world/World';

// 128×128 matches a real RCT1 scenario map.  At 64×32 px per tile the grid
// spans ~8 192 × 4 096 px — well beyond the 1280×720 viewport in every
// direction.  The camera system will let the player scroll the full park.
const WORLD_COLS = 128;
const WORLD_ROWS = 128;

const SKY: [number, number, number, number] = [0.53, 0.81, 0.98, 1.0];

/**
 * Main game class.
 *
 * Owns the game loop (requestAnimationFrame) and will eventually own the
 * simulation state, world, entities, etc.
 */
export class Game {
  private renderer: Renderer;
  private isoRenderer: IsoRenderer;
  private world: World;

  private rafId: number = 0;
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.world = new World(WORLD_COLS, WORLD_ROWS);
    this.isoRenderer = new IsoRenderer(
      this.renderer.width,
      this.renderer.height,
      WORLD_COLS,
      WORLD_ROWS,
    );
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
    this.renderer.clear(SKY);
    this.isoRenderer.render(this.world, this.renderer);
  }
}
