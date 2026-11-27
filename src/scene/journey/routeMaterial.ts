import { Color, ShaderMaterial, Vector4 } from 'three';

const vertexShader = /* glsl */ `
  varying float vU;
  void main() {
    vU = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform float uLength;
  uniform vec4 uDashed[2];
  uniform vec3 uColorAhead;
  uniform vec3 uColorTravelled;
  varying float vU;

  void main() {
    bool isDashed =
      (uDashed[0].y > uDashed[0].x && vU >= uDashed[0].x && vU <= uDashed[0].y) ||
      (uDashed[1].y > uDashed[1].x && vU >= uDashed[1].x && vU <= uDashed[1].y);
    if (isDashed && mod(vU * uLength, 0.008) > 0.004) {
      discard;
    }
    float travelled = step(vU, uProgress);
    vec3 col = mix(uColorAhead, uColorTravelled, travelled);
    float alpha = mix(0.45, 0.85, travelled);
    gl_FragColor = vec4(col, alpha);
  }
`;

export type RouteMaterialUniforms = {
  uProgress: { value: number };
  uLength: { value: number };
  uDashed: { value: [Vector4, Vector4] };
  uColorAhead: { value: Color };
  uColorTravelled: { value: Color };
};

/** Creates the shader material drawing the travelled, ahead, and dashed route segments. */
export function createRouteMaterial(
  routeLength: number,
  dashedRanges: ReadonlyArray<readonly [number, number]>,
): ShaderMaterial {
  const d0 = dashedRanges[0]
    ? new Vector4(dashedRanges[0][0], dashedRanges[0][1], 0, 0)
    : new Vector4(-1, -1, 0, 0);
  const d1 = dashedRanges[1]
    ? new Vector4(dashedRanges[1][0], dashedRanges[1][1], 0, 0)
    : new Vector4(-1, -1, 0, 0);

  const uniforms: RouteMaterialUniforms = {
    uProgress: { value: 0 },
    uLength: { value: Math.max(0.01, routeLength) },
    uDashed: { value: [d0, d1] },
    uColorAhead: { value: new Color('#9cb3cc') },
    uColorTravelled: { value: new Color('#6FA8FF') },
  };

  return new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}
