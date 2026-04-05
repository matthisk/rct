export const VERTEX_SHADER_SRC = /* glsl */ `
  attribute vec2 a_position;

  uniform vec2 u_resolution;

  void main() {
    // Convert pixel coords to clip space: [0, resolution] -> [-1, 1]
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
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
