# RCT - Roller Coaster Tycoon Clone

## Project Constraints

1. **No game framework or engine** — Do not introduce full game engines (Phaser, Babylon.js, Three.js, Pixi.js, etc.). The game logic, simulation, and ECS (if any) must be built from scratch.
2. **WebGL rendering** — All rendering must go through WebGL. A lightweight WebGL *helper* library (e.g. twgl.js) is permitted to reduce boilerplate, but not a full rendering engine.
3. **TypeScript only** — All source code must be written in TypeScript. No plain `.js` files in `src/`.
4. **No runtime game dependencies** — `dependencies` in `package.json` must remain empty or contain only a vetted WebGL helper. Build/dev tools (Vite, TypeScript) live in `devDependencies` and are fine.
5. **Browser target** — The game runs in the browser. No Node.js runtime assumptions in game code.

## Tech Stack

| Concern        | Choice                          |
|----------------|---------------------------------|
| Language       | TypeScript                      |
| Rendering      | WebGL (raw, or twgl.js helper)  |
| Build / Dev    | Vite                            |
| Runtime deps   | None (or single WebGL helper)   |

## Project Structure

```
src/
  main.ts          — entry point, wires everything together
  game/
    Game.ts        — main game loop (update / render)
  renderer/
    Renderer.ts    — WebGL renderer (clear, drawRect, …)
    shaders.ts     — GLSL shader source strings
```

## Git Workflow

After every change, create a git commit unless explicitly told not to. Always include the user's prompt verbatim in the commit message body so there is a clear record of what was asked.

Commit message format:
```
<short imperative summary>

Prompt: "<exact user prompt>"

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Running Locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (default: http://localhost:5173).
