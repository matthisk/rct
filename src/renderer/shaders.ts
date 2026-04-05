export const VERTEX_SHADER_SRC = /* glsl */ `
  attribute vec2 a_position;

  uniform vec2 u_resolution;
  uniform vec2 u_offset;

  void main() {
    // Subtract camera scroll offset, then convert to clip space
    vec2 pos = a_position - u_offset;
    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    // Flip Y so that (0,0) is top-left, matching screen convention
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
