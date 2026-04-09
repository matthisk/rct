import { Renderer } from '../renderer/Renderer';
import { IsoRenderer } from '../renderer/IsoRenderer';
import { World } from '../world/World';
import { Camera } from '../camera/Camera';
import { InputManager } from '../input/InputManager';
import { MouseManager } from '../input/MouseManager';
import { HeightTool } from '../tools/HeightTool';

// 128×128 matches a real RCT1 scenario map.  At 64×32 px per tile the grid
// spans ~8 192 × 4 096 px — well beyond the 1280×720 viewport in every
// direction.
const WORLD_COLS = 128;
const WORLD_ROWS = 128;

/**
 * Camera pan speed in screen pixels per second.
 * World-space delta = PAN_SPEED / zoom, keeping screen speed constant across
 * all zoom levels.
 */
const PAN_SPEED = 500;

const SKY: [number, number, number, number] = [0.53, 0.81, 0.98, 1.0];

/**
 * Main game class.
 *
 * Owns the game loop (requestAnimationFrame) and wires together the
 * simulation state, input, camera, and renderer.
 */
export class Game {
  private renderer:    Renderer;
  private isoRenderer: IsoRenderer;
  private world:       World;
  private camera:      Camera;
  private input:       InputManager;

  private rafId:    number = 0;
  private lastTime: number = 0;

  private mouseManager: MouseManager;
  private heightTool:   HeightTool;

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

    this.heightTool = new HeightTool(
      this.world,
      () => this.isoRenderer.invalidate(),
    );
    this.mouseManager = new MouseManager(
      canvas,
      (x, y) => this.isoRenderer.canvasToTile(x, y, this.camera.x, this.camera.y, this.camera.zoom),
      () => this.camera.zoom,
    );
    this.mouseManager.setTool(this.heightTool);
  }

  start(): void {
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.input.destroy();
    this.mouseManager.destroy();
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // cap at 100 ms
    this.lastTime = timestamp;

    this.input.update();
    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    // Zoom (one-shot via wasPressed)
    if (this.input.wasPressed('zoomIn'))  this.camera.zoomIn();
    if (this.input.wasPressed('zoomOut')) this.camera.zoomOut();

    // Pan — world-space delta keeps screen speed constant across zoom levels
    const worldSpeed = PAN_SPEED / this.camera.zoom;
    let dx = 0, dy = 0;
    if (this.input.isHeld('panLeft'))  dx -= worldSpeed * dt;
    if (this.input.isHeld('panRight')) dx += worldSpeed * dt;
    if (this.input.isHeld('panUp'))    dy -= worldSpeed * dt;
    if (this.input.isHeld('panDown'))  dy += worldSpeed * dt;
    if (dx !== 0 || dy !== 0) this.camera.pan(dx, dy);
  }

  private render(): void {
    this.renderer.clear(SKY);

    // Sync hover highlight from the active tool.
    const hov = this.heightTool.hoveredTile;
    if (hov) this.isoRenderer.setHoveredTile(hov.col, hov.row);
    else      this.isoRenderer.clearHoveredTile();

    // Apply camera transform — offset then zoom — before the world draw.
    // Reset both to identity afterwards so future UI draws are unaffected.
    this.renderer.setOffset(this.camera.x, this.camera.y);
    this.renderer.setZoom(this.camera.zoom);
    this.isoRenderer.render(this.world, this.renderer);
    this.renderer.setOffset(0, 0);
    this.renderer.setZoom(1.0);
  }
}
