export const VERTEX_SHADER_SRC = /* glsl */ `
  attribute vec2 a_position;

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
    gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADER_SRC = /* glsl */ `
  precision mediump float;

  uniform vec4 u_color;

  void main() {
    gl_FragColor = u_color;
  }
`;
