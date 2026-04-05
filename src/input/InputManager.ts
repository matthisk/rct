// ---------------------------------------------------------------------------
// Action catalogue
//
// Add new literal string members here as new keybindings are introduced.
// Keep related actions grouped (pan*, zoom*, build*, ui*, …).
// ---------------------------------------------------------------------------

export type Action =
  | 'panLeft'
  | 'panRight'
  | 'panUp'
  | 'panDown'
  | 'zoomIn'
  | 'zoomOut';

// ---------------------------------------------------------------------------
// Default bindings
//
// Maps each action to one or more KeyboardEvent.code values.
// Multiple codes let the same action be triggered by alternative keys.
// ---------------------------------------------------------------------------

export type Bindings = Partial<Record<Action, string | string[]>>;

const DEFAULT_BINDINGS: Record<Action, string[]> = {
  panLeft:  ['ArrowLeft'],
  panRight: ['ArrowRight'],
  panUp:    ['ArrowUp'],
  panDown:  ['ArrowDown'],
  zoomIn:   ['Equal', 'NumpadAdd'],      // = / + key (with or without shift)
  zoomOut:  ['Minus', 'NumpadSubtract'],
};

// ---------------------------------------------------------------------------
// InputManager
// ---------------------------------------------------------------------------

/**
 * Tracks held and just-pressed actions from keyboard input.
 *
 * Call `update()` once at the start of each game-loop tick to advance the
 * just-pressed state; then query `isHeld()` for continuous actions (panning)
 * and `wasPressed()` for one-shot actions (zoom toggle).
 *
 * Usage:
 *   const input = new InputManager();
 *   // each frame, first:
 *   input.update();
 *   // continuous:
 *   if (input.isHeld('panLeft')) camera.pan(-speed * dt, 0);
 *   // one-shot:
 *   if (input.wasPressed('zoomIn')) camera.zoomIn();
 *   // teardown:
 *   input.destroy();
 *
 * To override or extend bindings:
 *   new InputManager({ panLeft: ['ArrowLeft', 'KeyA'] })
 */
export class InputManager {
  /** Maps KeyboardEvent.code → Action for O(1) lookup on every event. */
  private readonly codeToAction: Map<string, Action>;

  private readonly held = new Set<Action>();

  // Double-buffered just-pressed: keydown fills the buffer; update() flushes
  // it to the readable set and clears the buffer.  This ensures a keypress
  // that occurs between two update() calls is never silently dropped.
  private readonly justPressedBuf = new Set<Action>();
  private readonly justPressed    = new Set<Action>();

  constructor(overrides: Bindings = {}) {
    // Merge defaults with overrides, normalising values to string[].
    const merged: Record<Action, string[]> = { ...DEFAULT_BINDINGS };
    for (const [action, keys] of Object.entries(overrides) as [Action, string | string[]][]) {
      merged[action] = Array.isArray(keys) ? keys : [keys];
    }

    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(merged) as [Action, string[]][]) {
      for (const code of codes) {
        this.codeToAction.set(code, action);
      }
    }

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup',   this.handleKeyUp);
  }

  /**
   * Advance input state for one frame.
   * Must be called once at the beginning of each game-loop tick.
   */
  update(): void {
    this.justPressed.clear();
    for (const a of this.justPressedBuf) this.justPressed.add(a);
    this.justPressedBuf.clear();
  }

  /** Returns true while the key(s) bound to this action are held down. */
  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  /**
   * Returns true if the action was triggered since the last `update()` call.
   * Suitable for one-shot actions like zoom level changes.
   */
  wasPressed(action: Action): boolean {
    return this.justPressed.has(action);
  }

  /** Remove event listeners. Call when the game is stopped. */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup',   this.handleKeyUp);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    const action = this.codeToAction.get(e.code);
    if (action) {
      e.preventDefault();
      this.held.add(action);
      this.justPressedBuf.add(action);
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    const action = this.codeToAction.get(e.code);
    if (action) this.held.delete(action);
  };
}
