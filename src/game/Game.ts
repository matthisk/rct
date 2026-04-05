import { Renderer } from '../renderer/Renderer';
import { IsoRenderer } from '../renderer/IsoRenderer';
import { World } from '../world/World';
import { Camera } from '../camera/Camera';
import { InputManager } from '../input/InputManager';

// 128×128 matches a real RCT1 scenario map.  At 64×32 px per tile the grid
// spans ~8 192 × 4 096 px — well beyond the 1280×720 viewport in every
// direction.  The camera system will let the player scroll the full park.
const WORLD_COLS = 128;
const WORLD_ROWS = 128;

/** Camera pan speed in screen pixels per second. */
const PAN_SPEED = 500;

const SKY: [number, number, number, number] = [0.53, 0.81, 0.98, 1.0];

/**
 * Main game class.
 *
 * Owns the game loop (requestAnimationFrame) and wires together the
 * simulation state, input, camera, and renderer.
 */
export class Game {
  private renderer: Renderer;
  private isoRenderer: IsoRenderer;
  private world: World;
  private camera: Camera;
  private input: InputManager;

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

    const { minX, maxX, minY, maxY } = this.isoRenderer.worldBounds;
    this.camera = new Camera(
      this.renderer.width,
      this.renderer.height,
      minX, maxX,
      minY, maxY,
    );

    this.input = new InputManager();
  }

  start(): void {
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.input.destroy();
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // cap at 100 ms
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  /** Update simulation state. */
  private update(dt: number): void {
    let dx = 0, dy = 0;
    if (this.input.isHeld('panLeft'))  dx -= PAN_SPEED * dt;
    if (this.input.isHeld('panRight')) dx += PAN_SPEED * dt;
    if (this.input.isHeld('panUp'))    dy -= PAN_SPEED * dt;
    if (this.input.isHeld('panDown'))  dy += PAN_SPEED * dt;
    if (dx !== 0 || dy !== 0) this.camera.pan(dx, dy);
  }

  /** Render the current frame. */
  private render(): void {
    this.renderer.clear(SKY);

    // World pass — apply camera offset so the geometry (built in world space)
    // scrolls with the camera.
    this.renderer.setOffset(this.camera.x, this.camera.y);
    this.isoRenderer.render(this.world, this.renderer);

    // Reset offset before any future UI draw calls.
    this.renderer.setOffset(0, 0);
  }
}
