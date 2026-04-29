import type { vec3 } from 'gl-matrix'

// Point flags (bitmask emulation in float)
export const FLAG_SELECTED = 1
export const FLAG_BACKGROUND = 2
export const FLAG_HIGHLIGHT = 4

// Vertex shader: handles point position, color, and dynamic sizing
const VERT = `
precision mediump float;

attribute vec2 position;
attribute vec3 color;
attribute float flag;

uniform mat3 projView;
uniform float nPoints;
uniform float minViewportDimension;

varying lowp vec4 fragColor;

void main() {
  bool isSelected = mod(flag, 2.0) > 0.5;
  float f = floor(flag / 2.0);
  bool isBackground = mod(f, 2.0) > 0.5;
  f = floor(f / 2.0);
  bool isHighlight = mod(f, 2.0) > 0.5;

  // Dynamic point size based on density
  float density = nPoints / (minViewportDimension * minViewportDimension);
  float baseSize = max(1.5, 8.0 - log(density + 1.0) * 2.0);
  float size = isHighlight ? baseSize * 2.0 : (isSelected ? baseSize * 1.3 : baseSize * 0.8);
  gl_PointSize = size;

  // Z-order: background behind, highlight in front
  float z = isBackground ? 0.9 : (isHighlight ? -0.5 : 0.0);
  vec3 xy = projView * vec3(position, 1.0);
  gl_Position = vec4(xy.xy, z, 1.0);

  float alpha = isBackground ? 0.25 : 1.0;
  fragColor = vec4(color, alpha);
}
`

// Fragment shader: draws circular points
const FRAG = `
precision mediump float;
varying lowp vec4 fragColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  if (length(coord) > 0.5) {
    discard;
  }
  gl_FragColor = fragColor;
}
`

export interface DrawPointsProps {
  position: Float32Array
  color: Float32Array
  flag: Uint8Array
  count: number
  projView: Float32Array
  nPoints: number
  minViewportDimension: number
}

export default function createDrawPointsRegl(regl: import('regl').Regl) {
  return regl({
    vert: VERT,
    frag: FRAG,
    attributes: {
      position: {
        buffer: regl.prop('position' as never),
        size: 2,
      },
      color: {
        buffer: regl.prop('color' as never),
        size: 3,
      },
      flag: {
        buffer: regl.prop('flag' as never),
        size: 1,
      },
    },
    uniforms: {
      projView: regl.prop('projView' as never),
      nPoints: regl.prop('nPoints' as never),
      minViewportDimension: regl.prop('minViewportDimension' as never),
    },
    count: regl.prop('count' as never),
    primitive: 'points',
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 'one minus src alpha',
      },
    },
    depth: {
      enable: false,
    },
  })
}
