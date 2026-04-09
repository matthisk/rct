// ---------------------------------------------------------------------------
// Color-only program (used for solid-color geometry such as tile borders)
// ---------------------------------------------------------------------------

export const VERTEX_SHADER_SRC = /* glsl */ `
  attribute vec2  a_position;
  attribute float a_depth;

  uniform vec2  u_resolution;
  uniform vec2  u_offset;
  uniform float u_zoom;

  void main() {
    // 1. Apply camera scroll
    vec2 pos = a_position - u_offset;
    // 2. Zoom around the viewport centre (scale in screen space)
    vec2 centre = u_resolution * 0.5;
    pos = (pos - centre) * u_zoom + centre;
    // 3. Convert to clip space; flip Y so (0,0) is top-left
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    // a_depth=0 → back (z=1), a_depth=1 → front (z=-1)
    float z = 1.0 - 2.0 * a_depth;
    gl_Position = vec4(clipSpace * vec2(1.0, -1.0), z, 1.0);
  }
`;

export const FRAGMENT_SHADER_SRC = /* glsl */ `
  precision mediump float;

  uniform vec4 u_color;

  void main() {
    gl_FragColor = u_color;
  }
`;

// ---------------------------------------------------------------------------
// Textured program (used for image-mapped tile fills)
// ---------------------------------------------------------------------------

export const TEX_VERTEX_SHADER_SRC = /* glsl */ `
  attribute vec2  a_position;
  attribute vec2  a_texcoord;
  attribute float a_depth;

  uniform vec2  u_resolution;
  uniform vec2  u_offset;
  uniform float u_zoom;

  varying vec2 v_texcoord;

  void main() {
    vec2 pos = a_position - u_offset;
    vec2 centre = u_resolution * 0.5;
    pos = (pos - centre) * u_zoom + centre;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    float z = 1.0 - 2.0 * a_depth;
    gl_Position = vec4(clipSpace * vec2(1.0, -1.0), z, 1.0);
    v_texcoord = a_texcoord;
  }
`;

export const TEX_FRAGMENT_SHADER_SRC = /* glsl */ `
  precision mediump float;

  uniform sampler2D u_texture;
  varying vec2 v_texcoord;

  void main() {
    gl_FragColor = texture2D(u_texture, v_texcoord);
  }
`;
