// ---------------------------------------------------------------------------
// Action catalogue
//
// Add new literal string members here as new keybindings are introduced.
// Keep related actions grouped (pan*, build*, ui*, …).
// ---------------------------------------------------------------------------

export type Action =
  | 'panLeft'
  | 'panRight'
  | 'panUp'
  | 'panDown';

// ---------------------------------------------------------------------------
// Default bindings
//
// Maps each action to one or more KeyboardEvent.code values.
// Multiple codes allow alternative keys for the same action (e.g. WASD).
// ---------------------------------------------------------------------------

export type Bindings = Partial<Record<Action, string | string[]>>;

const DEFAULT_BINDINGS: Record<Action, string[]> = {
  panLeft:  ['ArrowLeft'],
  panRight: ['ArrowRight'],
  panUp:    ['ArrowUp'],
  panDown:  ['ArrowDown'],
};

// ---------------------------------------------------------------------------
// InputManager
// ---------------------------------------------------------------------------

/**
 * Tracks which actions are currently held down based on keyboard input.
 *
 * Usage:
 *   const input = new InputManager();
 *   // in game loop:
 *   if (input.isHeld('panLeft')) camera.pan(-speed * dt, 0);
 *   // on teardown:
 *   input.destroy();
 *
 * To override or add alternative keys pass a Bindings map to the constructor:
 *   new InputManager({ panLeft: ['ArrowLeft', 'KeyA'] })
 */
export class InputManager {
  /** Maps KeyboardEvent.code → Action for fast lookup on every keydown/keyup. */
  private readonly codeToAction: Map<string, Action>;
  private readonly held = new Set<Action>();

  constructor(overrides: Bindings = {}) {
    // Merge defaults with overrides, normalise values to string[].
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

  /** Returns true while the key(s) bound to this action are held down. */
  isHeld(action: Action): boolean {
    return this.held.has(action);
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
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    const action = this.codeToAction.get(e.code);
    if (action) this.held.delete(action);
  };
}
