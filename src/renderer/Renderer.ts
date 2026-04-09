import {
  VERTEX_SHADER_SRC,
  FRAGMENT_SHADER_SRC,
  TEX_VERTEX_SHADER_SRC,
  TEX_FRAGMENT_SHADER_SRC,
} from './shaders';

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

  // ---- Color program (solid-color geometry) --------------------------------
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private aPosition: number;
  private uResolution: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private uOffset: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;

  // ---- Textured program (image-mapped geometry) ----------------------------
  private texProgram: WebGLProgram;
  private texBuffer: WebGLBuffer;
  private aTexPosition: number;
  private aTexCoord: number;
  private uTexOffset: WebGLUniformLocation;
  private uTexZoom: WebGLUniformLocation;
  private uTexSampler: WebGLUniformLocation;

  // ---- Cached camera state (applied to both programs) ----------------------
  private _offsetX = 0;
  private _offsetY = 0;
  private _zoom    = 1.0;

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
    const uRes  = gl.getUniformLocation(this.program, 'u_resolution');
    const uCol  = gl.getUniformLocation(this.program, 'u_color');
    const uOff  = gl.getUniformLocation(this.program, 'u_offset');
    const uZoom = gl.getUniformLocation(this.program, 'u_zoom');
    if (!uRes || !uCol || !uOff || !uZoom) throw new Error('Missing shader uniforms');
    this.uResolution = uRes;
    this.uColor = uCol;
    this.uOffset = uOff;
    this.uZoom = uZoom;

    // Set resolution once (canvas size doesn't change for now)
    gl.uniform2f(this.uResolution, this.width, this.height);
    gl.uniform2f(this.uOffset, 0, 0);
    gl.uniform1f(this.uZoom, 1.0);

    // Shared position buffer (reused every draw call)
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create position buffer');
    this.positionBuffer = buf;

    // ---- Textured program ---------------------------------------------------
    this.texProgram  = createProgram(gl, TEX_VERTEX_SHADER_SRC, TEX_FRAGMENT_SHADER_SRC);
    gl.useProgram(this.texProgram);

    this.aTexPosition = gl.getAttribLocation(this.texProgram, 'a_position');
    this.aTexCoord    = gl.getAttribLocation(this.texProgram, 'a_texcoord');

    const uTexRes = gl.getUniformLocation(this.texProgram, 'u_resolution');
    const uTexOff = gl.getUniformLocation(this.texProgram, 'u_offset');
    const uTexZm  = gl.getUniformLocation(this.texProgram, 'u_zoom');
    const uTexSmp = gl.getUniformLocation(this.texProgram, 'u_texture');
    if (!uTexRes || !uTexOff || !uTexZm || !uTexSmp) {
      throw new Error('Missing tex shader uniforms');
    }
    this.uTexOffset  = uTexOff;
    this.uTexZoom    = uTexZm;
    this.uTexSampler = uTexSmp;

    gl.uniform2f(uTexRes, this.width, this.height);
    gl.uniform2f(uTexOff, 0, 0);
    gl.uniform1f(uTexZm, 1.0);

    const texBuf = gl.createBuffer();
    if (!texBuf) throw new Error('Failed to create tex buffer');
    this.texBuffer = texBuf;

    // Restore color program as active default
    gl.useProgram(this.program);

    gl.viewport(0, 0, this.width, this.height);

    // Standard pre-multiplied alpha blending — required for hover highlight overlay.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /**
   * Set the camera scroll offset applied to all subsequent draw calls.
   * Call with (0, 0) before drawing UI elements that should be unaffected by
   * the camera.
   */
  setOffset(x: number, y: number): void {
    this._offsetX = x;
    this._offsetY = y;
    this.gl.uniform2f(this.uOffset, x, y);
  }

  /** Set the zoom scale applied around the viewport centre. 1.0 = no zoom. */
  setZoom(zoom: number): void {
    this._zoom = zoom;
    this.gl.uniform1f(this.uZoom, zoom);
  }

  /**
   * Upload an image source as a WebGL texture.
   *
   * The source must have power-of-two dimensions so that mipmaps can be
   * generated (used for smooth downscaling at far zoom).
   */
  createTexture(source: TexImageSource): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /**
   * Draw a batch of pre-triangulated textured geometry in a single draw call.
   *
   * `data` contains interleaved x, y, u, v floats (4 floats per vertex).
   * The current camera offset and zoom are applied automatically.
   */
  drawTexturedTriangles(
    data: Float32Array,
    vertexCount: number,
    texture: WebGLTexture,
  ): void {
    const gl = this.gl;

    gl.useProgram(this.texProgram);

    // Apply cached camera state to this program
    gl.uniform2f(this.uTexOffset, this._offsetX, this._offsetY);
    gl.uniform1f(this.uTexZoom, this._zoom);

    // Upload interleaved geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    // stride = 4 floats × 4 bytes = 16
    gl.enableVertexAttribArray(this.aTexPosition);
    gl.vertexAttribPointer(this.aTexPosition, 2, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.uTexSampler, 0);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    // Restore the color program as the active default
    gl.useProgram(this.program);
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
