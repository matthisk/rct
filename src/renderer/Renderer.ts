import { VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC } from './shaders';

export type Color = [r: number, g: number, b: number, a: number];

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

/**
 * Minimal WebGL renderer.
 *
 * Currently supports drawing axis-aligned colored rectangles.
 * Extend this class as the game grows (sprites, tilemaps, etc.).
 */
export class Renderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;

  // Cached attribute / uniform locations
  private aPosition: number;
  private uResolution: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;

  readonly width: number;
  readonly height: number;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL is not supported in this browser.');

    this.gl = gl;
    this.width = canvas.width;
    this.height = canvas.height;

    this.program = createProgram(gl, VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC);
    gl.useProgram(this.program);

    // Attribute
    this.aPosition = gl.getAttribLocation(this.program, 'a_position');

    // Uniforms
    const uRes = gl.getUniformLocation(this.program, 'u_resolution');
    const uCol = gl.getUniformLocation(this.program, 'u_color');
    if (!uRes || !uCol) throw new Error('Missing shader uniforms');
    this.uResolution = uRes;
    this.uColor = uCol;

    // Set resolution once (canvas size doesn't change for now)
    gl.uniform2f(this.uResolution, this.width, this.height);

    // Shared position buffer (reused every draw call)
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create position buffer');
    this.positionBuffer = buf;

    gl.viewport(0, 0, this.width, this.height);
  }

  /** Clear the canvas to a solid color. */
  clear(color: Color = [0.53, 0.81, 0.98, 1.0]): void {
    const [r, g, b, a] = color;
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * Draw a filled axis-aligned rectangle.
   *
   * @param x      Left edge in pixels (origin: top-left)
   * @param y      Top edge in pixels
   * @param width  Width in pixels
   * @param height Height in pixels
   * @param color  RGBA color, each component in [0, 1]
   */
  drawRect(x: number, y: number, width: number, height: number, color: Color): void {
    const x1 = x, x2 = x + width;
    const y1 = y, y2 = y + height;
    // prettier-ignore
    const data = new Float32Array([
      x1, y1,  x2, y1,  x1, y2,
      x1, y2,  x2, y1,  x2, y2,
    ]);
    this.drawTriangles(data, 6, color);
  }

  /**
   * Draw a batch of pre-triangulated geometry in a single draw call.
   *
   * Callers are expected to own and reuse the Float32Array to avoid GC
   * pressure on large batches.
   *
   * @param data        Pre-allocated Float32Array of x,y pairs
   * @param vertexCount Number of vertices to draw (data must hold at least vertexCount * 2 floats)
   * @param color       RGBA color applied to every triangle in the batch
   */
  drawTriangles(data: Float32Array, vertexCount: number, color: Color): void {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.uniform4fv(this.uColor, color);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }
}
